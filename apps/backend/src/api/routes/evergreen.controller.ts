import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { EvergreenService } from '@gitroom/nestjs-libraries/database/prisma/evergreen/evergreen.service';
import { CreateEvergreenDto, UpdateEvergreenDto } from '@gitroom/nestjs-libraries/dtos/automation/automation.dto';

@ApiTags('Evergreen')
@Controller('/evergreen')
export class EvergreenController {
  constructor(private _evergreenService: EvergreenService) {}

  @Get('/')
  list(@GetOrgFromRequest() org: Organization) {
    return this._evergreenService.list(org.id);
  }

  @Post('/')
  create(@GetOrgFromRequest() org: Organization, @Body() body: CreateEvergreenDto) {
    return this._evergreenService.create(org.id, body);
  }

  @Patch('/:id')
  update(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateEvergreenDto
  ) {
    return this._evergreenService.update(org.id, id, body);
  }

  @Post('/:id/pause')
  pause(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._evergreenService.update(org.id, id, { active: false });
  }

  @Post('/:id/resume')
  resume(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._evergreenService.update(org.id, id, { active: true });
  }

  @Delete('/:id')
  delete(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._evergreenService.delete(org.id, id);
  }
}
