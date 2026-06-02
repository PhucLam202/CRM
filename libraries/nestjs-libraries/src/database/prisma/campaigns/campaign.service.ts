import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignRepository } from '@gitroom/nestjs-libraries/database/prisma/campaigns/campaign.repository';
import { CreateCampaignDto, UpdateCampaignDto } from '@gitroom/nestjs-libraries/dtos/automation/automation.dto';

@Injectable()
export class CampaignService {
  constructor(private _repository: CampaignRepository) {}

  list(organizationId: string) {
    return this._repository.list(organizationId);
  }

  create(organizationId: string, body: CreateCampaignDto) {
    if (new Date(body.endDate).getTime() < new Date(body.startDate).getTime()) {
      throw new BadRequestException('endDate must be after startDate');
    }
    return this._repository.create(organizationId, body);
  }

  update(organizationId: string, id: string, body: UpdateCampaignDto) {
    return this._repository.update(organizationId, id, body);
  }

  delete(organizationId: string, id: string) {
    return this._repository.delete(organizationId, id);
  }

  async report(organizationId: string, id: string) {
    const campaign = await this._repository.get(organizationId, id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const postIds = campaign.campaignPosts.map((post) => post.postId);
    const posts = await this._repository.getCampaignPosts(postIds);
    const metrics = posts.reduce(
      (total, post) => {
        const normalized = (post.analyticsSnapshots[0]?.normalized as Record<string, number>) || {};
        return {
          impressions: total.impressions + (normalized.impressions || 0),
          engagements: total.engagements + (normalized.engagements || 0),
          likes: total.likes + (normalized.likes || 0),
          replies: total.replies + (normalized.replies || 0),
          reposts: total.reposts + (normalized.reposts || 0),
          bookmarks: total.bookmarks + (normalized.bookmarks || 0),
        };
      },
      {
        impressions: 0,
        engagements: 0,
        likes: 0,
        replies: 0,
        reposts: 0,
        bookmarks: 0,
      }
    );

    const roi = campaign.budget > 0 ? (campaign.revenue - campaign.budget) / campaign.budget : null;
    const costPerEngagement = metrics.engagements > 0 ? campaign.budget / metrics.engagements : null;

    return {
      campaign,
      postCount: postIds.length,
      metrics,
      financials: {
        budget: campaign.budget,
        revenue: campaign.revenue,
        profit: campaign.revenue - campaign.budget,
        roi,
        costPerEngagement,
      },
    };
  }
}
