import { Injectable } from '@nestjs/common';
import {
  AnalyzedPost,
  ContentPatternInsight,
  GrowthRecommendation,
} from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insights.types';

@Injectable()
export class GrowthRecommendationService {
  build(params: {
    posts: AnalyzedPost[];
    patterns: ContentPatternInsight[];
    postsPerDay: number;
    engagementRate: number;
    consistencyScore: number;
    niche?: string;
    growthGoal?: string;
    templateTypes?: string[];
  }): GrowthRecommendation[] {
    const recommendations: GrowthRecommendation[] = [];
    const topPattern = params.patterns[0];
    const topPost = [...params.posts].sort((left, right) => right.score - left.score)[0];
    const averageImpressions = this.average(params.posts.map((post) => post.normalized.impressions));

    if (params.postsPerDay < 0.5) {
      recommendations.push({
        type: 'posting_volume',
        priority: 'high',
        message: `Only ${params.posts.length} posts were published in this period. Increase output before judging content quality too aggressively.`,
        reason: 'Low posting volume makes it harder to create enough learning signals and repeat winning formats.',
        expectedImpact: 'More consistent data and more chances to find repeatable content patterns.',
      });
    }

    if (params.consistencyScore < 60 && params.posts.length >= 4) {
      recommendations.push({
        type: 'posting_consistency',
        priority: 'medium',
        message: 'Spread posts more evenly across the selected period instead of clustering them into a few days.',
        reason: 'Posting consistency was weaker than the account performance baseline for this period.',
        expectedImpact: 'A steadier publishing cadence should reduce content clustering and create more reliable reach signals.',
      });
    }

    if (topPattern) {
      recommendations.push({
        type: 'content_strategy',
        priority: 'high',
        message: `Create more posts that follow this winning pattern: ${topPattern.pattern.toLowerCase()}`,
        reason: topPattern.evidence,
        expectedImpact: topPattern.impact,
      });
    }

    const questionPosts = params.posts.filter((post) => post.features.hasQuestion);
    const noQuestionPosts = params.posts.filter((post) => !post.features.hasQuestion);
    const questionReplyRate = this.average(questionPosts.map((post) => post.normalized.replyRate));
    const noQuestionReplyRate = this.average(noQuestionPosts.map((post) => post.normalized.replyRate));

    if (questionPosts.length >= 2 && questionReplyRate > noQuestionReplyRate * 1.2) {
      recommendations.push({
        type: 'engagement_prompt',
        priority: 'medium',
        message: 'End more posts with a specific question that invites a reply, not a generic CTA.',
        reason: 'Posts with questions generated stronger reply-rate signals in this period.',
        expectedImpact: 'Higher reply quality and more conversation around future posts.',
      });
    }

    if (params.engagementRate < 0.01 && params.posts.length >= 3) {
      recommendations.push({
        type: 'engagement_quality',
        priority: 'high',
        message: 'Prioritize posts with a clear first-line hook and a concrete insight instead of broad updates.',
        reason: 'Overall engagement rate was below 1%, which suggests reach is not converting into enough actions.',
        expectedImpact: 'Better conversion from impressions into replies, bookmarks, and reposts.',
      });
    }

    if (!recommendations.length) {
      recommendations.push({
        type: 'scale_current_momentum',
        priority: 'high',
        message: 'The account is already showing healthy posting consistency and engagement quality. Use the next plan to scale the formats closest to your current voice instead of changing direction.',
        reason: `The account averaged ${Math.round(averageImpressions).toLocaleString()} impressions per post with a ${(params.engagementRate * 100).toFixed(2)}% engagement rate, so the next best move is to compound the working style with more deliberate post angles.`,
        expectedImpact: 'More posts that preserve the existing voice while increasing repeatable reach signals.',
      });
    }

    if (!recommendations.some((recommendation) => recommendation.type === 'voice_matched_post_series')) {
      recommendations.push({
        type: 'voice_matched_post_series',
        priority: 'high',
        message: `Create a ${params.growthGoal === '7_days' ? '7-day' : '5-day'} post series based on the account's strongest recent tone and structure.`,
        reason: topPost
          ? `The strongest recent post scored ${topPost.score}, so new drafts should borrow its pacing, formatting, and angle without copying the content.`
          : 'A focused post series gives the model enough consistency to test voice-matched ideas against the account baseline.',
        expectedImpact: 'A clear sequence of new drafts that can be scheduled immediately while staying close to the account style.',
      });
    }

    if (!recommendations.some((recommendation) => recommendation.type === 'template_execution_plan')) {
      const focus = params.templateTypes?.length ? params.templateTypes.join(', ') : 'the selected template mix';
      recommendations.push({
        type: 'template_execution_plan',
        priority: 'medium',
        message: `Turn ${focus} into ready-to-post drafts that fit the ${params.niche || 'selected'} niche.`,
        reason: 'Users should not need to fill generic placeholders when the account history and growth goal already provide enough context for stronger draft suggestions.',
        expectedImpact: 'Less manual editing and a faster path from insight to scheduled posts.',
      });
    }

    if (recommendations.length < 3) {
      recommendations.push({
        type: 'next_growth_experiment',
        priority: 'medium',
        message: 'Run one controlled content experiment in the next plan while keeping the rest of the posts close to the current winning style.',
        reason: 'A small experiment creates new learning signals without disrupting what already works for the account.',
        expectedImpact: 'Better discovery of the next repeatable format while protecting current engagement quality.',
      });
    }

    return recommendations.slice(0, 6);
  }

  private average(values: number[]) {
    if (!values.length) {
      return 0;
    }

    return values.reduce((total, value) => total + value, 0) / values.length;
  }
}
