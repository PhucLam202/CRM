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
