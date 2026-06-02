import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { CreationMethod } from '@prisma/client';
import { TemporalService } from 'nestjs-temporal-core';
import { TypedSearchAttributes } from '@temporalio/common';
import { organizationId } from '@gitroom/nestjs-libraries/temporal/temporal.search.attribute';
import { EvergreenRepository } from '@gitroom/nestjs-libraries/database/prisma/evergreen/evergreen.repository';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { CreateEvergreenDto, UpdateEvergreenDto } from '@gitroom/nestjs-libraries/dtos/automation/automation.dto';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

@Injectable()
export class EvergreenService {
  private readonly _logger = new Logger(EvergreenService.name);

  constructor(
    private _repository: EvergreenRepository,
    private _postsService: PostsService,
    private _integrationService: IntegrationService,
    private _temporalService: TemporalService
  ) {}

  list(organizationId: string) {
    return this._repository.list(organizationId);
  }

  async create(organizationId: string, body: CreateEvergreenDto) {
    const data = await this._repository.create(organizationId, body);
    await this.processCron(data.active, organizationId, data.id);
    return data;
  }

  async update(organizationId: string, id: string, body: UpdateEvergreenDto) {
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
          this._logger.warn(`Temporal client unavailable for evergreen ${id}`);
          return false;
        }

        return client.workflow.start('evergreenWorkflow', {
          workflowId: `evergreen-${id}`,
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
        this._logger.warn(`Failed to start evergreen workflow ${id}: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    }

    try {
      return await this._temporalService.terminateWorkflow(`evergreen-${id}`);
    } catch (err) {
      return false;
    }
  }

  async processEvergreen(id: string) {
    const item = await this._repository.getById(id);
    if (!item || !item.active) {
      return { skipped: true, reason: 'not_due' };
    }

    if (dayjs(item.nextRepostAt).isAfter(dayjs())) {
      return { skipped: true, reason: 'not_due', nextRepostAt: item.nextRepostAt };
    }

    const frequencyType = item.frequencyType || 'weekly';

    const source = await this._repository.getSourcePost(item.organizationId, item.sourcePostId);
    if (!source) {
      await this._repository.update(item.organizationId, item.id, { active: false });
      return { skipped: true, reason: 'source_post_missing' };
    }

    const integration = await this._integrationService.getIntegrationById(item.organizationId, item.integrationId);
    if (!integration || integration.disabled || integration.deletedAt) {
      return { skipped: true, reason: 'integration_unavailable' };
    }

    const windowStart = frequencyType === 'daily' ? dayjs().startOf('day') : dayjs().startOf('week');
    const rotationCount = dayjs(item.lastRotatedAt).isAfter(windowStart) ? item.rotationCount : 0;
    if (rotationCount >= item.frequencyPerWeek) {
      return { skipped: true, reason: 'frequency_cap' };
    }

    const publishDate = await this._postsService.findFreeDateTime(item.organizationId, item.integrationId);
    const sourcePosts = [source, ...(source.childrenPost || [])];
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
            settings: JSON.parse(source.settings || '{}') || {
              __type: integration.providerIdentifier,
            },
            value: sourcePosts.map((post) => ({
              id: makeId(10),
              content: post.content,
              delay: post.delay || 0,
              image: JSON.parse(post.image || '[]'),
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

    const nextRepostAt =
      frequencyType === 'daily'
        ? dayjs().add(Math.max(1, Math.ceil(24 / item.frequencyPerWeek)), 'hour').toDate()
        : dayjs().add(Math.max(1, Math.ceil(7 / item.frequencyPerWeek)), 'day').toDate();
    await this._repository.markRotated(item.id, postId, nextRepostAt, rotationCount + 1);
    this._logger.log(`Evergreen ${id} scheduled post ${postId}; next repost ${nextRepostAt.toISOString()}`);
    return { skipped: false, postId, nextRepostAt };
  }
}
