import {
  GrowthAnalysisResult,
  GrowthPostDigestItem,
  GrowthVoiceProfile,
} from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insights.types';

export type LlmProviderType = 'openai-compatible';

export interface LlmProviderConfig {
  type: LlmProviderType;
  baseUrl: string;
  apiKeyEnv: string;
  models: Record<string, string>;
}

export interface LlmConfig {
  defaultProvider: string;
  providers: Record<string, LlmProviderConfig>;
}

export interface GrowthInsightRefinementInput {
  result: GrowthAnalysisResult;
  niche?: string;
  growthGoal?: string;
  language?: string;
  postDigest?: GrowthPostDigestItem[];
  voiceProfile?: GrowthVoiceProfile;
}

export interface LlmTaskConfig {
  providerName: string;
  provider: LlmProviderConfig;
  model: string;
  apiKey: string;
}

export type ContentGenerationFormat =
  | 'single_post'
  | 'thread'
  | 'ideas';

export interface ContentGenerationInput {
  keyword: string;
  niche?: string;
  format: ContentGenerationFormat;
  language?: string;
  count: number;
  provider?: string;
}

export interface ContentGenerationThread {
  content: string;
}

export interface ContentGenerationIdeas {
  ideas: Array<{
    title: string;
    angle: string;
    hook: string;
  }>;
}

export interface ContentGenerationSingle {
  content: string;
}

export interface ContentGenerationResult {
  format: ContentGenerationFormat;
  language: string;
  provider?: string;
  model?: string;
  used: boolean;
  fallback: boolean;
  reason: string;
  data: ContentGenerationThread | ContentGenerationIdeas | ContentGenerationSingle;
}

export interface ThreadSplitInput {
  content: string;
  provider: 'x' | 'threads' | 'linkedin' | 'mastodon';
  language?: string;
  maxPosts: number;
}

export interface ThreadSplitResult {
  posts: string[];
  provider: string;
  totalChars: number;
  providerName?: string;
  model?: string;
  used: boolean;
  fallback: boolean;
  reason: string;
}
