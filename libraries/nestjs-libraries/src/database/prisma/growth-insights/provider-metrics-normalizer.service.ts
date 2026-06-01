import { Injectable } from '@nestjs/common';
import { AnalyticsData } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { NormalizedPostMetrics } from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insights.types';

const emptyMetrics = (): NormalizedPostMetrics => ({
  impressions: 0,
  likes: 0,
  replies: 0,
  reposts: 0,
  quotes: 0,
  bookmarks: 0,
  engagements: 0,
  engagementRate: 0,
  replyRate: 0,
  repostRate: 0,
  bookmarkRate: 0,
});

@Injectable()
export class ProviderMetricsNormalizerService {
  normalize(provider: string, analytics: AnalyticsData[]): NormalizedPostMetrics {
    if (provider !== 'x') {
      return emptyMetrics();
    }

    const byLabel = new Map(
      analytics.map((item) => [
        item.label.toLowerCase(),
        item.data.reduce((total, point) => total + Number(point.total || 0), 0),
      ])
    );

    const impressions = byLabel.get('impressions') || 0;
    const likes = byLabel.get('likes') || 0;
    const replies = byLabel.get('replies') || 0;
    const reposts = byLabel.get('retweets') || byLabel.get('reposts') || 0;
    const quotes = byLabel.get('quotes') || 0;
    const bookmarks = byLabel.get('bookmarks') || 0;
    const engagements = likes + replies + reposts + quotes + bookmarks;

    return {
      impressions,
      likes,
      replies,
      reposts,
      quotes,
      bookmarks,
      engagements,
      engagementRate: impressions > 0 ? engagements / impressions : 0,
      replyRate: impressions > 0 ? replies / impressions : 0,
      repostRate: impressions > 0 ? (reposts + quotes) / impressions : 0,
      bookmarkRate: impressions > 0 ? bookmarks / impressions : 0,
    };
  }
}
