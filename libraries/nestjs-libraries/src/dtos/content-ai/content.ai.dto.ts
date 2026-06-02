import {
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ContentFormat {
  SinglePost = 'single_post',
  Thread = 'thread',
  Ideas = 'ideas',
}
export const CONTENT_FORMATS = Object.values(ContentFormat);
export const THREAD_PROVIDERS = ['x', 'threads', 'linkedin', 'mastodon'] as const;
export const SUPPORTED_LANGUAGES = ['en', 'vi'] as const;

export class GenerateContentDto {
  @IsString()
  @IsDefined()
  keyword: string;

  @IsIn(CONTENT_FORMATS as readonly string[])
  @IsDefined()
  format: ContentFormat;

  @IsString()
  @IsOptional()
  niche?: string;

  @IsIn(SUPPORTED_LANGUAGES as readonly string[])
  @IsOptional()
  language?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  @IsOptional()
  count: number = 3;
}

export class SplitThreadDto {
  @IsString()
  @IsDefined()
  content: string;

  @IsIn(THREAD_PROVIDERS as readonly string[])
  @IsDefined()
  provider: (typeof THREAD_PROVIDERS)[number];

  @IsIn(SUPPORTED_LANGUAGES as readonly string[])
  @IsOptional()
  language?: string;

  @IsInt()
  @Min(1)
  @Max(25)
  @Type(() => Number)
  @IsOptional()
  maxPosts: number = 10;
}
