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

export class LLMGateway {
  private apiKey: string;
  private baseURL: string;
  private provider: LLMProvider;
  private defaultModel: string;

  constructor(apiKey?: string, provider: LLMProvider = 'together') {
    this.provider = provider;

    if (provider === 'together') {
      this.apiKey = apiKey || import.meta.env.VITE_TOGETHER_API_KEY || '';
      this.baseURL = 'https://api.together.xyz/v1';
      this.defaultModel = 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';
    } else {
      this.apiKey = apiKey || import.meta.env.VITE_OPENAI_API_KEY || '';
      this.baseURL = 'https://api.openai.com/v1';
      this.defaultModel = 'gpt-4';
    }
  }

  async complete(
    messages: LLMMessage[],
    config: LLMConfig = {}
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error(
        `LLM API key not configured. Please add ${
          this.provider === 'together' ? 'VITE_TOGETHER_API_KEY' : 'VITE_OPENAI_API_KEY'
        } to your .env file. Get your key from: ${
          this.provider === 'together'
            ? 'https://api.together.xyz/settings/api-keys'
            : 'https://platform.openai.com/api-keys'
        }`
      );
    }

    const startTime = Date.now();

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || this.defaultModel,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.max_tokens ?? 2000,
        top_p: config.top_p ?? 1.0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error (${this.provider}): ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    const rawContent = data.choices[0].message.content;
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
      tokens_used: data.usage?.total_tokens || 0,
      latency_ms: latency,
      model: data.model
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const embeddingModel = this.provider === 'together'
      ? 'togethercomputer/m2-bert-80M-8k-retrieval'
      : 'text-embedding-ada-002';

    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding API error (${this.provider}): ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
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
