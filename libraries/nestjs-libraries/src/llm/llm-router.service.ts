import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  GrowthAiMetadata,
  GrowthAnalysisResult,
} from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insights.types';
import { LlmConfigService } from '@gitroom/nestjs-libraries/llm/llm-config.service';
import {
  ContentGenerationIdeas,
  ContentGenerationInput,
  ContentGenerationResult,
  ContentGenerationSingle,
  ContentGenerationThread,
  GrowthInsightRefinementInput,
  LlmTaskConfig,
  ThreadSplitInput,
  ThreadSplitResult,
} from '@gitroom/nestjs-libraries/llm/llm.types';

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

  async generateContent(input: ContentGenerationInput): Promise<ContentGenerationResult> {
    const language = input.language || 'en';
    const taskConfig = this._configService.getTaskConfig('contentGeneration');
    if (!taskConfig) {
      return this.buildContentFallback(input, language, {
        used: false,
        fallback: true,
        reason: 'missing_llm_config_or_key',
      });
    }

    try {
      const client = this.getClient(taskConfig);
      const schema = this.buildContentSchema(input.format, input.count);
      const response = await client.chat.completions.create({
        model: taskConfig.model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: this.buildContentSystemPrompt(input.format, language, input.niche),
          },
          {
            role: 'user',
            content: JSON.stringify({
              keyword: input.keyword,
              niche: input.niche,
              format: input.format,
              count: input.count,
              language,
            }),
          },
        ],
      });

      const parsed = this.parseJson(response.choices[0]?.message?.content || '');
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        return this.buildContentFallback(input, language, {
          provider: taskConfig.providerName,
          model: taskConfig.model,
          used: true,
          fallback: true,
          reason: 'invalid_llm_response_schema',
        });
      }

      return {
        format: input.format,
        language,
        provider: taskConfig.providerName,
        model: taskConfig.model,
        used: true,
        fallback: false,
        reason: 'ok',
        data: validated.data as ContentGenerationThread | ContentGenerationIdeas | ContentGenerationSingle,
      };
    } catch (error) {
      return this.buildContentFallback(input, language, {
        provider: taskConfig.providerName,
        model: taskConfig.model,
        used: true,
        fallback: true,
        reason: 'llm_request_failed',
      });
    }
  }

  async splitThread(input: ThreadSplitInput): Promise<ThreadSplitResult> {
    const language = input.language || 'en';
    const charLimit = this.getCharLimitForProvider(input.provider);
    const taskConfig = this._configService.getTaskConfig('threadSplit');
    if (!taskConfig) {
      return this.buildThreadFallback(input, charLimit, {
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
            content: this.buildThreadSystemPrompt(charLimit, input.provider, language),
          },
          {
            role: 'user',
            content: input.content,
          },
        ],
      });

      const parsed = this.parseJson(response.choices[0]?.message?.content || '');
      const validated = z
        .object({ posts: z.array(z.string().max(charLimit)) })
        .safeParse(parsed);
      if (!validated.success) {
        return this.buildThreadFallback(input, charLimit, {
          provider: taskConfig.providerName,
          model: taskConfig.model,
          used: true,
          fallback: true,
          reason: 'invalid_llm_response_schema',
        });
      }

      const posts = this.trimThreadToMax(validated.data.posts, charLimit, input.maxPosts);
      return {
        posts,
        provider: input.provider,
        totalChars: posts.reduce((sum, p) => sum + p.length, 0),
        providerName: taskConfig.providerName,
        model: taskConfig.model,
        used: true,
        fallback: false,
        reason: 'ok',
      };
    } catch (error) {
      return this.buildThreadFallback(input, charLimit, {
        provider: taskConfig.providerName,
        model: taskConfig.model,
        used: true,
        fallback: true,
        reason: 'llm_request_failed',
      });
    }
  }

  private buildContentSchema(format: string, count: number) {
    if (format === 'thread') {
      return z.object({
        content: z.string().min(1),
      });
    }
    if (format === 'ideas') {
      return z.object({
        ideas: z
          .array(
            z.object({
              title: z.string().min(1),
              angle: z.string().min(1),
              hook: z.string().min(1),
            })
          )
          .min(1)
          .max(count + 2),
      });
    }
    return z.object({
      content: z.string().min(1),
    });
  }

  private buildContentSystemPrompt(format: string, language: string, niche?: string): string {
    const langRule =
      language === 'vi'
        ? 'You MUST write ALL output strictly in Vietnamese (Tiếng Việt). Do not output any English words or sentences.'
        : 'You MUST write ALL output strictly in English.';

    const nicheRule = niche
      ? ` The content MUST be directly relevant to the "${niche}" niche. Use niche-specific terminology, examples, pain points, and benefits. Do not drift into generic social media advice.`
      : '';

    if (format === 'thread') {
      return [
        'You are a social media growth copywriter.',
        'You generate one long-form, ready-to-publish social media post from a keyword.',
        'Return only valid JSON: { "content": string }.',
        'Do NOT split the answer into multiple posts, tweets, slides, or thread items.',
        'The post must have a strong hook, clear structure, concrete niche-specific points, and a meaningful closing CTA.',
        'Write complete, useful content that can stand alone without extra context.',
        'Avoid vague claims, filler, irrelevant tips, hashtags, and generic motivational lines.',
        'Use line breaks where helpful for readability.',
        langRule,
        nicheRule,
      ].join(' ');
    }
    if (format === 'ideas') {
      return [
        'You are a social media growth strategist.',
        'You generate a list of post ideas from a keyword.',
        'Return only valid JSON: { "ideas": Array<{ "title": string, "angle": string, "hook": string }> }.',
        '"title" is a short label. "angle" is the unique perspective. "hook" is the opening line that could grab attention.',
        'Each idea must be original, useful, and avoid generic advice.',
        langRule,
        nicheRule,
      ].join(' ');
    }
    return [
      'You are a social media growth copywriter.',
      'You generate a single, ready-to-publish post from a keyword.',
      'Return only valid JSON: { "content": string }.',
      'Keep it concise by default unless the user asks otherwise. Make it specific, accurate, and useful. Avoid hashtags and filler. Use line breaks where helpful.',
      langRule,
      nicheRule,
    ].join(' ');
  }

  private buildContentFallback(
    input: ContentGenerationInput,
    language: string,
    meta: { provider?: string; model?: string; used: boolean; fallback: boolean; reason: string }
  ): ContentGenerationResult {
    let data: ContentGenerationThread | ContentGenerationIdeas | ContentGenerationSingle;
    if (input.format === 'thread') {
      data = { content: input.keyword } as ContentGenerationThread;
    } else if (input.format === 'ideas') {
      const titles = this.manualIdeaFallback(input.keyword, input.count, language);
      data = {
        ideas: titles.map((title) => ({
          title,
          angle: title,
          hook: title,
        })),
      } as ContentGenerationIdeas;
    } else {
      data = { content: input.keyword } as ContentGenerationSingle;
    }

    return {
      format: input.format,
      language,
      provider: meta.provider,
      model: meta.model,
      used: meta.used,
      fallback: meta.fallback,
      reason: meta.reason,
      data,
    };
  }

  private manualSplitFallback(content: string, count: number): string[] {
    const sentences = content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length <= 1) {
      return [content];
    }
    const target = Math.min(count, sentences.length);
    const groupSize = Math.max(1, Math.ceil(sentences.length / target));
    const posts: string[] = [];
    for (let i = 0; i < sentences.length; i += groupSize) {
      posts.push(sentences.slice(i, i + groupSize).join(' '));
    }
    return posts;
  }

  private manualIdeaFallback(keyword: string, count: number, language: string): string[] {
    const isVi = language === 'vi';
    const templates = isVi
      ? [
          `${keyword}: góc nhìn từ người mới bắt đầu`,
          `${keyword}: 3 sai lầm phổ biến cần tránh`,
          `${keyword}: case study thực tế`,
          `${keyword}: checklist triển khai nhanh`,
          `${keyword}: myth vs reality`,
        ]
      : [
          `${keyword}: a beginner's perspective`,
          `${keyword}: 3 common mistakes to avoid`,
          `${keyword}: a real case study`,
          `${keyword}: a quick implementation checklist`,
          `${keyword}: myth vs reality`,
        ];
    return templates.slice(0, count);
  }

  private buildThreadSystemPrompt(charLimit: number, provider: string, language: string): string {
    const langRule =
      language === 'vi'
        ? 'You MUST write the entire thread strictly in Vietnamese (Tiếng Việt). Do not mix English.'
        : 'You MUST write the entire thread strictly in English.';

    return [
      'You are a social media thread builder.',
      `Target platform: ${provider}.`,
      `Each post must be ≤ ${charLimit} characters.`,
      'Split the input by natural meaning, not by sentence length.',
      'Each post should stand on its own. Preserve formatting and important line breaks.',
      'The first post is a hook. The last post can include a soft CTA.',
      'Return only valid JSON: { "posts": string[] }.',
      'Do not add numbering prefixes (1/, 2/) — the publisher adds them.',
      langRule,
    ].join(' ');
  }

  private buildThreadFallback(
    input: ThreadSplitInput,
    charLimit: number,
    meta: { provider?: string; model?: string; used: boolean; fallback: boolean; reason: string }
  ): ThreadSplitResult {
    const posts = this.manualCharSplit(input.content, charLimit, input.maxPosts);
    return {
      posts,
      provider: input.provider,
      totalChars: posts.reduce((sum, p) => sum + p.length, 0),
      providerName: meta.provider,
      model: meta.model,
      used: meta.used,
      fallback: meta.fallback,
      reason: meta.reason,
    };
  }

  private manualCharSplit(content: string, charLimit: number, maxPosts: number): string[] {
    const trimmed = content.trim();
    if (trimmed.length <= charLimit) {
      return [trimmed];
    }
    const posts: string[] = [];
    let remaining = trimmed;
    while (remaining.length > charLimit && posts.length < maxPosts - 1) {
      let cut = remaining.lastIndexOf(' ', charLimit);
      if (cut < charLimit / 2) {
        cut = charLimit;
      }
      posts.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining.length) {
      posts.push(remaining.slice(0, charLimit).trim());
    }
    return posts.filter(Boolean);
  }

  private trimThreadToMax(posts: string[], charLimit: number, maxPosts: number): string[] {
    const result: string[] = [];
    for (const post of posts) {
      if (result.length >= maxPosts) {
        break;
      }
      const trimmed = post.length > charLimit ? post.slice(0, charLimit - 1) + '…' : post;
      result.push(trimmed);
    }
    if (!result.length) {
      result.push('');
    }
    return result;
  }

  private getCharLimitForProvider(provider: string): number {
    switch (provider) {
      case 'x':
        return 280;
      case 'threads':
        return 500;
      case 'linkedin':
        return 3000;
      case 'mastodon':
        return 500;
      default:
        return 280;
    }
  }
}
