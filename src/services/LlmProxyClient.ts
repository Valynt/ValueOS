// import { logger } from '../lib/logger'; // Not used in this file
import { supabase } from "../lib/supabase";
import { securityLogger } from "./SecurityLogger";
import { sanitizeLLMContent } from "../utils/security";
import { llmSanitizer } from "./LLMSanitizer";
import type {
  LLMConfig,
  LLMMessage,
  LLMProvider,
  LLMResponse,
  LLMStreamCallback,
  LLMTool,
} from "../lib/agent-fabric/llm-types";
import { webSocketManager } from "./WebSocketManager";
import type { WebSocketMessage } from "./WebSocketManager";

interface ProxyChatRequest {
  messages: LLMMessage[];
  config?: LLMConfig;
  provider?: LLMProvider;
  maxResponseLength?: number; // Configurable response length limit
}

interface ProxyToolsRequest extends ProxyChatRequest {
  tools: LLMTool[];
}

interface ProxyEmbeddingRequest {
  input: string;
  provider?: LLMProvider;
}

class LlmProxyClient {
  async complete({
    messages,
    config,
    provider,
    maxResponseLength = 4000,
  }: ProxyChatRequest): Promise<LLMResponse> {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
      return {
        content: "",
        tokens_used: 0,
        latency_ms: 0,
        model: config?.model || "test-model",
      };
    }

    const sanitizedMessages = messages.map((msg) => {
      const result = llmSanitizer.sanitizePrompt(msg.content);
      if (result.violations.length > 0) {
        securityLogger.log({
          category: "llm",
          action: "prompt-sanitized",
          severity: "warn",
          metadata: { violations: result.violations },
        });
      }
      return { ...msg, content: result.content };
    });

    const { data, error } = await supabase.functions.invoke("llm-proxy", {
      body: {
        type: "chat",
        messages: sanitizedMessages,
        config,
        provider,
      },
    });

    if (error) {
      securityLogger.log({
        category: "llm",
        action: "proxy-error",
        severity: "error",
        metadata: { message: error.message },
      });
      throw new Error(`LLM proxy failed: ${error.message}`);
    }

    const legacySanitized = sanitizeLLMContent(data.content);
    const result = llmSanitizer.sanitizeResponse(legacySanitized, {
      allowHtml: false,
    });
    const boundedContent = result.content.slice(0, maxResponseLength);

    if (
      result.wasModified ||
      result.violations.length > 0 ||
      boundedContent.length < result.content.length
    ) {
      securityLogger.log({
        category: "llm",
        action: "response-sanitized",
        severity: result.violations.length > 0 ? "warn" : "info",
        metadata: {
          provider: data.provider,
          violations: result.violations,
          truncated: boundedContent.length < result.content.length,
        },
      });
    }

    return {
      content: boundedContent,
      tokens_used: data.tokens_used,
      latency_ms: data.latency_ms,
      model: data.model,
    };
  }

  async completeWithTools({
    messages,
    tools,
    config,
    provider,
  }: ProxyToolsRequest): Promise<LLMResponse> {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
      return {
        content: "Test response",
        tokens_used: 0,
        latency_ms: 0,
        model: config?.model || "test-model",
      };
    }

    const sanitizedMessages = messages.map((msg) => ({
      ...msg,
      content: msg.content
        ? llmSanitizer.sanitizePrompt(msg.content).content
        : "",
    }));

    const { data, error } = await supabase.functions.invoke("llm-proxy", {
      body: {
        type: "chat_with_tools",
        messages: sanitizedMessages,
        tools,
        config,
        provider,
      },
    });

    if (error) {
      securityLogger.log({
        category: "llm",
        action: "proxy-tools-error",
        severity: "error",
        metadata: { message: error.message },
      });
      throw new Error(`LLM proxy with tools failed: ${error.message}`);
    }

    const sanitizedContent = data.content
      ? sanitizeLLMContent(data.content)
      : "";

    return {
      content: sanitizedContent,
      tokens_used: data.tokens_used || 0,
      latency_ms: data.latency_ms || 0,
      model: data.model,
      tool_calls: data.tool_calls,
      finish_reason: data.finish_reason,
    };
  }

  async generateEmbedding({
    input,
    provider,
  }: ProxyEmbeddingRequest): Promise<number[]> {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
      return Array(10).fill(0);
    }

    const { data, error } = await supabase.functions.invoke("llm-proxy", {
      body: {
        type: "embedding",
        input,
        provider,
      },
    });

    if (error) {
      securityLogger.log({
        category: "llm",
        action: "proxy-embedding-error",
        severity: "error",
        metadata: { message: error.message },
      });
      throw new Error(`LLM embedding proxy failed: ${error.message}`);
    }

    return data.embedding;
  }

  async completeStream(
    { messages, config, provider }: ProxyChatRequest,
    onChunk: LLMStreamCallback,
    sessionId: string,
    timeoutMs: number = 30000
  ): Promise<void> {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
      // Simulate streaming for tests
      const chunks = ["Hello", " world", "!"];
      for (const chunk of chunks) {
        onChunk({ content: chunk });
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      onChunk({ content: "", finish_reason: "stop" });
      return;
    }

    const sanitizedMessages = messages.map((msg) => {
      const result = llmSanitizer.sanitizePrompt(msg.content);
      if (result.violations.length > 0) {
        securityLogger.log({
          category: "llm",
          action: "prompt-sanitized",
          severity: "warn",
          metadata: { violations: result.violations },
        });
      }
      return { ...msg, content: result.content };
    });

    // For streaming, we'll use WebSocket to receive chunks
    // First, send the request via WebSocket
    const requestMessage = {
      type: "llm_stream_request",
      payload: {
        messages: sanitizedMessages,
        config,
        provider,
        sessionId,
      },
      timestamp: Date.now(),
      messageId: `llm-stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    return new Promise<void>((resolve, reject) => {
      let isComplete = false;
      let lastChunkTime = Date.now();

      // Timeout handler to prevent memory leaks
      const timeoutId = setTimeout(() => {
        if (!isComplete) {
          isComplete = true;
          webSocketManager.removeListener("message", handleChunk);
          reject(new Error(`Stream timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      // Listen for streaming chunks
      const handleChunk = (message: WebSocketMessage) => {
        if (
          message.type === "llm_stream_chunk" &&
          message.payload.sessionId === sessionId
        ) {
          lastChunkTime = Date.now();
          const chunk = message.payload.chunk;
          const sanitizedContent = sanitizeLLMContent(chunk.content || "");
          const result = llmSanitizer.sanitizeResponse(sanitizedContent, {
            allowHtml: false,
          });

          onChunk({
            content: result.content,
            tokens_used: chunk.tokens_used,
            finish_reason: chunk.finish_reason,
          });

          if (chunk.finish_reason) {
            // Remove listener when done
            isComplete = true;
            clearTimeout(timeoutId);
            webSocketManager.removeListener("message", handleChunk);
            resolve();
          }
        }
      };

      webSocketManager.on("message", handleChunk);

      // Send the request
      webSocketManager.send(requestMessage).catch((err) => {
        if (!isComplete) {
          isComplete = true;
          clearTimeout(timeoutId);
          webSocketManager.removeListener("message", handleChunk);
          reject(err);
        }
      });
    });
  }
}

export const llmProxyClient = new LlmProxyClient();
