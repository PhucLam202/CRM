import { AnalyticsData } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

export interface GenerateGrowthInsightInput {
  from: string;
  to: string;
  forceRefresh?: boolean;
  niche?: string;
  growthGoal?: string;
  language?: string;
  templateCount?: number;
  templateTypes?: string[];
}

export interface SaveContentTemplateInput {
  sourceInsightId?: string;
  type: string;
  title: string;
  template: string;
  placeholders: string[];
  useCase?: string;
  reason?: string;
}

export interface GrowthPost {
  id: string;
  content: string;
  publishDate: Date;
  releaseId: string | null;
  releaseURL: string | null;
}

export interface NormalizedPostMetrics {
  impressions: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  bookmarks: number;
  engagements: number;
  engagementRate: number;
  replyRate: number;
  repostRate: number;
  bookmarkRate: number;
}

export interface PostMetricSnapshotResult {
  post: GrowthPost;
  rawMetrics: AnalyticsData[];
  normalized: NormalizedPostMetrics;
  source: 'database' | 'provider';
}

export interface PostContentFeatures {
  contentLength: number;
  hasQuestion: boolean;
  hasCTA: boolean;
  hasNumberedList: boolean;
  hasThreadSignal: boolean;
  hasStrongOpening: boolean;
  isEducational: boolean;
  isProjectAnalysis: boolean;
  isOpinionated: boolean;
  isGenericUpdate: boolean;
}

export interface AnalyzedPost extends PostMetricSnapshotResult {
  score: number;
  features: PostContentFeatures;
  patterns: string[];
}

export interface ContentPatternInsight {
  pattern: string;
  evidence: string;
  impact: string;
  strength: number;
}

export interface GrowthRecommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  reason: string;
  expectedImpact: string;
}

export interface GrowthContentTemplate {
  type: string;
  title: string;
  template: string;
  placeholders: string[];
  useCase: string;
  reason: string;
  source?: 'approved_library' | 'pattern_match' | 'fallback';
}

export interface DailySuggestion {
  dayNumber: number;
  date: string;
  title: string;
  suggestedContent: string;
  focus: string;
  scheduledTime: string;
  scheduledAt: string;
  templateType: string;
  reason: string;
}

export interface GrowthPostDigestItem {
  id: string;
  content: string;
  publishDate: string;
  score: number;
  patterns: string[];
  features: PostContentFeatures;
  metrics: NormalizedPostMetrics;
}

export interface GrowthVoiceProfile {
  averageLength: number;
  commonOpenings: string[];
  formattingStyle: string;
  ctaStyle: string;
  toneSignals: string[];
}

export interface GrowthAiMetadata {
  provider?: string;
  model?: string;
  used: boolean;
  fallback: boolean;
  reason: string;
}

export interface GrowthAnalysisResult {
  accountSummary: string;
  diagnosis: Record<string, string>;
  contentPatterns: ContentPatternInsight[];
  recommendations: GrowthRecommendation[];
  templates: GrowthContentTemplate[];
  scoreBreakdown: Record<string, number | string>;
  sourceStats: Record<string, number | boolean | string | any>;
  dailySuggestions?: DailySuggestion[];
  postDigest?: GrowthPostDigestItem[];
  voiceProfile?: GrowthVoiceProfile;
  ai?: GrowthAiMetadata;
  niche?: string;
  growthGoal?: string;
  language?: string;
}
