import { apiClient } from "@/api/client/unified-api-client";

import type { LLMConfig, LLMMessage, LLMRequest, LLMResponse } from "./types";

const defaultConfig: LLMConfig = {
  provider: "openai",
  model: "gpt-4",
  maxTokens: 4096,
  temperature: 0.7,
};

class LLMClient {
  private config: LLMConfig;

  constructor(config?: Partial<LLMConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  configure(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const config = { ...this.config, ...request.config };
    const messages = request.messages;
    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage?.content || "";

    type LLMPayload = {
      success?: boolean;
      error?: string;
      message?: string;
      data?: {
        content?: string;
        model?: string;
        usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
      };
    };

    const response = await apiClient.post<LLMPayload>("/api/llm/chat", {
      prompt,
      messages,
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });

    // apiClient never throws — check transport-level success first
    if (!response.success) {
      throw new Error(response.error?.message ?? "LLM request failed");
    }

    const payload = response.data;

    // Check application-level success flag from the backend payload
    if (payload?.success === false) {
      const message = payload?.message || payload?.error || "LLM request failed";
      throw new Error(message);
    }

    const content = payload?.data?.content ?? "";
    if (isReleaseBuild() && content.trim().length === 0) {
      throw new Error("Empty LLM completion content is not allowed in release builds.");
    }

    return {
      id: `resp_${Date.now()}`,
      content,
      model: payload?.data?.model || config.model,
      usage: {
        promptTokens: payload?.data?.usage?.promptTokens ?? 0,
        completionTokens: payload?.data?.usage?.completionTokens ?? 0,
        totalTokens: payload?.data?.usage?.totalTokens ?? 0,
      },
      finishReason: "stop",
    };
  }

  async chat(messages: LLMMessage[], config?: Partial<LLMConfig>): Promise<string> {
    const response = await this.complete({ messages, config });
    return response.content;
  }

  // Raw fetch retained in stream(): apiClient does not expose the raw Response
  // body needed for SSE/streaming. Migrate when apiClient supports streaming.
  async *stream(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    const config = { ...this.config, ...request.config };
    const messages = request.messages;
    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage?.content || "";

    const response = await fetch("/api/llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model: config.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM stream error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (trimmed.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.error) throw new Error(data.error);
              if (data.content) yield data.content;
            } catch (e) {
              if (e instanceof Error && e.message === "Stream failed") throw e;
              // Ignore parse errors for malformed lines
              console.warn("Error parsing LLM stream chunk:", e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

function isReleaseBuild(): boolean {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return true;
  }

  return typeof import.meta !== "undefined" && Boolean(import.meta.env?.PROD);
}

export const llmClient = new LLMClient();

export function createLLMClient(config?: Partial<LLMConfig>): LLMClient {
  return new LLMClient(config);
}
