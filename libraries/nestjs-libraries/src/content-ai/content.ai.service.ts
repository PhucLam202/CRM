import { Injectable } from '@nestjs/common';
import { LlmRouterService } from '@gitroom/nestjs-libraries/llm/llm-router.service';
import {
  ContentGenerationFormat,
  ContentGenerationResult,
  ThreadSplitInput,
  ThreadSplitResult,
} from '@gitroom/nestjs-libraries/llm/llm.types';

@Injectable()
export class ContentAiService {
  constructor(private _llmRouter: LlmRouterService) {}

  generate(input: {
    keyword: string;
    format: ContentGenerationFormat;
    niche?: string;
    language?: string;
    count: number;
  }): Promise<ContentGenerationResult> {
    return this._llmRouter.generateContent({
      keyword: input.keyword.trim(),
      format: input.format,
      niche: input.niche,
      language: input.language,
      count: input.count,
    });
  }

  splitThread(input: ThreadSplitInput): Promise<ThreadSplitResult> {
    return this._llmRouter.splitThread(input);
  }
}
