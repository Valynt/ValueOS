/**
 * LLM Gateway
 *
 * Centralized gateway for LLM interactions with circuit breaker,
 * caching, telemetry, and multi-provider support.
 * Chat completions and streaming use the official together-ai SDK.
 */

import { SpanStatusCode } from "@opentelemetry/api";
import { getEnvVar } from "@shared/lib/env";

import { assertModelAllowed } from "../../config/models.js";
import { getTracer } from "../../config/telemetry.js";
import { LLMCostTracker } from "../../services/llm/LLMCostTracker.js";
import {
  enforceBudgetPolicy,
  enforceModelPolicy,
  recordPolicyAuditEvent,
} from "../../services/policy/PolicyEnforcement.js";
import { CostAwareRouter } from "../../services/post-v1/CostAwareRouter.js";
import { logger } from "../logger.js";

import {
  type CircuitBreakerStateInfo,
  type LLMResilienceConfig,
  LLMResilienceWrapper,
} from "./LLMResilience.js";
import { getCapabilities } from "./ModelRegistry.js";
import { getTogetherClient } from "./TogetherClient.js";

export interface LLMGatewayConfig {
  provider: "openai" | "anthropic" | "gemini" | "custom" | "together";
  model: string;
  temperature?: number;
  max_tokens?: number;
  timeout_ms?: number;
  enable_caching?: boolean;
  enable_telemetry?: boolean;
}

type TenantMetadata =
  | {
      tenantId: string;
      tenant_id?: never;
      organizationId?: never;
      organization_id?: never;
    }
  | {
      tenantId?: never;
      tenant_id: string;
      organizationId?: never;
      organization_id?: never;
    }
  | {
      tenantId?: never;
      tenant_id?: never;
      organizationId: string;
      organization_id?: never;
    }
  | {
      tenantId?: never;
      tenant_id?: never;
      organizationId?: never;
      organization_id: string;
    };

export type LLMRequestMetadata = TenantMetadata & {
  userId?: string;
  user_id?: string;
  sessionId?: string;
  session_id?: string;
  [key: string]: unknown;
};

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  metadata: LLMRequestMetadata;
  /**
   * JSON Schema object derived from the caller's Zod schema.
   * When present and the model supports structured outputs, the gateway
   * passes response_format: json_schema to the Together API.
   * Zod validation still runs post-response regardless.
   */
  responseSchema?: Record<string, unknown>;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  id: string;
  model: string;
  content: string;
  finish_reason: "stop" | "length" | "content_filter" | "error";
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  metadata?: Record<string, unknown>;
}

export class LLMGateway {
  private config: LLMGatewayConfig;
  private costTracker: LLMCostTracker;
  private costAwareRouter: CostAwareRouter;
  private resilienceWrapper: LLMResilienceWrapper;

  // Together-specific fallback settings (populated in constructor when provider==='together')
  private togetherPrimaryModel?: string;
  private togetherSecondaryModel?: string;
  private llmFallbackEnabled: boolean = true;
  private llmFallbackMaxAttempts: number = 1;
  private llmRetryBackoffMs: number = 200;

  constructor(
    config: LLMGatewayConfig | string,
    costTracker?: LLMCostTracker,
    resilienceConfig?: Partial<LLMResilienceConfig>
  ) {
    if (typeof config === "string") {
      // Backward compatibility: config is provider string
      this.config = {
        provider: config as "openai" | "anthropic" | "gemini" | "custom",
        model: "gpt-4",
        temperature: 0.7,
        max_tokens: 4096,
      };
    } else {
      this.config = config;
    }
    this.costTracker = costTracker || new LLMCostTracker();
    this.costAwareRouter = new CostAwareRouter(this.costTracker);
    this.resilienceWrapper = new LLMResilienceWrapper({
      providerKey: `llm:${this.config.provider}`,
      ...resilienceConfig,
    });

    // Load Together.ai-specific model + fallback settings when configured
    if (this.config.provider === "together") {
      this.togetherPrimaryModel =
        (getEnvVar("TOGETHER_PRIMARY_MODEL_NAME") as string) ||
        this.config.model;
      const secondary = getEnvVar("TOGETHER_SECONDARY_MODEL_NAME");
      this.togetherSecondaryModel = secondary ? String(secondary) : undefined;
      this.llmFallbackEnabled =
        (getEnvVar("LLM_FALLBACK_ENABLED", {
          defaultValue: "true",
        }) as string) !== "false";
      this.llmFallbackMaxAttempts = Number(
        getEnvVar("LLM_FALLBACK_MAX_ATTEMPTS") || "1"
      );
      this.llmRetryBackoffMs = Number(
        getEnvVar("LLM_RETRY_BACKOFF_MS") || "200"
      );
    }
  }

  protected async executeCompletion(
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    if (this.config.provider === "together") {
      return this.executeTogetherCompletion(request, startTime);
    }

    throw new Error("Provider not implemented: " + this.config.provider);
  }

  protected async executeTogetherCompletion(
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const model = request.model || this.config.model;
    assertModelAllowed("together_ai", model);

    const client = getTogetherClient();

    // Use structured outputs when the caller supplied a schema and the model supports it
    const capabilities = getCapabilities(model);
    const useStructuredOutputs =
      request.responseSchema != null &&
      (capabilities?.supportsStructuredOutputs ?? false);

    const response = await client.chat.completions.create({
      model,
      messages: request.messages,
      max_tokens: request.max_tokens ?? this.config.max_tokens ?? 1000,
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      ...(useStructuredOutputs
        ? {
            response_format: {
              type: "json_schema",
              schema: request.responseSchema as Record<string, string>,
            },
          }
        : {}),
    });

    return {
      id: response.id || `llm_${Date.now()}`,
      model,
      content: response.choices?.[0]?.message?.content || "",
      finish_reason:
        (response.choices?.[0]
          ?.finish_reason as LLMResponse["finish_reason"]) || "stop",
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
      metadata: {
        ...(request.metadata || {}),
        duration_ms: Date.now() - startTime,
        structured_outputs_used: useStructuredOutputs,
      },
    };
  }

  async *completeRawStream(
    request: LLMRequest
  ): AsyncGenerator<{
    content: string;
    done: boolean;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }> {
    if (this.config.provider !== "together") {
      throw new Error(
        "Raw streaming is only implemented for the Together provider."
      );
    }

    const model = request.model || this.config.model;
    assertModelAllowed("together_ai", model);

    const client = getTogetherClient();

    const stream = await client.chat.completions.create({
      model,
      messages: request.messages,
      max_tokens: request.max_tokens ?? this.config.max_tokens ?? 1000,
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      stream: true,
    });

    let usage:
      | {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        }
      | undefined;

    for await (const chunk of stream) {
      const chunkUsage = chunk.usage;
      if (chunkUsage) {
        usage = {
          prompt_tokens: chunkUsage.prompt_tokens || 0,
          completion_tokens: chunkUsage.completion_tokens || 0,
          total_tokens: chunkUsage.total_tokens || 0,
        };
      }
      const content = chunk.choices?.[0]?.delta?.content || "";
      if (content) {
        yield { content, done: false };
      }
    }

    yield { content: "", done: true, usage };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = request.model || this.config.model;
    const metadata = request.metadata ?? {};
    const userId = metadata.userId ?? metadata.user_id ?? "system";
    const tenantId =
      metadata.tenantId ??
      metadata.tenant_id ??
      metadata.organizationId ??
      metadata.organization_id;
    const sessionId = metadata.sessionId ?? metadata.session_id;
    const agentType = String(
      (metadata as Record<string, unknown>).agentType || "default"
    );

    if (!tenantId) {
      const error = new Error(
        "LLMGateway.complete requires tenant metadata (tenantId, tenant_id, organizationId, or organization_id)."
      );
      logger.error("LLM request missing tenant context", {
        endpoint: "llm-gateway.complete",
        metadata_keys: Object.keys(metadata),
      });
      throw error;
    }

    // SEC-011: Reject prompts that exceed the maximum input token budget.
    // Default 32 000 tokens (~128 KB of text). Configurable via env var.
    const maxInputTokens = Number(
      getEnvVar("LLM_MAX_INPUT_TOKENS", { defaultValue: "32000" })
    );
    const inputEstimate = this.estimateTokens(request.messages);
    if (inputEstimate > maxInputTokens) {
      const error = new Error(
        `LLM input too large: estimated ${inputEstimate} tokens exceeds limit of ${maxInputTokens}.`
      );
      logger.warn("LLM input length validation failed", {
        estimatedTokens: inputEstimate,
        maxInputTokens,
        tenantId,
        agentType,
      });
      throw error;
    }

    try {
      const modelPolicy = enforceModelPolicy(agentType, model);
      const estimatedPromptTokens = this.estimateTokens(request.messages);
      const estimatedCompletionTokens =
        request.max_tokens ?? this.config.max_tokens ?? 0;
      const estimatedCostUsd = this.estimateCostUsd(
        estimatedPromptTokens,
        estimatedCompletionTokens,
        model
      );
      const budgetPolicy = enforceBudgetPolicy(agentType, {
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
        estimatedCostUsd,
      });

      // Get routing decision
      const routingDecision = await this.costAwareRouter.routeRequest({
        tenantId,
        agentType,
        priority: (metadata as Record<string, unknown>).priority || "medium",
        tokenEstimate: estimatedPromptTokens,
        sessionId,
      });

      if (routingDecision.fallbackToBasic) {
        // Use FallbackAIService
        const { FallbackAIService } =
          await import("../../services/llm/FallbackAIService.js");
        const fallbackResponse = FallbackAIService.generateFallbackResponse(
          request.messages.map(m => m.content).join(" ")
        );

        return {
          id: `fallback_${Date.now()}`,
          model: "fallback",
          content: fallbackResponse,
          finish_reason: "stop",
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          metadata: {
            ...metadata,
            fallback: true,
            policyVersion: modelPolicy.policyVersion,
          },
        };
      }

      logger.info("LLM request initiated", {
        provider: this.config.provider,
        model,
        message_count: request.messages.length,
        tenant_id: tenantId,
      });

      const tracer = getTracer();
      const response = await tracer.startActiveSpan(
        "llm.complete",
        {
          attributes: {
            "llm.provider": this.config.provider,
            "llm.model": model,
          },
        },
        async (span: unknown) => {
          try {
            // MODEL SELECTION + RETRY/FALLBACK (Together-specific behavior)
            const requestedModel = request.model ?? this.config.model;
            let modelUsed = requestedModel;
            let retryAttempts = 0;
            let fallbackTriggered = false;
            let fallbackReason: string | null = null;

            // If provider is Together and caller didn't specify a model, prefer the configured primary
            if (this.config.provider === "together" && !request.model) {
              request.model = this.togetherPrimaryModel || this.config.model;
            }

            const isTransientError = (err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              return /timeout|ETIMEDOUT|429|5\d{2}|rate limit/i.test(msg);
            };

            const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

            const tryPrimaryWithRetries = async (): Promise<LLMResponse> => {
              const maxRetries = Math.max(0, this.llmFallbackMaxAttempts || 0);
              for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                  retryAttempts = attempt;
                  const res = await this.resilienceWrapper.execute(() =>
                    this.executeCompletion(request, startTime)
                  );
                  modelUsed = request.model || modelUsed;
                  // annotate metadata for caller
                  res.metadata = {
                    ...(res.metadata || {}),
                    retry_attempts: retryAttempts,
                  };
                  return res;
                } catch (err) {
                  // If not transient or we've exhausted retries -> rethrow
                  if (!isTransientError(err) || attempt === maxRetries)
                    throw err;
                  // backoff with small jitter
                  const base = this.llmRetryBackoffMs || 200;
                  const jitter = Math.floor(Math.random() * base);
                  await sleep(base + jitter);
                  continue;
                }
              }
              throw new Error("Primary model retries exhausted");
            };

            try {
              // Try primary (with configured retries)
              const primaryResult = await tryPrimaryWithRetries();
              // normal success
              const latencyMs = Date.now() - startTime;
              const costUsd = this.estimateCostUsd(
                primaryResult.usage?.prompt_tokens || 0,
                primaryResult.usage?.completion_tokens || 0,
                request.model || modelUsed
              );

              enforceBudgetPolicy(agentType, {
                totalTokens: primaryResult.usage?.total_tokens || 0,
                estimatedCostUsd: costUsd,
              });

              if (
                typeof span === "object" &&
                span !== null &&
                "setAttributes" in span &&
                "setStatus" in span &&
                "end" in span
              ) {
                (
                  span as {
                    setAttributes(attrs: Record<string, unknown>): void;
                  }
                ).setAttributes({
                  "llm.prompt_tokens": primaryResult.usage?.prompt_tokens || 0,
                  "llm.completion_tokens":
                    primaryResult.usage?.completion_tokens || 0,
                  "llm.total_tokens": primaryResult.usage?.total_tokens || 0,
                  "llm.cost_usd": costUsd,
                  "llm.latency_ms": latencyMs,
                  "llm.cached": false,
                });
                (span as { setStatus(status: unknown): void }).setStatus({
                  code: SpanStatusCode.OK,
                });
                (span as { end(): void }).end();
              }

              return primaryResult;
            } catch (primaryErr) {
              // If fallback is disabled or no secondary configured, rethrow
              if (!this.llmFallbackEnabled || !this.togetherSecondaryModel) {
                throw primaryErr;
              }

              // Attempt secondary model
              fallbackTriggered = true;
              fallbackReason =
                primaryErr instanceof Error
                  ? primaryErr.message
                  : String(primaryErr);
              logger.warn(
                "Primary Together model failed; attempting secondary",
                {
                  primary: request.model,
                  secondary: this.togetherSecondaryModel,
                  retry_attempts: retryAttempts,
                  fallback_reason: fallbackReason,
                }
              );

              // Use secondary model for the retry
              const secondaryRequest: LLMRequest = {
                ...request,
                model: this.togetherSecondaryModel,
              };
              const secondaryResult = await this.resilienceWrapper.execute(() =>
                this.executeCompletion(secondaryRequest, startTime)
              );

              // Annotate fallback metadata
              secondaryResult.metadata = {
                ...(secondaryResult.metadata || {}),
                fallback_triggered: true,
                fallback_reason: fallbackReason,
                retry_attempts: retryAttempts,
                policyVersion: budgetPolicy.policyVersion,
              };

              if (
                typeof span === "object" &&
                span !== null &&
                "setAttributes" in span &&
                "setStatus" in span &&
                "end" in span
              ) {
                (
                  span as {
                    setAttributes(attrs: Record<string, unknown>): void;
                  }
                ).setAttributes({ "llm.latency_ms": Date.now() - startTime });
                (span as { setStatus(status: unknown): void }).setStatus({
                  code: SpanStatusCode.OK,
                });
                (span as { end(): void }).end();
              }

              return secondaryResult;
            }
          } catch (err) {
            const latencyMs = Date.now() - startTime;
            if (
              typeof span === "object" &&
              span !== null &&
              "setAttributes" in span &&
              "setStatus" in span &&
              "recordException" in span &&
              "end" in span
            ) {
              (
                span as { setAttributes(attrs: Record<string, unknown>): void }
              ).setAttributes({ "llm.latency_ms": latencyMs });
              (
                span as {
                  setStatus(status: { code: number; message?: string }): void;
                }
              ).setStatus({
                code: SpanStatusCode.ERROR,
                message: err instanceof Error ? err.message : String(err),
              });
              if (err instanceof Error)
                (span as { recordException(err: Error): void }).recordException(
                  err
                );
              (span as { end(): void }).end();
            }
            throw err;
          }
        }
      );

      const latencyMs = Date.now() - startTime;
      const policyVersion = modelPolicy.policyVersion;
      response.metadata = { ...(response.metadata || {}), policyVersion };

      recordPolicyAuditEvent({
        eventType: "llm_call",
        agentType,
        policyVersion,
        metadata: {
          model,
          tenantId,
          totalTokens: response.usage?.total_tokens || 0,
        },
      });

      void this.costTracker.trackUsage({
        userId,
        tenantId,
        sessionId,
        provider: this.config.provider,
        model,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        caller: "LLMGateway.complete",
        endpoint: "llm-gateway.complete",
        success: true,
        latencyMs,
      });

      logger.info("LLM request completed", {
        duration_ms: response.metadata?.duration_ms,
        tokens: response.usage?.total_tokens,
        tenant_id: tenantId,
      });

      return response;
    } catch (error: unknown) {
      const latencyMs = Date.now() - startTime;
      void this.costTracker.trackUsage({
        userId,
        tenantId,
        sessionId,
        provider: this.config.provider,
        model,
        promptTokens: 0,
        completionTokens: 0,
        caller: "LLMGateway.complete",
        endpoint: "llm-gateway.complete",
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        latencyMs,
      });

      logger.error("LLM request failed", {
        error,
        tenant_id: tenantId,
        duration_ms: latencyMs,
      });
      throw error;
    }
  }

  async stream(
    request: LLMRequest,
    callback: (chunk: string) => void
  ): Promise<LLMResponse> {
    // Placeholder for streaming implementation
    logger.info("LLM stream request", { provider: this.config.provider });

    const fullResponse = await this.complete(request);
    callback(fullResponse.content);

    return fullResponse;
  }

  private estimateTokens(messages: LLMMessage[]): number {
    // Rough estimation: ~4 characters per token
    const totalChars = messages.reduce(
      (sum, msg) => sum + msg.content.length,
      0
    );
    return Math.ceil(totalChars / 4);
  }

  private estimateCostUsd(
    promptTokens: number,
    completionTokens: number,
    model: string
  ): number {
    // Rough per-token pricing (USD per 1K tokens)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      "gpt-4": { prompt: 0.03, completion: 0.06 },
      "gpt-4o": { prompt: 0.005, completion: 0.015 },
      "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
      "gpt-3.5-turbo": { prompt: 0.0005, completion: 0.0015 },
    };
    const rate = pricing[model] ?? { prompt: 0.01, completion: 0.03 };
    return (
      (promptTokens / 1000) * rate.prompt +
      (completionTokens / 1000) * rate.completion
    );
  }

  /**
   * Bypass resilience (no circuit breaker, no retry, no timeout).
   * Use when the caller handles its own retry/fallback logic.
   */
  async completeRaw(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    return this.executeCompletion(request, startTime);
  }

  /**
   * Observable circuit breaker state for the provider this gateway targets.
   */
  getCircuitBreakerState(): CircuitBreakerStateInfo {
    return this.resilienceWrapper.getCircuitBreakerState();
  }

  /**
   * Generate method for backward compatibility
   */
  async generate(prompt: string): Promise<string> {
    const response = await this.complete({
      messages: [{ role: "user", content: prompt }],
    });
    return response.content;
  }
}

export function createLLMGateway(config: LLMGatewayConfig): LLMGateway {
  return new LLMGateway(config);
}
