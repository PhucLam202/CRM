import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ContentAiService } from '@gitroom/nestjs-libraries/content-ai/content.ai.service';
import {
  GenerateContentDto,
  SplitThreadDto,
} from '@gitroom/nestjs-libraries/dtos/content-ai/content.ai.dto';

@ApiTags('Content AI')
@Controller('/content-ai')
export class ContentAiController {
  constructor(private _contentAi: ContentAiService) {}

  @Post('/generate')
  async generate(
    @GetOrgFromRequest() _org: Organization,
    @Body() body: GenerateContentDto
  ) {
    return this._contentAi.generate({
      keyword: body.keyword,
      format: body.format,
      niche: body.niche,
      language: body.language,
      count: body.count ?? 3,
    });
  }

  @Post('/thread')
  async splitThread(
    @GetOrgFromRequest() _org: Organization,
    @Body() body: SplitThreadDto
  ) {
    return this._contentAi.splitThread({
      content: body.content,
      provider: body.provider,
      language: body.language,
      maxPosts: body.maxPosts ?? 10,
    });
  }
}
