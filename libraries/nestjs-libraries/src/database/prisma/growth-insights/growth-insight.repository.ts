import { Injectable } from '@nestjs/common';
import { State } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  GrowthAnalysisResult,
  SaveContentTemplateInput,
} from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insights.types';

@Injectable()
export class GrowthInsightRepository {
  constructor(
    private _posts: PrismaRepository<'post'>,
    private _snapshots: PrismaRepository<'postAnalyticsSnapshot'>,
    private _insights: PrismaRepository<'accountGrowthInsight'>,
    private _templates: PrismaRepository<'contentTemplatePreset'>
  ) {}

  getPublishedPostsByIntegration(
    organizationId: string,
    integrationId: string,
    from: Date,
    to: Date
  ) {
    return this._posts.model.post.findMany({
      where: {
        organizationId,
        integrationId,
        state: State.PUBLISHED,
        deletedAt: null,
        parentPostId: null,
        releaseId: { not: null },
        publishDate: {
          gte: from,
          lte: to,
        },
      },
      select: {
        id: true,
        content: true,
        publishDate: true,
        releaseId: true,
        releaseURL: true,
      },
      orderBy: {
        publishDate: 'asc',
      },
    });
  }

  getLatestSnapshots(
    organizationId: string,
    integrationId: string,
    postIds: string[]
  ): Promise<Array<{ postId: string; updatedAt: Date; metrics: unknown; normalized: unknown }>> {
    if (!postIds.length) {
      return Promise.resolve([]);
    }

    return this._snapshots.model.postAnalyticsSnapshot.findMany({
      where: {
        organizationId,
        integrationId,
        postId: { in: postIds },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  upsertSnapshot(data: {
    organizationId: string;
    integrationId: string;
    provider: string;
    postId: string;
    providerPostId?: string | null;
    metrics: unknown;
    normalized: unknown;
  }) {
    const snapshotDate = dayjs().startOf('day').toDate();

    return this._snapshots.model.postAnalyticsSnapshot.upsert({
      where: {
        organizationId_integrationId_postId_snapshotDate: {
          organizationId: data.organizationId,
          integrationId: data.integrationId,
          postId: data.postId,
          snapshotDate,
        },
      },
      update: {
        providerPostId: data.providerPostId,
        metrics: data.metrics as any,
        normalized: data.normalized as any,
      },
      create: {
        organizationId: data.organizationId,
        integrationId: data.integrationId,
        provider: data.provider,
        postId: data.postId,
        providerPostId: data.providerPostId,
        snapshotDate,
        metrics: data.metrics as any,
        normalized: data.normalized as any,
      },
    });
  }

  createInsight(data: {
    organizationId: string;
    integrationId: string;
    provider: string;
    periodFrom: Date;
    periodTo: Date;
    periodDays: number;
    result: GrowthAnalysisResult;
  }) {
    return this._insights.model.accountGrowthInsight.create({
      data: {
        organizationId: data.organizationId,
        integrationId: data.integrationId,
        provider: data.provider,
        periodFrom: data.periodFrom,
        periodTo: data.periodTo,
        periodDays: data.periodDays,
        accountSummary: data.result.accountSummary,
        diagnosis: data.result.diagnosis,
        contentPatterns: data.result.contentPatterns as any,
        recommendations: data.result.recommendations as any,
        templates: data.result.templates as any,
        scoreBreakdown: data.result.scoreBreakdown,
        sourceStats: data.result.sourceStats,
      },
    });
  }

  getLatestInsight(organizationId: string, integrationId: string) {
    return this._insights.model.accountGrowthInsight
      .findFirst({
        where: {
          organizationId,
          integrationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      .catch((error: unknown) => {
        if ((error as { code?: string })?.code === 'P2021') {
          return null;
        }

        throw error;
      });
  }

  getInsightHistory(organizationId: string, integrationId: string, limit: number) {
    return this._insights.model.accountGrowthInsight
      .findMany({
        where: {
          organizationId,
          integrationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      })
      .catch((error: unknown) => {
        if ((error as { code?: string })?.code === 'P2021') {
          return [];
        }

        throw error;
      });
  }

  getInsightById(organizationId: string, integrationId: string, insightId: string) {
    return this._insights.model.accountGrowthInsight
      .findFirst({
        where: {
          id: insightId,
          organizationId,
          integrationId,
        },
      })
      .catch((error: unknown) => {
        if ((error as { code?: string })?.code === 'P2021') {
          return null;
        }

        throw error;
      });
  }

  saveTemplatePreset(
    organizationId: string,
    integrationId: string,
    provider: string,
    input: SaveContentTemplateInput
  ) {
    return this._templates.model.contentTemplatePreset.create({
      data: {
        organizationId,
        integrationId,
        provider,
        sourceInsightId: input.sourceInsightId,
        type: input.type,
        title: input.title,
        template: input.template,
        placeholders: input.placeholders as any,
        useCase: input.useCase,
        reason: input.reason,
      },
    });
  }
}
