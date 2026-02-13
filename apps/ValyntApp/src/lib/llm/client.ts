import type { LLMConfig, LLMRequest, LLMResponse, LLMMessage } from "./types";

const defaultConfig: LLMConfig = {
  provider: "openai",
  model: "gpt-4",
  maxTokens: 4096,
  temperature: 0.7,
};

class LLMClient {
  private config: LLMConfig;

  private isReleaseBuild(): boolean {
    return import.meta.env.PROD || process.env.NODE_ENV === "production";
  }

  constructor(config?: Partial<LLMConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  configure(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const config = { ...this.config, ...request.config };
    const lastMessage = request.messages[request.messages.length - 1];
    const prompt = lastMessage?.content;

    if (!prompt) {
      throw new Error("LLM completion requires at least one message with content");
    }

    const response = await fetch("/api/llm/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        prompt,
        model: config.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM completion error: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      success?: boolean;
      data?: {
        id?: string;
        content?: string;
        text?: string;
        model?: string;
        finishReason?: LLMResponse["finishReason"];
        usage?: Partial<LLMResponse["usage"]>;
      };
      error?: { message?: string };
    };

    if (!payload.success || !payload.data) {
      throw new Error(payload.error?.message || "LLM completion request failed");
    }

    const content = payload.data.content ?? payload.data.text;
    if (!content) {
      if (this.isReleaseBuild()) {
        throw new Error("LLM completion returned empty content in release build");
      }

      throw new Error("LLM completion returned empty content");
    }

    return {
      id: payload.data.id || `resp_${Date.now()}`,
      content,
      model: payload.data.model || config.model,
      usage: {
        promptTokens: payload.data.usage?.promptTokens ?? 0,
        completionTokens: payload.data.usage?.completionTokens ?? 0,
        totalTokens: payload.data.usage?.totalTokens ?? 0,
      },
      finishReason: payload.data.finishReason || "stop",
    };
  }

  async chat(messages: LLMMessage[], config?: Partial<LLMConfig>): Promise<string> {
    const response = await this.complete({ messages, config });
    return response.content;
  }

  async *stream(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    const config = { ...this.config, ...request.config };
    const messages = request.messages;
    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage?.content || "";

    const response = await fetch("/api/llm/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
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

export const llmClient = new LLMClient();

export function createLLMClient(config?: Partial<LLMConfig>): LLMClient {
  return new LLMClient(config);
}
