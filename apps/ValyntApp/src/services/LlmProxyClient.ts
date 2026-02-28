// import { logger } from '../lib/logger'; // Not used in this file
import { supabase } from '../lib/supabase';
import { securityLogger } from './SecurityLogger';
import { sanitizeLLMContent } from '../utils/security';
import { llmSanitizer } from './LLMSanitizer';
import type { LLMConfig, LLMMessage, LLMProvider, LLMResponse, LLMStreamCallback, LLMTool } from '../lib/agent-fabric/llm-types';
import { webSocketManager } from './WebSocketManager';
import type { WebSocketMessage } from './WebSocketManager';
import {
  createInputGuardrailTripwire,
  validateAlertDetails,
} from '../contracts/alert-details';

interface ProxyChatRequest {
  messages: LLMMessage[];
  config?: LLMConfig;
  provider?: LLMProvider;
  alertDetails?: unknown;
  traceId?: string;
  tenantId?: string;
  caseId?: string;
}

interface ProxyToolsRequest extends ProxyChatRequest {
  tools: LLMTool[];
}

interface ProxyEmbeddingRequest {
  input: string;
  provider?: LLMProvider;
}

const MAX_OUTPUT_LENGTH = 4000;

function validateAlertPayloadBoundary(request: Pick<ProxyChatRequest, "alertDetails" | "traceId" | "tenantId" | "caseId">): void {
  if (typeof request.alertDetails === "undefined") {
    return;
  }

  const validationResult = validateAlertDetails(request.alertDetails);
  if (validationResult.success) {
    return;
  }

  const tripwire = createInputGuardrailTripwire({
    violations: validationResult.violations,
    traceId: request.traceId,
    tenantId: request.tenantId,
    caseId: request.caseId,
  });

  securityLogger.log({
    category: 'llm',
    action: 'input-guardrail-tripwire',
    severity: 'warn',
    metadata: {
      traceId: tripwire.traceId,
      tenantId: tripwire.tenantId,
      caseId: tripwire.caseId,
      reasonCode: tripwire.code,
      violations: tripwire.violations,
    },
  });

  throw tripwire;
}

class LlmProxyClient {
  private sanitizeProxyResponse(content: string, provider?: string): string {
    const legacySanitized = sanitizeLLMContent(content);
    const result = llmSanitizer.sanitizeResponse(legacySanitized, { allowHtml: false });
    const boundedContent = result.content.slice(0, MAX_OUTPUT_LENGTH);

    if (result.wasModified || result.violations.length > 0 || boundedContent.length < result.content.length) {
      securityLogger.log({
        category: 'llm',
        action: 'response-sanitized',
        severity: result.violations.length > 0 ? 'warn' : 'info',
        metadata: {
          provider,
          violations: result.violations,
          truncated: boundedContent.length < result.content.length,
        },
      });
    }

    return boundedContent;
  }

  async complete({ messages, config, provider, alertDetails, traceId, tenantId, caseId }: ProxyChatRequest): Promise<LLMResponse> {
    validateAlertPayloadBoundary({ alertDetails, traceId, tenantId, caseId });
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return {
        content: '',
        tokens_used: 0,
        latency_ms: 0,
        model: config?.model || 'test-model',
      };
    }

    const sanitizedMessages = messages.map(msg => {
      const result = llmSanitizer.sanitizePrompt(msg.content);
      if (result.violations.length > 0) {
        securityLogger.log({
          category: 'llm',
          action: 'prompt-sanitized',
          severity: 'warn',
          metadata: { violations: result.violations },
        });
      }
      return { ...msg, content: result.content };
    });

    const { data, error } = await supabase.functions.invoke('llm-proxy', {
      body: {
        type: 'chat',
        messages: sanitizedMessages,
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

    return {
      content: this.sanitizeProxyResponse(data.content, data.provider),
      tokens_used: data.tokens_used,
      latency_ms: data.latency_ms,
      model: data.model,
    };
  }

  async completeWithTools({ messages, tools, config, provider, alertDetails, traceId, tenantId, caseId }: ProxyToolsRequest): Promise<LLMResponse> {
    validateAlertPayloadBoundary({ alertDetails, traceId, tenantId, caseId });
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return {
        content: 'Test response',
        tokens_used: 0,
        latency_ms: 0,
        model: config?.model || 'test-model',
      };
    }

    const sanitizedMessages = messages.map(msg => ({
      ...msg,
      content: msg.content ? llmSanitizer.sanitizePrompt(msg.content).content : '',
    }));

    const { data, error } = await supabase.functions.invoke('llm-proxy', {
      body: {
        type: 'chat_with_tools',
        messages: sanitizedMessages,
        tools,
        config,
        provider,
      },
    });

    if (error) {
      securityLogger.log({
        category: 'llm',
        action: 'proxy-tools-error',
        severity: 'error',
        metadata: { message: error.message },
      });
      throw new Error(`LLM proxy with tools failed: ${error.message}`);
    }

    return {
      content: this.sanitizeProxyResponse(data.content ?? '', data.provider),
      tokens_used: data.tokens_used || 0,
      latency_ms: data.latency_ms || 0,
      model: data.model,
      tool_calls: data.tool_calls,
      finish_reason: data.finish_reason,
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

  async completeStream(
    { messages, config, provider, alertDetails, traceId, tenantId, caseId }: ProxyChatRequest,
    onChunk: LLMStreamCallback,
    sessionId: string
  ): Promise<void> {
    validateAlertPayloadBoundary({ alertDetails, traceId, tenantId, caseId });

    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      // Simulate streaming for tests
      const chunks = ['Hello', ' world', '!'];
      for (const chunk of chunks) {
        onChunk({ content: chunk });
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      onChunk({ content: '', finish_reason: 'stop' });
      return;
    }

    const sanitizedMessages = messages.map(msg => {
      const result = llmSanitizer.sanitizePrompt(msg.content);
      if (result.violations.length > 0) {
        securityLogger.log({
          category: 'llm',
          action: 'prompt-sanitized',
          severity: 'warn',
          metadata: { violations: result.violations },
        });
      }
      return { ...msg, content: result.content };
    });

    // For streaming, we'll use WebSocket to receive chunks
    // First, send the request via WebSocket
    const requestMessage = {
      type: 'llm_stream_request',
      payload: {
        messages: sanitizedMessages,
        config,
        provider,
        sessionId,
      },
      timestamp: Date.now(),
      messageId: `llm-stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Listen for streaming chunks
    const handleChunk = (message: WebSocketMessage) => {
      if (message.type === 'llm_stream_chunk' && message.payload.sessionId === sessionId) {
        const chunk = message.payload.chunk;
        const sanitizedContent = sanitizeLLMContent(chunk.content || '');
        const result = llmSanitizer.sanitizeResponse(sanitizedContent, { allowHtml: false });

        onChunk({
          content: result.content,
          tokens_used: chunk.tokens_used,
          finish_reason: chunk.finish_reason,
        });

        if (chunk.finish_reason) {
          // Remove listener when done
          webSocketManager.removeListener('message', handleChunk);
        }
      }
    };

    webSocketManager.on('message', handleChunk);

    // Send the request
    await webSocketManager.send(requestMessage);
  }
}

export const llmProxyClient = new LlmProxyClient();
