import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import {
  LlmConfig,
  LlmProviderConfig,
  LlmTaskConfig,
} from '@gitroom/nestjs-libraries/llm/llm.types';

@Injectable()
export class LlmConfigService {
  private config?: LlmConfig;

  getTaskConfig(task: string): LlmTaskConfig | null {
    const config = this.loadConfig();
    if (!config) {
      return null;
    }

    const providerName = config.defaultProvider;
    const provider = config.providers[providerName];
    if (!provider) {
      return null;
    }

    const model = provider.models[task];
    const apiKey = process.env[provider.apiKeyEnv];
    if (!model || !apiKey) {
      return null;
    }

    return {
      providerName,
      provider,
      model,
      apiKey,
    };
  }

  private loadConfig(): LlmConfig | null {
    if (this.config) {
      return this.config;
    }

    const configPath = [
      join(process.cwd(), 'config', 'llm.yaml'),
      join(process.cwd(), '..', 'config', 'llm.yaml'),
      join(process.cwd(), '..', '..', 'config', 'llm.yaml'),
    ].find((path) => existsSync(path));

    if (!configPath) {
      return null;
    }

    const parsed = parse(readFileSync(configPath, 'utf8')) as unknown;
    if (!this.isLlmConfig(parsed)) {
      return null;
    }

    this.config = parsed;
    return this.config;
  }

  private isLlmConfig(value: unknown): value is LlmConfig {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<LlmConfig>;
    if (typeof candidate.defaultProvider !== 'string' || !candidate.providers || typeof candidate.providers !== 'object') {
      return false;
    }

    return Object.values(candidate.providers).every((provider) => this.isProviderConfig(provider));
  }

  private isProviderConfig(value: unknown): value is LlmProviderConfig {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<LlmProviderConfig>;
    return (
      candidate.type === 'openai-compatible' &&
      typeof candidate.baseUrl === 'string' &&
      typeof candidate.apiKeyEnv === 'string' &&
      !!candidate.models &&
      typeof candidate.models === 'object' &&
      Object.values(candidate.models).every((model) => typeof model === 'string')
    );
  }
}
