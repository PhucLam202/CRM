import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { ContentAiService } from '@gitroom/nestjs-libraries/content-ai/content.ai.service';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class GenerateContentIdeaTool implements AgentToolInterface {
  constructor(private _contentAi: ContentAiService) {}
  name = 'generateContentIdea';

  run() {
    return createTool({
      id: 'generateContentIdea',
      mcp: {
        annotations: {
          title: 'Generate Content Idea',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      description: `Generate social media content ideas from a keyword.
Use this when the user wants content ideas, hooks, angles, or long-form post drafts based on a topic.
The output is a draft only — to actually post, call schedulePostTool after the user confirms.`,
      inputSchema: z.object({
        keyword: z.string().describe('The topic or seed idea'),
        format: z
          .enum(['single_post', 'thread', 'ideas'])
          .describe(
            'single_post = one concise ready-to-publish post. thread = one long-form ready-to-publish post. ideas = a list of angles/hooks.'
          ),
        niche: z
          .string()
          .optional()
          .describe('Optional niche context, e.g. "ai_tech", "business_saas"'),
        language: z
          .enum(['en', 'vi'])
          .optional()
          .describe('Output language. Default English.'),
        count: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe('How many ideas to generate. Default 3.'),
      }),
      outputSchema: z.object({
        output: z.object({
          format: z.string(),
          language: z.string(),
          used: z.boolean(),
          fallback: z.boolean(),
          reason: z.string(),
          thread: z
            .object({ content: z.string() })
            .optional()
            .describe('When format = thread'),
          ideas: z
            .array(
              z.object({
                title: z.string(),
                angle: z.string(),
                hook: z.string(),
              })
            )
            .optional()
            .describe('When format = ideas'),
          content: z.string().optional().describe('When format = single_post'),
        }),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const result = await this._contentAi.generate({
          keyword: inputData.keyword,
          format: inputData.format,
          niche: inputData.niche,
          language: inputData.language,
          count: inputData.count ?? 3,
        });

        return {
          output: {
            format: result.format,
            language: result.language,
            used: result.used,
            fallback: result.fallback,
            reason: result.reason,
            thread:
              result.format === 'thread'
                ? (result.data as { content: string })
                : undefined,
            ideas:
              result.format === 'ideas'
                ? (
                    result.data as {
                      ideas: Array<{ title: string; angle: string; hook: string }>;
                    }
                  ).ideas
                : undefined,
            content:
              result.format === 'single_post'
                ? (result.data as { content: string }).content
                : undefined,
          },
        };
      },
    });
  }
}
