import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { State } from '@prisma/client';
import dayjs from 'dayjs';

export type ContentFormat = 'thread' | 'image' | 'video' | 'poll' | 'text';

export interface ContentTypePerformanceItem {
  format: ContentFormat;
  posts: number;
  avgEngagementRate: number;
  avgReplyRate: number;
  avgBookmarkRate: number;
  avgRepostRate: number;
  bestPostId: string | null;
  bestScore: number;
}

export interface ContentTypePerformanceResult {
  from: string;
  to: string;
  items: ContentTypePerformanceItem[];
  totalPosts: number;
}

@Injectable()
export class ContentTypePerformanceService {
  constructor(
    private _posts: PrismaRepository<'post'>,
    private _snapshots: PrismaRepository<'postAnalyticsSnapshot'>
  ) {}

  async analyze(
    organizationId: string,
    integrationId: string,
    from: Date,
    to: Date
  ): Promise<ContentTypePerformanceResult> {
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
        content: true,
        image: true,
        settings: true,
        group: true,
        parentPostId: true,
        publishDate: true,
        integration: { select: { providerIdentifier: true } },
      },
    });

    if (posts.length === 0) {
      return {
        from: dayjs(from).toISOString(),
        to: dayjs(to).toISOString(),
        items: [],
        totalPosts: 0,
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

    const groupCounts = new Map<string, number>();
    for (const post of posts) {
      if (post.group) {
        groupCounts.set(post.group, (groupCounts.get(post.group) || 0) + 1);
      }
    }

    const buckets = new Map<ContentFormat, ContentTypePerformanceItem>();
    for (const fmt of ['thread', 'image', 'video', 'poll', 'text'] as ContentFormat[]) {
      buckets.set(fmt, this.empty(fmt));
    }

    for (const post of posts) {
      const snapshot = latestByPost.get(post.id);
      if (!snapshot) {
        continue;
      }
      const normalized = (snapshot.normalized as Record<string, number>) || {};
      if (!normalized.engagementRate && !normalized.impressions) {
        continue;
      }
      const format = this.deriveFormat(post, groupCounts);
      const item = buckets.get(format)!;
      item.posts += 1;
      item.avgEngagementRate += normalized.engagementRate || 0;
      item.avgReplyRate += normalized.replyRate || 0;
      item.avgBookmarkRate += normalized.bookmarkRate || 0;
      item.avgRepostRate += normalized.repostRate || 0;
      const score = this.computeScore(normalized);
      if (score > item.bestScore) {
        item.bestScore = score;
        item.bestPostId = post.id;
      }
    }

    const items = [...buckets.values()]
      .filter((item) => item.posts > 0)
      .map((item) => ({
        ...item,
        avgEngagementRate: item.avgEngagementRate / item.posts,
        avgReplyRate: item.avgReplyRate / item.posts,
        avgBookmarkRate: item.avgBookmarkRate / item.posts,
        avgRepostRate: item.avgRepostRate / item.posts,
      }))
      .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);

    return {
      from: dayjs(from).toISOString(),
      to: dayjs(to).toISOString(),
      items,
      totalPosts: items.reduce((sum, item) => sum + item.posts, 0),
    };
  }

  private deriveFormat(
    post: { parentPostId: string | null; group: string; image: string | null; settings: string | null; content: string },
    groupCounts: Map<string, number>
  ): ContentFormat {
    if (post.parentPostId) {
      return 'thread';
    }
    const groupSize = post.group ? groupCounts.get(post.group) || 1 : 1;
    if (groupSize > 1) {
      return 'thread';
    }
    if (this.hasVideoAttachment(post.image)) {
      return 'video';
    }
    if (post.image && post.image !== '[]' && post.image !== 'null') {
      return 'image';
    }
    if (this.isPollSettings(post.settings)) {
      return 'poll';
    }
    return 'text';
  }

  private hasVideoAttachment(image: string | null): boolean {
    if (!image) {
      return false;
    }
    try {
      const parsed = JSON.parse(image);
      if (Array.isArray(parsed)) {
        return parsed.some((item) => item?.type === 'video');
      }
    } catch {
      // ignore
    }
    return false;
  }

  private isPollSettings(settings: string | null): boolean {
    if (!settings) {
      return false;
    }
    try {
      const parsed = JSON.parse(settings);
      if (parsed && typeof parsed === 'object') {
        return Object.values(parsed).some(
          (value) =>
            value &&
            typeof value === 'object' &&
            ((value as Record<string, unknown>).poll !== undefined ||
              (value as Record<string, unknown>).type === 'poll')
        );
      }
    } catch {
      // ignore
    }
    return false;
  }

  private computeScore(normalized: Record<string, number>): number {
    return (
      (normalized.engagementRate || 0) * 0.6 +
      (normalized.replyRate || 0) * 0.25 +
      (normalized.bookmarkRate || 0) * 0.1 +
      (normalized.repostRate || 0) * 0.05
    );
  }

  private empty(format: ContentFormat): ContentTypePerformanceItem {
    return {
      format,
      posts: 0,
      avgEngagementRate: 0,
      avgReplyRate: 0,
      avgBookmarkRate: 0,
      avgRepostRate: 0,
      bestPostId: null,
      bestScore: 0,
    };
  }
}
