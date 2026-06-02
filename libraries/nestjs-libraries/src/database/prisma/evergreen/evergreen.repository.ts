import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { CreateEvergreenDto, UpdateEvergreenDto } from '@gitroom/nestjs-libraries/dtos/automation/automation.dto';
import dayjs from 'dayjs';

@Injectable()
export class EvergreenRepository {
  constructor(
    private _evergreenQueue: PrismaRepository<'evergreenQueue'>,
    private _posts: PrismaRepository<'post'>
  ) {}

  list(organizationId: string) {
    return this._evergreenQueue.model.evergreenQueue.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  get(organizationId: string, id: string) {
    return this._evergreenQueue.model.evergreenQueue.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });
  }

  getById(id: string) {
    return this._evergreenQueue.model.evergreenQueue.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  create(organizationId: string, body: CreateEvergreenDto) {
    const frequencyType = body.frequencyType ?? 'weekly';
    const frequencyPerPeriod = body.frequencyPerWeek ?? 2;
    return this._evergreenQueue.model.evergreenQueue.create({
      data: {
        organizationId,
        integrationId: body.integrationId,
        sourcePostId: body.sourcePostId,
        minScore: body.minScore ?? 0,
        frequencyType,
        frequencyPerWeek: frequencyPerPeriod,
        nextRepostAt: body.nextRepostAt
          ? dayjs(body.nextRepostAt).toDate()
          : frequencyType === 'daily'
            ? dayjs().add(Math.max(1, Math.ceil(24 / frequencyPerPeriod)), 'hour').toDate()
            : dayjs().add(Math.max(1, Math.ceil(7 / frequencyPerPeriod)), 'day').toDate(),
      },
    });
  }

  update(organizationId: string, id: string, body: UpdateEvergreenDto) {
    return this._evergreenQueue.model.evergreenQueue.update({
      where: {
        id,
        organizationId,
      },
      data: {
        active: body.active,
        minScore: body.minScore,
        frequencyType: body.frequencyType,
        frequencyPerWeek: body.frequencyPerWeek,
      },
    });
  }

  delete(organizationId: string, id: string) {
    return this._evergreenQueue.model.evergreenQueue.update({
      where: {
        id,
        organizationId,
      },
      data: {
        deletedAt: new Date(),
        active: false,
      },
    });
  }

  getSourcePost(organizationId: string, sourcePostId: string) {
    return this._posts.model.post.findFirst({
      where: {
        id: sourcePostId,
        organizationId,
        deletedAt: null,
      },
      include: {
        integration: true,
        childrenPost: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  markRotated(id: string, postId: string, nextRepostAt: Date, rotationCount: number) {
    return this._evergreenQueue.model.evergreenQueue.update({
      where: {
        id,
      },
      data: {
        lastRepostPostId: postId,
        lastRotatedAt: new Date(),
        rotationCount,
        nextRepostAt,
      },
    });
  }
}
