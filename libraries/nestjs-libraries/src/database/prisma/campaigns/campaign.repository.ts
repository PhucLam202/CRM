import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { PrismaTransaction } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { CreateCampaignDto, UpdateCampaignDto } from '@gitroom/nestjs-libraries/dtos/automation/automation.dto';

@Injectable()
export class CampaignRepository {
  constructor(
    private _campaign: PrismaRepository<'campaign'>,
    private _campaignPost: PrismaRepository<'campaignPost'>,
    private _posts: PrismaRepository<'post'>,
    private _transaction: PrismaTransaction
  ) {}

  list(organizationId: string) {
    return this._campaign.model.campaign.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        campaignPosts: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  get(organizationId: string, id: string) {
    return this._campaign.model.campaign.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        campaignPosts: true,
      },
    });
  }

  async create(organizationId: string, body: CreateCampaignDto) {
    return this._transaction.model.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          organizationId,
          name: body.name,
          budget: body.budget ?? 0,
          revenue: body.revenue ?? 0,
          startDate: dayjs(body.startDate).toDate(),
          endDate: dayjs(body.endDate).toDate(),
          utmSource: body.utmSource,
          utmMedium: body.utmMedium,
          utmCampaign: body.utmCampaign,
          notes: body.notes,
        },
      });

      if (body.postIds?.length) {
        await tx.campaignPost.createMany({
          data: body.postIds.map((postId) => ({
            campaignId: campaign.id,
            postId,
          })),
          skipDuplicates: true,
        });
      }

      return campaign;
    });
  }

  update(organizationId: string, id: string, body: UpdateCampaignDto) {
    return this._campaign.model.campaign.update({
      where: {
        id,
        organizationId,
      },
      data: {
        name: body.name,
        budget: body.budget,
        revenue: body.revenue,
        startDate: body.startDate ? dayjs(body.startDate).toDate() : undefined,
        endDate: body.endDate ? dayjs(body.endDate).toDate() : undefined,
        utmSource: body.utmSource,
        utmMedium: body.utmMedium,
        utmCampaign: body.utmCampaign,
        notes: body.notes,
      },
    });
  }

  delete(organizationId: string, id: string) {
    return this._campaign.model.campaign.update({
      where: {
        id,
        organizationId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  addPosts(campaignId: string, postIds: string[]) {
    return this._campaignPost.model.campaignPost.createMany({
      data: postIds.map((postId) => ({
        campaignId,
        postId,
      })),
      skipDuplicates: true,
    });
  }

  getCampaignPosts(postIds: string[]) {
    if (!postIds.length) {
      return Promise.resolve([]);
    }
    return this._posts.model.post.findMany({
      where: {
        id: { in: postIds },
        deletedAt: null,
      },
      include: {
        analyticsSnapshots: {
          orderBy: {
            updatedAt: 'desc',
          },
          take: 1,
        },
      },
    });
  }
}
