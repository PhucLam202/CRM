import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  ContentAutomationFormat,
  CreateContentAutomationDto,
  UpdateContentAutomationDto,
} from '@gitroom/nestjs-libraries/dtos/automation/automation.dto';

@Injectable()
export class ContentAutomationRepository {
  constructor(private _contentAutomation: PrismaRepository<'contentAutomation'>) {}

  list(organizationId: string) {
    return this._contentAutomation.model.contentAutomation.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  getById(id: string) {
    return this._contentAutomation.model.contentAutomation.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  create(organizationId: string, body: CreateContentAutomationDto) {
    return this._contentAutomation.model.contentAutomation.create({
      data: {
        organizationId,
        integrationId: body.integrationId,
        niche: body.niche,
        language: body.language || 'en',
        growthGoal: body.growthGoal || '5_days',
        format: body.format || ContentAutomationFormat.SinglePost,
        frequencyPerWeek: body.frequencyPerWeek ?? 5,
        preferredHour: body.preferredHour,
        nextRunAt: body.nextRunAt ? dayjs(body.nextRunAt).toDate() : dayjs().add(1, 'day').toDate(),
      },
    });
  }

  update(organizationId: string, id: string, body: UpdateContentAutomationDto) {
    return this._contentAutomation.model.contentAutomation.update({
      where: {
        id,
        organizationId,
      },
      data: {
        active: body.active,
        niche: body.niche,
        language: body.language,
        growthGoal: body.growthGoal,
        format: body.format,
        frequencyPerWeek: body.frequencyPerWeek,
        preferredHour: body.preferredHour,
        nextRunAt: body.nextRunAt ? dayjs(body.nextRunAt).toDate() : undefined,
      },
    });
  }

  delete(organizationId: string, id: string) {
    return this._contentAutomation.model.contentAutomation.update({
      where: {
        id,
        organizationId,
      },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });
  }

  markGenerated(id: string, postId: string, nextRunAt: Date, totalRuns: number) {
    return this._contentAutomation.model.contentAutomation.update({
      where: {
        id,
      },
      data: {
        lastGeneratedAt: new Date(),
        lastPostId: postId,
        nextRunAt,
        totalRuns,
      },
    });
  }
}
