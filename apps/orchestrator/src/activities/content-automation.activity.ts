import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { ContentAutomationService } from '@gitroom/nestjs-libraries/database/prisma/content-automation/content-automation.service';

@Injectable()
@Activity()
export class ContentAutomationActivity {
  constructor(private _contentAutomationService: ContentAutomationService) {}

  @ActivityMethod()
  processContentAutomation(id: string) {
    return this._contentAutomationService.processContentAutomation(id);
  }
}
