import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  GrowthAiMetadata,
  GrowthAnalysisResult,
} from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insights.types';
import { LlmConfigService } from '@gitroom/nestjs-libraries/llm/llm-config.service';
import { GrowthInsightRefinementInput, LlmTaskConfig } from '@gitroom/nestjs-libraries/llm/llm.types';

const DailySuggestionSchema = z.object({
  dayNumber: z.number(),
  date: z.string(),
  title: z.string(),
  suggestedContent: z.string(),
  focus: z.string(),
  scheduledTime: z.string(),
  scheduledAt: z.string(),
  templateType: z.string(),
  reason: z.string(),
});

const GrowthInsightRefinementSchema = z.object({
  accountSummary: z.string(),
  diagnosis: z.record(z.string(), z.string()).optional(),
  contentPatterns: z.array(
    z.object({
      pattern: z.string(),
      evidence: z.string(),
      impact: z.string(),
      strength: z.number(),
    })
  ).optional(),
  recommendations: z.array(
    z.object({
      type: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
      message: z.string(),
      reason: z.string(),
      expectedImpact: z.string(),
    })
  ).min(3),
  dailySuggestions: z.array(DailySuggestionSchema),
});

@Injectable()
export class LlmRouterService {
  private clients = new Map<string, OpenAI>();

  constructor(private _configService: LlmConfigService) {}

  async refineGrowthInsight(input: GrowthInsightRefinementInput): Promise<GrowthAnalysisResult> {
    const taskConfig = this._configService.getTaskConfig('growthInsights');
    if (!taskConfig) {
      return this.withAiMetadata(input.result, {
        used: false,
        fallback: true,
        reason: 'missing_llm_config_or_key',
      });
    }

    try {
      const client = this.getClient(taskConfig);
      const response = await client.chat.completions.create({
        model: taskConfig.model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: this.buildGrowthSystemPrompt(input.language),
          },
          {
            role: 'user',
            content: JSON.stringify({
              niche: input.niche || input.result.niche,
              growthGoal: input.growthGoal || input.result.growthGoal,
              language: input.language || input.result.language || 'en',
              accountSummary: input.result.accountSummary,
              diagnosis: input.result.diagnosis,
              contentPatterns: input.result.contentPatterns,
              recommendations: input.result.recommendations,
              templates: input.result.templates,
              scoreBreakdown: input.result.scoreBreakdown,
              sourceStats: input.result.sourceStats,
              dailySuggestions: input.result.dailySuggestions,
              postDigest: input.postDigest || input.result.postDigest || [],
              voiceProfile: input.voiceProfile || input.result.voiceProfile,
            }),
          },
        ],
      });

      const parsed = this.parseJson(response.choices[0]?.message?.content || '');
      const refined = GrowthInsightRefinementSchema.safeParse(parsed);
      if (!refined.success) {
        return this.withAiMetadata(input.result, {
          provider: taskConfig.providerName,
          model: taskConfig.model,
          used: true,
          fallback: true,
          reason: 'invalid_llm_response_schema',
        });
      }

      return {
        ...input.result,
        accountSummary: refined.data.accountSummary,
        diagnosis: refined.data.diagnosis || input.result.diagnosis,
        contentPatterns: (refined.data.contentPatterns || input.result.contentPatterns) as GrowthAnalysisResult['contentPatterns'],
        recommendations: (refined.data.recommendations || input.result.recommendations) as GrowthAnalysisResult['recommendations'],
        templates: input.result.templates,
        dailySuggestions: refined.data.dailySuggestions as GrowthAnalysisResult['dailySuggestions'],
        ai: {
          provider: taskConfig.providerName,
          model: taskConfig.model,
          used: true,
          fallback: false,
          reason: 'ok',
        },
        niche: input.niche,
        growthGoal: input.growthGoal,
        language: input.language,
      };
    } catch (error) {
      return this.withAiMetadata(input.result, {
        provider: taskConfig.providerName,
        model: taskConfig.model,
        used: true,
        fallback: true,
        reason: 'llm_request_failed',
      });
    }
  }

  private getClient(config: LlmTaskConfig): OpenAI {
    const cacheKey = `${config.providerName}:${config.provider.baseUrl}`;
    const existing = this.clients.get(cacheKey);
    if (existing) {
      return existing;
    }

    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.provider.baseUrl,
    });
    this.clients.set(cacheKey, client);
    return client;
  }

  private buildGrowthSystemPrompt(language?: string): string {
    const dailyLanguageRule = language === 'vi'
      ? 'Daily suggestion titles, suggestedContent, and reasons must be written in Vietnamese. All other fields must stay in English.'
      : 'All fields must be written in English.';

    return [
      'You refine Growth Intelligence for a social account on X (Twitter).',
      'Return only valid JSON with keys: accountSummary, diagnosis, contentPatterns, recommendations, dailySuggestions.',
      'recommendations is mandatory and must contain 3 to 5 actionable growth suggestions. Never return an empty recommendations array.',
      'If the account is already performing well, recommendations must focus on scaling what works, creating new voice-matched posts, and running controlled content experiments. Do not only recommend fixes for weak accounts.',
      'Keep accountSummary, diagnosis values, contentPatterns, recommendations, reusable templates, and template metadata in English.',
      dailyLanguageRule,
      'Use postDigest and voiceProfile to mimic the account writing style: openings, pacing, formatting, CTA style, and recurring content structure. Do not copy old posts verbatim.',
      'Use the provided approved templates only as structural inspiration for dailySuggestions. Do not return placeholders such as {topic}, {common_belief}, {insight}, or {reason} inside dailySuggestions.suggestedContent.',
      'Each dailySuggestions.suggestedContent must be a ready-to-use post draft based on the user niche, growthGoal, template count, template focus, content patterns, and score signals.',
      'Stay grounded in provided metrics and patterns. Do not invent account metrics, historical results, or unsupported facts.',
      'Preserve dayNumber, date, scheduledTime, scheduledAt, focus, and templateType from the provided dailySuggestions unless there is a clear reason to improve wording only.',
    ].join(' ');
  }

  private parseJson(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        return null;
      }

      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch (innerError) {
        return null;
      }
    }
  }

  private withAiMetadata(result: GrowthAnalysisResult, ai: GrowthAiMetadata): GrowthAnalysisResult {
    return {
      ...result,
      ai,
    };
  }
}
