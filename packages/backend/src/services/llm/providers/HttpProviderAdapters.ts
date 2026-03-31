import { egressFetch } from "../../../lib/egressClient.js";

import type {
  LLMProviderAdapter,
  ProviderCompletionRequest,
  ProviderCompletionResponse,
} from "./LLMProviderAdapter.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for fallback provider calls`);
  }
  return value;
}

/**
 * Timeout for LLM completion calls. LLM responses can be slow, so we use a
 * longer window than the generic egress default (30 s). Configurable via
 * LLM_PROVIDER_TIMEOUT_MS to allow tuning without a code change.
 */
const LLM_TIMEOUT_MS = (() => {
  const raw = process.env.LLM_PROVIDER_TIMEOUT_MS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90_000;
})();

export class OpenAIProviderAdapter implements LLMProviderAdapter {
  readonly provider = "openai" as const;

  async complete(
    request: ProviderCompletionRequest
  ): Promise<ProviderCompletionResponse> {
    const response = await egressFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: [{ role: "user", content: request.prompt }],
        max_tokens: request.maxTokens ?? 1000,
        temperature: request.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`OpenAI fallback failed (${response.status})`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      model?: string;
    };
    const promptTokens = payload.usage?.prompt_tokens ?? 0;
    const completionTokens = payload.usage?.completion_tokens ?? 0;
    return {
      content: payload.choices?.[0]?.message?.content ?? "",
      model: payload.model ?? request.model,
      promptTokens,
      completionTokens,
      totalTokens: payload.usage?.total_tokens ?? promptTokens + completionTokens,
    };
  }
}

export class AnthropicProviderAdapter implements LLMProviderAdapter {
  readonly provider = "anthropic" as const;

  async complete(
    request: ProviderCompletionRequest
  ): Promise<ProviderCompletionResponse> {
    const response = await egressFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": requireEnv("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens ?? 1000,
        temperature: request.temperature ?? 0.7,
        messages: [{ role: "user", content: request.prompt }],
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Anthropic fallback failed (${response.status})`);
    }
    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };
    const content = (payload.content ?? [])
      .filter((chunk) => chunk.type === "text")
      .map((chunk) => chunk.text ?? "")
      .join("");
    const promptTokens = payload.usage?.input_tokens ?? 0;
    const completionTokens = payload.usage?.output_tokens ?? 0;
    return {
      content,
      model: payload.model ?? request.model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }
}
