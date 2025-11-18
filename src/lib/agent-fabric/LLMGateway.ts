export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokens_used: number;
  latency_ms: number;
  model: string;
}

export interface LLMConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export type LLMProvider = 'together' | 'openai';

import { sanitizeLLMContent } from '../../utils/security';
import { securityLogger } from '../../services/SecurityLogger';
import { llmProxyClient } from '../../services/LlmProxyClient';

export class LLMGateway {
  private provider: LLMProvider;
  private defaultModel: string;

  constructor(provider: LLMProvider = 'together') {
    this.provider = provider;
    this.defaultModel = provider === 'together'
      ? 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'
      : 'gpt-4';
  }

  async complete(
    messages: LLMMessage[],
    config: LLMConfig = {}
  ): Promise<LLMResponse> {
    const response = await llmProxyClient.complete({
      messages,
      config: {
        model: config.model || this.defaultModel,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        top_p: config.top_p,
      },
      provider: this.provider,
    });

    const rawContent = response.content;
    const sanitizedContent = sanitizeLLMContent(rawContent);

    if (sanitizedContent !== rawContent) {
      securityLogger.log({
        category: 'llm',
        action: 'response-sanitized',
        severity: 'info',
        metadata: { provider: this.provider },
      });
    }

    return {
      content: sanitizedContent,
      tokens_used: response.tokens_used,
      latency_ms: response.latency_ms,
      model: response.model
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const embeddingModel = this.provider === 'together'
      ? 'togethercomputer/m2-bert-80M-8k-retrieval'
      : 'text-embedding-ada-002';

    return llmProxyClient.generateEmbedding({
      input: text,
      provider: this.provider,
    });
  }

  getProvider(): LLMProvider {
    return this.provider;
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  getSupportedModels(): string[] {
    if (this.provider === 'together') {
      return [
        'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        'mistralai/Mixtral-8x7B-Instruct-v0.1',
        'mistralai/Mistral-7B-Instruct-v0.2',
        'Qwen/Qwen2.5-72B-Instruct-Turbo',
        'google/gemma-2-27b-it',
        'deepseek-ai/deepseek-llm-67b-chat'
      ];
    } else {
      return [
        'gpt-4',
        'gpt-4-turbo',
        'gpt-3.5-turbo'
      ];
    }
  }
}
