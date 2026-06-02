import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { CreationMethod } from '@prisma/client';
import { TemporalService } from 'nestjs-temporal-core';
import { TypedSearchAttributes } from '@temporalio/common';
import { organizationId } from '@gitroom/nestjs-libraries/temporal/temporal.search.attribute';
import { ContentAutomationRepository } from '@gitroom/nestjs-libraries/database/prisma/content-automation/content-automation.repository';
import { ContentAiService } from '@gitroom/nestjs-libraries/content-ai/content.ai.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import {
  ContentAutomationFormat,
  CreateContentAutomationDto,
  UpdateContentAutomationDto,
} from '@gitroom/nestjs-libraries/dtos/automation/automation.dto';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

@Injectable()
export class ContentAutomationService {
  private readonly _logger = new Logger(ContentAutomationService.name);

  constructor(
    private _repository: ContentAutomationRepository,
    private _contentAi: ContentAiService,
    private _integrationService: IntegrationService,
    private _postsService: PostsService,
    private _temporalService: TemporalService
  ) {}

  list(organizationId: string) {
    return this._repository.list(organizationId);
  }

  async create(organizationId: string, body: CreateContentAutomationDto) {
    const data = await this._repository.create(organizationId, body);
    await this.processCron(data.active, organizationId, data.id);
    return data;
  }

  async update(organizationId: string, id: string, body: UpdateContentAutomationDto) {
    const data = await this._repository.update(organizationId, id, body);
    if (typeof body.active === 'boolean') {
      await this.processCron(body.active, organizationId, id);
    }
    return data;
  }

  async delete(organizationId: string, id: string) {
    const data = await this._repository.delete(organizationId, id);
    await this.processCron(false, organizationId, id);
    return data;
  }

  async processCron(active: boolean, orgId: string, id: string) {
    if (active) {
      try {
        const client = this._temporalService.client.getRawClient();
        if (!client) {
          this._logger.warn(`Temporal client unavailable for content automation ${id}`);
          return false;
        }

        return client.workflow.start('contentAutomationWorkflow', {
          workflowId: `content-automation-${id}`,
          taskQueue: 'main',
          args: [{ id, immediately: true }],
          typedSearchAttributes: new TypedSearchAttributes([
            {
              key: organizationId,
              value: orgId,
            },
          ]),
        });
      } catch (err) {
        this._logger.warn(`Failed to start content automation workflow ${id}: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    }

    try {
      return await this._temporalService.terminateWorkflow(`content-automation-${id}`);
    } catch (err) {
      return false;
    }
  }

  async processContentAutomation(id: string) {
    const item = await this._repository.getById(id);
    if (!item || !item.active) {
      return { skipped: true, reason: 'not_due' };
    }

    if (dayjs(item.nextRunAt).isAfter(dayjs())) {
      return { skipped: true, reason: 'not_due', nextRunAt: item.nextRunAt };
    }

    const integration = await this._integrationService.getIntegrationById(item.organizationId, item.integrationId);
    if (!integration || integration.disabled || integration.deletedAt) {
      return { skipped: true, reason: 'integration_unavailable' };
    }

    const format = item.format === ContentAutomationFormat.Thread
      ? ContentAutomationFormat.Thread
      : ContentAutomationFormat.SinglePost;
    const generated = await this._contentAi.generate({
      keyword: `${item.niche} ${item.growthGoal}`,
      niche: item.niche,
      language: item.language,
      format,
      count: 1,
    });

    const postContents = [(generated.data as { content: string }).content];

    const publishDate = await this._postsService.findFreeDateTime(item.organizationId, item.integrationId, {
      minSpacingMinutes: 30,
      optimalOnly: true,
    });
    const created = await this._postsService.createPost(
      item.organizationId,
      {
        date: `${publishDate}Z`,
        order: makeId(10),
        shortLink: false,
        type: 'schedule',
        tags: [],
        posts: [
          {
            integration: { id: integration.id },
            group: makeId(10),
            settings: {
              __type: integration.providerIdentifier as any,
              title: '',
              tags: [],
              subreddit: [],
            },
            value: postContents.map((content) => ({
              id: makeId(10),
              content,
              delay: 0,
              image: [],
            })),
          },
        ],
      },
      CreationMethod.AUTOPOST
    );

    const postId = created[0]?.postId;
    if (!postId) {
      return { skipped: true, reason: 'post_create_failed' };
    }

    const nextRunAt = dayjs()
      .add(Math.max(1, Math.ceil(7 / item.frequencyPerWeek)), 'day')
      .hour(item.preferredHour ?? 9)
      .minute(0)
      .second(0)
      .millisecond(0)
      .toDate();
    await this._repository.markGenerated(item.id, postId, nextRunAt, item.totalRuns + 1);
    this._logger.log(
      `Content automation ${id} created scheduled post ${postId} for ${publishDate}Z; next run ${nextRunAt.toISOString()}`
    );
    return { skipped: false, postId, nextRunAt };
  }
}
