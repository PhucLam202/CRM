import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { State } from '@prisma/client';
import dayjs from 'dayjs';

export type TimeSeriesBucket = 'day' | 'week';

export interface EngagementTimeSeriesPoint {
  date: string;
  posts: number;
  avgEngagementRate: number;
  avgReplyRate: number;
  avgBookmarkRate: number;
  avgRepostRate: number;
  totalImpressions: number;
  totalEngagements: number;
}

export interface EngagementTimeSeriesResult {
  bucket: TimeSeriesBucket;
  from: string;
  to: string;
  points: EngagementTimeSeriesPoint[];
}

@Injectable()
export class EngagementTimeSeriesService {
  constructor(
    private _posts: PrismaRepository<'post'>,
    private _snapshots: PrismaRepository<'postAnalyticsSnapshot'>
  ) {}

  async analyze(
    organizationId: string,
    integrationId: string,
    from: Date,
    to: Date,
    bucket: TimeSeriesBucket = 'day'
  ): Promise<EngagementTimeSeriesResult> {
    const posts = await this._posts.model.post.findMany({
      where: {
        organizationId,
        integrationId,
        deletedAt: null,
        publishDate: {
          gte: from,
          lte: to,
        },
      },
      select: {
        id: true,
        publishDate: true,
        integration: { select: { providerIdentifier: true } },
      },
    });

    if (posts.length === 0) {
      return {
        bucket,
        from: dayjs(from).toISOString(),
        to: dayjs(to).toISOString(),
        points: [],
      };
    }

    const provider = posts[0].integration?.providerIdentifier || 'x';
    const snapshots = await this._snapshots.model.postAnalyticsSnapshot.findMany({
      where: {
        organizationId,
        integrationId,
        postId: { in: posts.map((p) => p.id) },
        provider,
      },
    });

    const latestByPost = new Map<string, any>();
    for (const snapshot of snapshots) {
      const existing = latestByPost.get(snapshot.postId);
      if (!existing || dayjs(snapshot.updatedAt).isAfter(dayjs(existing.updatedAt))) {
        latestByPost.set(snapshot.postId, snapshot);
      }
    }

    const buckets = new Map<string, EngagementTimeSeriesPoint>();
    for (const post of posts) {
      const snapshot = latestByPost.get(post.id);
      if (!snapshot) {
        continue;
      }
      const normalized = (snapshot.normalized as Record<string, number>) || {};
      if (!normalized.engagementRate && !normalized.impressions) {
        continue;
      }
      const key = this.bucketKey(dayjs.utc(post.publishDate), bucket);
      const point =
        buckets.get(key) ||
        ({
          date: key,
          posts: 0,
          avgEngagementRate: 0,
          avgReplyRate: 0,
          avgBookmarkRate: 0,
          avgRepostRate: 0,
          totalImpressions: 0,
          totalEngagements: 0,
        } as EngagementTimeSeriesPoint);
      point.posts += 1;
      point.avgEngagementRate += normalized.engagementRate || 0;
      point.avgReplyRate += normalized.replyRate || 0;
      point.avgBookmarkRate += normalized.bookmarkRate || 0;
      point.avgRepostRate += normalized.repostRate || 0;
      point.totalImpressions += normalized.impressions || 0;
      point.totalEngagements += normalized.engagements || 0;
      buckets.set(key, point);
    }

    const points = [...buckets.values()]
      .map((point) => ({
        ...point,
        avgEngagementRate: point.posts ? point.avgEngagementRate / point.posts : 0,
        avgReplyRate: point.posts ? point.avgReplyRate / point.posts : 0,
        avgBookmarkRate: point.posts ? point.avgBookmarkRate / point.posts : 0,
        avgRepostRate: point.posts ? point.avgRepostRate / point.posts : 0,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    return {
      bucket,
      from: dayjs(from).toISOString(),
      to: dayjs(to).toISOString(),
      points,
    };
  }

  private bucketKey(date: dayjs.Dayjs, bucket: TimeSeriesBucket): string {
    if (bucket === 'week') {
      return date.startOf('week').format('YYYY-MM-DD');
    }
    return date.startOf('day').format('YYYY-MM-DD');
  }
}
