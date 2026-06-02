import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { State } from '@prisma/client';
import dayjs from 'dayjs';

export interface BestTimeSlot {
  dayOfWeek: number;
  hour: number;
  score: number;
  sampleSize: number;
  avgEngagementRate: number;
  avgReplyRate: number;
  avgBookmarkRate: number;
  avgRepostRate: number;
}

export interface BestTimeResult {
  status: 'ready' | 'insufficient_data';
  minimumPosts: number;
  postsAnalyzed: number;
  slotsAnalyzed: number;
  from: string;
  to: string;
  slots: BestTimeSlot[];
  weekdayBestHour: number | null;
  weekendBestHour: number | null;
}

const MINIMUM_POSTS = 30;
const SLOT_HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

@Injectable()
export class BestTimeAnalyzerService {
  constructor(
    private _posts: PrismaRepository<'post'>,
    private _snapshots: PrismaRepository<'postAnalyticsSnapshot'>
  ) {}

  async analyze(
    organizationId: string,
    integrationId: string,
    from: Date,
    to: Date
  ): Promise<BestTimeResult> {
    const posts = await this._posts.model.post.findMany({
      where: {
        organizationId,
        integrationId,
        state: State.PUBLISHED,
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

    if (posts.length < MINIMUM_POSTS) {
      return {
        status: 'insufficient_data',
        minimumPosts: MINIMUM_POSTS,
        postsAnalyzed: posts.length,
        slotsAnalyzed: 0,
        from: dayjs(from).toISOString(),
        to: dayjs(to).toISOString(),
        slots: [],
        weekdayBestHour: null,
        weekendBestHour: null,
      };
    }

    const provider = posts[0]?.integration?.providerIdentifier || 'x';
    const snapshots = await this._snapshots.model.postAnalyticsSnapshot.findMany({
      where: {
        organizationId,
        integrationId,
        postId: { in: posts.map((p) => p.id) },
        provider,
      },
    });

    if (snapshots.length === 0) {
      return {
        status: 'insufficient_data',
        minimumPosts: MINIMUM_POSTS,
        postsAnalyzed: posts.length,
        slotsAnalyzed: 0,
        from: dayjs(from).toISOString(),
        to: dayjs(to).toISOString(),
        slots: [],
        weekdayBestHour: null,
        weekendBestHour: null,
      };
    }

    const snapshotMap = new Map<string, any>();
    for (const snapshot of snapshots) {
      const existing = snapshotMap.get(snapshot.postId);
      if (!existing || dayjs(snapshot.updatedAt).isAfter(dayjs(existing.updatedAt))) {
        snapshotMap.set(snapshot.postId, snapshot);
      }
    }

    const buckets = new Map<string, BestTimeSlot>();
    for (const slotHour of SLOT_HOURS) {
      buckets.set(this.key(0, slotHour), this.empty(0, slotHour));
      buckets.set(this.key(1, slotHour), this.empty(1, slotHour));
    }

    for (const post of posts) {
      const snapshot = snapshotMap.get(post.id);
      if (!snapshot) {
        continue;
      }
      const normalized = (snapshot.normalized as Record<string, number>) || {};
      if (!normalized.engagementRate && !normalized.impressions) {
        continue;
      }
      const publish = dayjs.utc(post.publishDate);
      const dayOfWeek = publish.day();
      const hour = publish.hour();
      const key = this.key(dayOfWeek, hour);
      const slot = buckets.get(key);
      if (!slot) {
        continue;
      }
      slot.sampleSize += 1;
      slot.avgEngagementRate += normalized.engagementRate || 0;
      slot.avgReplyRate += normalized.replyRate || 0;
      slot.avgBookmarkRate += normalized.bookmarkRate || 0;
      slot.avgRepostRate += normalized.repostRate || 0;
    }

    const allSlots: BestTimeSlot[] = [];
    const weekdayByHour = new Map<number, BestTimeSlot>();
    const weekendByHour = new Map<number, BestTimeSlot>();
    for (const slot of buckets.values()) {
      if (!slot.sampleSize) {
        continue;
      }
      slot.avgEngagementRate /= slot.sampleSize;
      slot.avgReplyRate /= slot.sampleSize;
      slot.avgBookmarkRate /= slot.sampleSize;
      slot.avgRepostRate /= slot.sampleSize;
      slot.score = this.computeScore(slot);
      allSlots.push(slot);
      if (slot.dayOfWeek === 0 || slot.dayOfWeek === 6) {
        weekendByHour.set(slot.hour, slot);
      } else {
        weekdayByHour.set(slot.hour, slot);
      }
    }

    const ranked = allSlots
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    return {
      status: 'ready',
      minimumPosts: MINIMUM_POSTS,
      postsAnalyzed: posts.length,
      slotsAnalyzed: allSlots.length,
      from: dayjs(from).toISOString(),
      to: dayjs(to).toISOString(),
      slots: ranked,
      weekdayBestHour: this.bestHour(weekdayByHour),
      weekendBestHour: this.bestHour(weekendByHour),
    };
  }

  private computeScore(slot: BestTimeSlot): number {
    return (
      slot.avgEngagementRate * 0.6 +
      slot.avgReplyRate * 0.25 +
      slot.avgBookmarkRate * 0.1 +
      slot.avgRepostRate * 0.05
    );
  }

  private key(dayOfWeek: number, hour: number): string {
    return `${dayOfWeek}:${hour}`;
  }

  private empty(dayOfWeek: number, hour: number): BestTimeSlot {
    return {
      dayOfWeek,
      hour,
      score: 0,
      sampleSize: 0,
      avgEngagementRate: 0,
      avgReplyRate: 0,
      avgBookmarkRate: 0,
      avgRepostRate: 0,
    };
  }

  private bestHour(map: Map<number, BestTimeSlot>): number | null {
    let best: BestTimeSlot | null = null;
    for (const slot of map.values()) {
      if (!slot.sampleSize) {
        continue;
      }
      if (!best || slot.score > best.score) {
        best = slot;
      }
    }
    return best ? best.hour : null;
  }
}
