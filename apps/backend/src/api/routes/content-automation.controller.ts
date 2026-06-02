import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ContentAutomationService } from '@gitroom/nestjs-libraries/database/prisma/content-automation/content-automation.service';
import { CreateContentAutomationDto, UpdateContentAutomationDto } from '@gitroom/nestjs-libraries/dtos/automation/automation.dto';

@ApiTags('Content Automation')
@Controller('/content-automations')
export class ContentAutomationController {
  constructor(private _contentAutomationService: ContentAutomationService) {}

  @Get('/')
  list(@GetOrgFromRequest() org: Organization) {
    return this._contentAutomationService.list(org.id);
  }

  @Post('/')
  create(@GetOrgFromRequest() org: Organization, @Body() body: CreateContentAutomationDto) {
    return this._contentAutomationService.create(org.id, body);
  }

  @Patch('/:id')
  update(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateContentAutomationDto
  ) {
    return this._contentAutomationService.update(org.id, id, body);
  }

  @Post('/:id/pause')
  pause(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._contentAutomationService.update(org.id, id, { active: false });
  }

  @Post('/:id/resume')
  resume(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._contentAutomationService.update(org.id, id, { active: true });
  }

  @Delete('/:id')
  delete(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._contentAutomationService.delete(org.id, id);
  }
}
