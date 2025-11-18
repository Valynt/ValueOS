import { supabase } from '../lib/supabase';
import { securityLogger } from './SecurityLogger';
import { sanitizeLLMContent } from '../utils/security';
import type { LLMConfig, LLMMessage, LLMResponse, LLMProvider } from '../lib/agent-fabric/LLMGateway';

interface ProxyChatRequest {
  messages: LLMMessage[];
  config?: LLMConfig;
  provider?: LLMProvider;
}

interface ProxyEmbeddingRequest {
  input: string;
  provider?: LLMProvider;
}

class LlmProxyClient {
  async complete({ messages, config, provider }: ProxyChatRequest): Promise<LLMResponse> {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return {
        content: '',
        tokens_used: 0,
        latency_ms: 0,
        model: config?.model || 'test-model',
      };
    }

    const { data, error } = await supabase.functions.invoke('llm-proxy', {
      body: {
        type: 'chat',
        messages,
        config,
        provider,
      },
    });

    if (error) {
      securityLogger.log({
        category: 'llm',
        action: 'proxy-error',
        severity: 'error',
        metadata: { message: error.message },
      });
      throw new Error(`LLM proxy failed: ${error.message}`);
    }

    const sanitizedContent = sanitizeLLMContent(data.content);

    if (sanitizedContent !== data.content) {
      securityLogger.log({
        category: 'llm',
        action: 'response-sanitized',
        severity: 'info',
        metadata: { provider: data.provider },
      });
    }

    return {
      content: sanitizedContent,
      tokens_used: data.tokens_used,
      latency_ms: data.latency_ms,
      model: data.model,
    };
  }

  async generateEmbedding({ input, provider }: ProxyEmbeddingRequest): Promise<number[]> {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return Array(10).fill(0);
    }

    const { data, error } = await supabase.functions.invoke('llm-proxy', {
      body: {
        type: 'embedding',
        input,
        provider,
      },
    });

    if (error) {
      securityLogger.log({
        category: 'llm',
        action: 'proxy-embedding-error',
        severity: 'error',
        metadata: { message: error.message },
      });
      throw new Error(`LLM embedding proxy failed: ${error.message}`);
    }

    return data.embedding;
  }
}

export const llmProxyClient = new LlmProxyClient();
