export type AutomationTab = 'evergreen' | 'content' | 'campaigns';

export interface IntegrationLite {
  id: string;
  name: string;
  identifier: string;
  picture?: string;
  disabled?: boolean;
  inBetweenSteps?: boolean;
  type?: string;
  customer?: { id?: string; name?: string };
}

export interface EvergreenItem {
  id: string;
  organizationId: string;
  integrationId: string;
  sourcePostId: string;
  active: boolean;
  minScore: number;
  frequencyType: 'daily' | 'weekly';
  frequencyPerWeek: number;
  nextRepostAt: string;
  lastRepostPostId?: string | null;
  rotationCount: number;
  lastRotatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentAutomationItem {
  id: string;
  organizationId: string;
  integrationId: string;
  active: boolean;
  niche: string;
  language: string;
  growthGoal: string;
  format: string;
  frequencyPerWeek: number;
  preferredHour?: number | null;
  lastGeneratedAt?: string | null;
  lastPostId?: string | null;
  nextRunAt: string;
  totalRuns: number;
  createdAt: string;
  updatedAt: string;
}

export enum ContentAutomationFormat {
  SinglePost = 'single_post',
  Thread = 'thread',
}

export const CONTENT_AUTOMATION_FORMATS = [
  ContentAutomationFormat.SinglePost,
  ContentAutomationFormat.Thread,
] as const;

export interface CampaignItem {
  id: string;
  organizationId: string;
  name: string;
  budget: number;
  revenue: number;
  startDate: string;
  endDate: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  campaignPosts?: Array<{ id: string; postId: string }>;
}

export const NICHE_LABELS: Record<string, string> = {
  ai_tech: 'AI & Tech',
  business_saas: 'Business / SaaS',
  creator_personal_brand: 'Creator & Personal Brand',
  developer_education: 'Developer Education',
  fitness_wellness: 'Fitness & Wellness',
  finance_investing: 'Finance & Investing',
  marketing_growth: 'Marketing & Growth',
  design_creators: 'Design & Creators',
};

export const GOAL_LABELS: Record<string, string> = {
  '5_days': 'Quick engagement',
  '7_days': 'Consistent growth',
  next_week: 'Weekly planning',
};

export const FORMAT_LABELS: Record<string, string> = {
  [ContentAutomationFormat.SinglePost]: 'Single post',
  [ContentAutomationFormat.Thread]: 'Thread / long post',
  mixed: 'Mixed (disabled)',
};

export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
};
