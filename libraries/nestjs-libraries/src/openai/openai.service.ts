import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { shuffle } from 'lodash';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { GrowthAnalysisResult } from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insights.types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
});

const PicturePrompt = z.object({
  prompt: z.string(),
});

const VoicePrompt = z.object({
  voice: z.string(),
});

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

const GrowthInsightPrompt = z.object({
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
  ),
  // Templates intentionally excluded: approved template library owns template structure and localization.
  dailySuggestions: z.array(DailySuggestionSchema),
});

@Injectable()
export class OpenaiService {
  async refineGrowthInsight(result: GrowthAnalysisResult, niche?: string, growthGoal?: string, language?: string): Promise<GrowthAnalysisResult> {
    if (!process.env.OPENAI_API_KEY) {
      return result;
    }

    const refined = (
      await openai.chat.completions.parse({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content:
              'You refine growth insights and daily suggested posts for a social account on X (Twitter). ' +
              'You must stay grounded in the provided structured signals. Do not invent new facts, metrics, patterns, or recommendations without evidence. ' +
              'Remove weak generic advice, improve wording, and prioritize the most useful recommendations. ' +
              'Do not create, rewrite, or invent reusable templates; templates are selected from an approved internal library outside this AI step. ' +
              `CRITICAL LANGUAGE RULE: ALL output fields — accountSummary, diagnosis values, contentPatterns (pattern, evidence, impact), recommendations (message, reason, expectedImpact), and dailySuggestions (title, suggestedContent, reason) — MUST be written entirely in: ${language === 'vi' ? 'Vietnamese (Tiếng Việt). You MUST write everything in Vietnamese. Do not output any English words or sentences.' : 'English.'}` +
              (niche ? ` The user is focused on the "${niche}" niche. Adapt the wording of daily suggested posts to match terminology, pain points, and strategies of this niche perfectly.` : '') +
              (growthGoal ? ` The user goal is to grow over the course of the next ${growthGoal === '5_days' ? '5 days' : 'week (7 days)'}. Refine the suggested daily posts calendar to guide them step-by-step to achieve this goal.` : ''),
          },
          {
            role: 'user',
            content: JSON.stringify({
              niche: niche || result.niche,
              growthGoal: growthGoal || result.growthGoal,
              language: language || result.language,
              accountSummary: result.accountSummary,
              diagnosis: result.diagnosis,
              contentPatterns: result.contentPatterns,
              recommendations: result.recommendations,
              // templates are NOT sent — approved template library controls them
              scoreBreakdown: result.scoreBreakdown,
              sourceStats: result.sourceStats,
              dailySuggestions: result.dailySuggestions,
            }),
          },
        ],
        response_format: zodResponseFormat(GrowthInsightPrompt, 'growthInsight'),
      })
    ).choices[0].message.parsed;

    if (!refined) {
      return result;
    }

    return {
      ...result,
      accountSummary: refined.accountSummary,
      diagnosis: refined.diagnosis || result.diagnosis,
      contentPatterns: (refined.contentPatterns || result.contentPatterns) as GrowthAnalysisResult['contentPatterns'],
      recommendations: refined.recommendations as GrowthAnalysisResult['recommendations'],
      // templates are selected/localized by the approved template library, never overwritten by AI
      templates: result.templates,
      dailySuggestions: refined.dailySuggestions as GrowthAnalysisResult['dailySuggestions'],
      niche,
      growthGoal,
      language,
    };
  }

  async generateImage(prompt: string, isVertical = false) {
    // gpt-image models always return base64 (b64_json) and do not accept the
    // `response_format` parameter, unlike the deprecated dall-e-3.
    const generate = (
      await openai.images.generate({
        prompt,
        model: 'chatgpt-image-latest',
        size: isVertical ? '1024x1536' : '1024x1024',
      })
    ).data[0];

    return generate.b64_json;
  }

  async generatePromptForPicture(prompt: string) {
    return (
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that take a description and style and generate a prompt that will be used later to generate images, make it a very long and descriptive explanation, and write a lot of things for the renderer like, if it${"'"}s realistic describe the camera`,
            },
            {
              role: 'user',
              content: `prompt: ${prompt}`,
            },
          ],
          response_format: zodResponseFormat(PicturePrompt, 'picturePrompt'),
        })
      ).choices[0].message.parsed?.prompt || ''
    );
  }

  async generateVoiceFromText(prompt: string) {
    return (
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that takes a social media post and convert it to a normal human voice, to be later added to a character, when a person talk they don\'t use "-", and sometimes they add pause with "..." to make it sounds more natural, make sure you use a lot of pauses and make it sound like a real person`,
            },
            {
              role: 'user',
              content: `prompt: ${prompt}`,
            },
          ],
          response_format: zodResponseFormat(VoicePrompt, 'voice'),
        })
      ).choices[0].message.parsed?.voice || ''
    );
  }

  async generatePosts(content: string) {
    const posts = (
      await Promise.all([
        openai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'Generate a Twitter post from the content without emojis in the following JSON format: { "post": string } put it in an array with one element',
            },
            {
              role: 'user',
              content: content!,
            },
          ],
          n: 5,
          temperature: 1,
          model: 'gpt-4.1',
        }),
        openai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'Generate a thread for social media in the following JSON format: Array<{ "post": string }> without emojis',
            },
            {
              role: 'user',
              content: content!,
            },
          ],
          n: 5,
          temperature: 1,
          model: 'gpt-4.1',
        }),
      ])
    ).flatMap((p) => p.choices);

    return shuffle(
      posts.map((choice) => {
        const { content } = choice.message;
        const start = content?.indexOf('[')!;
        const end = content?.lastIndexOf(']')!;
        try {
          return JSON.parse(
            '[' +
              content
                ?.slice(start + 1, end)
                .replace(/\n/g, ' ')
                .replace(/ {2,}/g, ' ') +
              ']'
          );
        } catch (e) {
          return [];
        }
      })
    );
  }
  async extractWebsiteText(content: string) {
    const websiteContent = await openai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content:
            'You take a full website text, and extract only the article content',
        },
        {
          role: 'user',
          content,
        },
      ],
      model: 'gpt-4.1',
    });

    const { content: articleContent } = websiteContent.choices[0].message;

    return this.generatePosts(articleContent!);
  }

  async separatePosts(content: string, len: number) {
    const SeparatePostsPrompt = z.object({
      posts: z.array(z.string()),
    });

    const SeparatePostPrompt = z.object({
      post: z.string().max(len),
    });

    const posts =
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that take a social media post and break it to a thread, each post must be minimum ${
                len - 10
              } and maximum ${len} characters, keeping the exact wording and break lines, however make sure you split posts based on context`,
            },
            {
              role: 'user',
              content: content,
            },
          ],
          response_format: zodResponseFormat(
            SeparatePostsPrompt,
            'separatePosts'
          ),
        })
      ).choices[0].message.parsed?.posts || [];

    return {
      posts: await Promise.all(
        posts.map(async (post: any) => {
          if (post.length <= len) {
            return post;
          }

          let retries = 4;
          while (retries) {
            try {
              return (
                (
                  await openai.chat.completions.parse({
                    model: 'gpt-4.1',
                    messages: [
                      {
                        role: 'system',
                        content: `You are an assistant that take a social media post and shrink it to be maximum ${len} characters, keeping the exact wording and break lines`,
                      },
                      {
                        role: 'user',
                        content: post,
                      },
                    ],
                    response_format: zodResponseFormat(
                      SeparatePostPrompt,
                      'separatePost'
                    ),
                  })
                ).choices[0].message.parsed?.post || ''
              );
            } catch (e) {
              retries--;
            }
          }

          return post;
        })
      ),
    };
  }

  async generateSlidesFromText(text: string) {
    for (let i = 0; i < 3; i++) {
      try {
        const message = `You are an assistant that takes a text and break it into slides, each slide should have an image prompt and voice text to be later used to generate a video and voice, image prompt should capture the essence of the slide and also have a back dark gradient on top, image prompt should not contain text in the picture, generate between 3-5 slides maximum`;
        const parse =
          (
            await openai.chat.completions.parse({
              model: 'gpt-4.1',
              messages: [
                {
                  role: 'system',
                  content: message,
                },
                {
                  role: 'user',
                  content: text,
                },
              ],
              response_format: zodResponseFormat(
                z.object({
                  slides: z
                    .array(
                      z.object({
                        imagePrompt: z.string(),
                        voiceText: z.string(),
                      })
                    )
                    .describe('an array of slides'),
                }),
                'slides'
              ),
            })
          ).choices[0].message.parsed?.slides || [];

        return parse;
      } catch (err) {
        console.log(err);
      }
    }

    return [];
  }
}
