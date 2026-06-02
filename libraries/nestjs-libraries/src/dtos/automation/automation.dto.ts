import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsInt,
  IsNumber,
  IsIn,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const AUTOMATION_NICHES = [
  'ai_tech',
  'business_saas',
  'creator_personal_brand',
  'developer_education',
  'fitness_wellness',
  'finance_investing',
  'marketing_growth',
  'design_creators',
] as const;

export const AUTOMATION_GOALS = ['5_days', '7_days', 'next_week'] as const;
export enum ContentAutomationFormat {
  SinglePost = 'single_post',
  Thread = 'thread',
}
export const AUTOMATION_FORMATS = Object.values(ContentAutomationFormat);
export const AUTOMATION_LANGUAGES = ['en', 'vi'] as const;
export const FREQUENCY_TYPES = ['daily', 'weekly'] as const;

export class CreateEvergreenDto {
  @IsString()
  @IsDefined()
  integrationId: string;

  @IsString()
  @IsDefined()
  sourcePostId: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  minScore?: number;

  @IsIn(FREQUENCY_TYPES as readonly string[])
  @IsOptional()
  frequencyType?: (typeof FREQUENCY_TYPES)[number];

  @IsInt()
  @Min(1)
  @Max(14)
  @IsOptional()
  frequencyPerWeek?: number;

  @IsDateString()
  @IsOptional()
  nextRepostAt?: string;
}

export class UpdateEvergreenDto {
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  minScore?: number;

  @IsIn(FREQUENCY_TYPES as readonly string[])
  @IsOptional()
  frequencyType?: (typeof FREQUENCY_TYPES)[number];

  @IsInt()
  @Min(1)
  @Max(14)
  @IsOptional()
  frequencyPerWeek?: number;
}

export class CreateContentAutomationDto {
  @IsString()
  @IsDefined()
  integrationId: string;

  @IsString()
  @IsDefined()
  niche: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  growthGoal?: string;

  @IsIn(AUTOMATION_FORMATS)
  @IsOptional()
  format?: ContentAutomationFormat;

  @IsInt()
  @Min(1)
  @Max(14)
  @IsOptional()
  frequencyPerWeek?: number;

  @IsInt()
  @Min(0)
  @Max(23)
  @IsOptional()
  preferredHour?: number;

  @IsDateString()
  @IsOptional()
  nextRunAt?: string;
}

export class UpdateContentAutomationDto {
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsString()
  @IsOptional()
  niche?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  growthGoal?: string;

  @IsIn(AUTOMATION_FORMATS)
  @IsOptional()
  format?: ContentAutomationFormat;

  @IsInt()
  @Min(1)
  @Max(14)
  @IsOptional()
  frequencyPerWeek?: number;

  @IsInt()
  @Min(0)
  @Max(23)
  @IsOptional()
  preferredHour?: number;

  @IsDateString()
  @IsOptional()
  nextRunAt?: string;
}

export class CreateCampaignDto {
  @IsString()
  @IsDefined()
  name: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  budget?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  revenue?: number;

  @IsDateString()
  @IsDefined()
  startDate: string;

  @IsDateString()
  @IsDefined()
  endDate: string;

  @IsString()
  @IsOptional()
  utmSource?: string;

  @IsString()
  @IsOptional()
  utmMedium?: string;

  @IsString()
  @IsOptional()
  utmCampaign?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  postIds?: string[];
}

export class UpdateCampaignDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  budget?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  revenue?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  utmSource?: string;

  @IsString()
  @IsOptional()
  utmMedium?: string;

  @IsString()
  @IsOptional()
  utmCampaign?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
