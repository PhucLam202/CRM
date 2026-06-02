import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { ContentAiService } from '@gitroom/nestjs-libraries/content-ai/content.ai.service';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class SplitThreadTool implements AgentToolInterface {
  constructor(private _contentAi: ContentAiService) {}
  name = 'splitThread';

  run() {
    return createTool({
      id: 'splitThread',
      mcp: {
        annotations: {
          title: 'Split Thread',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      description: `Split a long-form text into a multi-post thread for a specific platform.
Use this when the user pastes a long draft and wants it broken into a thread for X, Threads, LinkedIn, or Mastodon.
The output is draft only — to post, call schedulePostTool with the returned posts.`,
      inputSchema: z.object({
        content: z.string().describe('The long-form content to split'),
        provider: z
          .enum(['x', 'threads', 'linkedin', 'mastodon'])
          .describe('Target platform. Char limit per post is enforced automatically.'),
        language: z.enum(['en', 'vi']).optional(),
        maxPosts: z
          .number()
          .min(1)
          .max(25)
          .optional()
          .describe('Hard cap on the number of posts in the thread. Default 10.'),
      }),
      outputSchema: z.object({
        output: z.object({
          provider: z.string(),
          totalChars: z.number(),
          used: z.boolean(),
          fallback: z.boolean(),
          reason: z.string(),
          posts: z.array(z.string()),
        }),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const result = await this._contentAi.splitThread({
          content: inputData.content,
          provider: inputData.provider,
          language: inputData.language,
          maxPosts: inputData.maxPosts ?? 10,
        });

        return {
          output: {
            provider: result.provider,
            totalChars: result.totalChars,
            used: result.used,
            fallback: result.fallback,
            reason: result.reason,
            posts: result.posts,
          },
        };
      },
    });
  }
}
