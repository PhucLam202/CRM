import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { CampaignService } from '@gitroom/nestjs-libraries/database/prisma/campaigns/campaign.service';
import { CreateCampaignDto, UpdateCampaignDto } from '@gitroom/nestjs-libraries/dtos/automation/automation.dto';

@ApiTags('Campaigns')
@Controller('/campaigns')
export class CampaignsController {
  constructor(private _campaignService: CampaignService) {}

  @Get('/')
  list(@GetOrgFromRequest() org: Organization) {
    return this._campaignService.list(org.id);
  }

  @Post('/')
  create(@GetOrgFromRequest() org: Organization, @Body() body: CreateCampaignDto) {
    return this._campaignService.create(org.id, body);
  }

  @Get('/:id/report')
  report(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._campaignService.report(org.id, id);
  }

  @Patch('/:id')
  update(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateCampaignDto
  ) {
    return this._campaignService.update(org.id, id, body);
  }

  @Delete('/:id')
  delete(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._campaignService.delete(org.id, id);
  }
}
