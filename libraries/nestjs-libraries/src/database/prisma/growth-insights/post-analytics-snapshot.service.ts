import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { GrowthInsightRepository } from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insight.repository';
import { ProviderMetricsNormalizerService } from '@gitroom/nestjs-libraries/database/prisma/growth-insights/provider-metrics-normalizer.service';
import {
  GrowthPost,
  PostMetricSnapshotResult,
} from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insights.types';
import { AnalyticsData } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

@Injectable()
export class PostAnalyticsSnapshotService {
  constructor(
    private _repository: GrowthInsightRepository,
    private _postsService: PostsService,
    private _normalizer: ProviderMetricsNormalizerService
  ) {}

  async ensureSnapshots(params: {
    organizationId: string;
    integrationId: string;
    provider: string;
    posts: GrowthPost[];
    periodDays: number;
    forceRefresh?: boolean;
  }): Promise<{ results: PostMetricSnapshotResult[]; metricsFetched: number; snapshotsUsed: number }> {
    const snapshots = await this._repository.getLatestSnapshots(
      params.organizationId,
      params.integrationId,
      params.posts.map((post) => post.id)
    );

    const latestByPost = new Map<string, (typeof snapshots)[number]>();
    for (const snapshot of snapshots) {
      if (!latestByPost.has(snapshot.postId)) {
        latestByPost.set(snapshot.postId, snapshot);
      }
    }

    const results: PostMetricSnapshotResult[] = [];
    let metricsFetched = 0;
    let snapshotsUsed = 0;

    for (const post of params.posts) {
      const snapshot = latestByPost.get(post.id);
      const isStale = snapshot
        ? dayjs(snapshot.updatedAt).isBefore(dayjs().subtract(24, 'hour'))
        : true;

      if (snapshot && !params.forceRefresh && !isStale) {
        snapshotsUsed += 1;
        const rawMetrics = snapshot.metrics as unknown as AnalyticsData[];
        const normalized = snapshot.normalized
          ? (snapshot.normalized as any)
          : this._normalizer.normalize(params.provider, rawMetrics);

        results.push({
          post,
          rawMetrics,
          normalized,
          source: 'database',
        });
        continue;
      }

      const rawMetricsResult = await this._postsService.checkPostAnalytics(
        params.organizationId,
        post.id,
        params.periodDays,
        params.forceRefresh
      );
      const rawMetrics = Array.isArray(rawMetricsResult) ? rawMetricsResult : [];
      const normalized = this._normalizer.normalize(params.provider, rawMetrics);

      await this._repository.upsertSnapshot({
        organizationId: params.organizationId,
        integrationId: params.integrationId,
        provider: params.provider,
        postId: post.id,
        providerPostId: post.releaseId,
        metrics: rawMetrics,
        normalized,
      });

      metricsFetched += 1;
      results.push({
        post,
        rawMetrics,
        normalized,
        source: 'provider',
      });
    }

    return { results, metricsFetched, snapshotsUsed };
  }
}
