import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ApiTags } from '@nestjs/swagger';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { GrowthInsightService } from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insight.service';
import {
  GenerateGrowthInsightInput,
  SaveContentTemplateInput,
} from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insights.types';

@ApiTags('Analytics')
@Controller('/analytics')
export class AnalyticsController {
  constructor(
    private _integrationService: IntegrationService,
    private _postsService: PostsService,
    private _growthInsightService: GrowthInsightService
  ) {}

  @Post('/:integration/growth-insights/generate')
  async generateGrowthInsight(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Body() body: GenerateGrowthInsightInput
  ) {
    return this._growthInsightService.generate(org.id, integration, body);
  }

  @Get('/:integration/growth-insights/latest')
  async getLatestGrowthInsight(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string
  ) {
    return this._growthInsightService.latest(org.id, integration);
  }

  @Get('/:integration/growth-insights/history')
  async getGrowthInsightHistory(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Query('limit') limit: string
  ) {
    return this._growthInsightService.history(org.id, integration, Number(limit || 10));
  }

  @Get('/:integration/growth-insights/:insightId')
  async getGrowthInsight(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Param('insightId') insightId: string
  ) {
    return this._growthInsightService.getById(org.id, integration, insightId);
  }

  @Post('/:integration/content-templates')
  async saveTemplate(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Body() body: SaveContentTemplateInput
  ) {
    return this._growthInsightService.saveTemplate(org.id, integration, body);
  }

  @Get('/:integration')
  async getIntegration(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Query('date') date: string
  ) {
    return this._integrationService.checkAnalytics(org, integration, date);
  }

  @Get('/post/:postId')
  async getPostAnalytics(
    @GetOrgFromRequest() org: Organization,
    @Param('postId') postId: string,
    @Query('date') date: string
  ) {
    return this._postsService.checkPostAnalytics(org.id, postId, +date);
  }
}
