// Re-export types from shared file to maintain backwards compatibility
export type {
  LLMMessage,
  LLMResponse,
  LLMConfig,
  LLMProvider,
  LLMTool,
  LLMToolCall,
} from "./llm-types";
import type {
  LLMConfig,
  LLMMessage,
  LLMProvider,
  LLMResponse,
  LLMStreamCallback,
  LLMTool,
} from "./llm-types";

import { sanitizeLLMContent } from "../../utils/security";
import { securityLogger } from "../../services/SecurityLogger";
import { llmProxyClient } from "../../services/LlmProxyClient";
import { AgentCircuitBreaker } from "./CircuitBreaker";
import {
  addSpanAttributes,
  addSpanEvent,
  getCurrentTraceContext,
  metrics,
  traceLLMOperation,
} from "../../config/telemetry";
import type TaskContext from "./TaskContext";
import { llmCostTracker } from "../../services/LLMCostTracker";
import { trackUsage } from "../../services/UsageTrackingService";
import { logger } from "../../lib/logger";
import { clientRateLimit } from "../../services/ClientRateLimit";
import { CircuitBreakerManager } from "../../services/CircuitBreaker";
import { llmSanitizer } from "../../services/LLMSanitizer";

/**
 * API Key Rotation Manager for LLM providers
 * Provides automatic key rotation for enhanced security and rate limit management
 */
class KeyRotationManager {
  private provider: LLMProvider;
  private keys: string[] = [];
  private currentKeyIndex = 0;
  private keyUsageCounts: Map<string, number> = new Map();
  private keyLastUsed: Map<string, number> = new Map();
  private maxRequestsPerKey = 1000; // Rotate after 1000 requests
  private maxKeyAgeHours = 24; // Rotate after 24 hours

  constructor(provider: LLMProvider) {
    this.provider = provider;
    this.loadKeys();
  }

  /**
   * Load API keys from environment variables
   */
  private loadKeys(): void {
    const keyPrefixes =
      this.provider === "together"
        ? ["TOGETHER_API_KEY", "TOGETHER_API_KEY_2", "TOGETHER_API_KEY_3"]
        : ["OPENAI_API_KEY", "OPENAI_API_KEY_2", "OPENAI_API_KEY_3"];

    for (const prefix of keyPrefixes) {
      const key = process.env[prefix];
      if (key && key.trim()) {
        // Basic validation: API keys should be non-empty strings
        const trimmedKey = key.trim();
        if (trimmedKey.length < 10) {
          logger.warn(
            `API key for ${prefix} appears too short, may be invalid`,
            {
              keyLength: trimmedKey.length,
            }
          );
        }
        this.keys.push(trimmedKey);
      }
    }

    // Validate that at least one key was loaded
    if (this.keys.length === 0) {
      const errorMsg = `No valid API keys found for provider ${this.provider}. Please set environment variables: ${keyPrefixes.join(", ")}`;
      logger.error("LLM Gateway startup failed: no API keys", {
        provider: this.provider,
        requiredEnvVars: keyPrefixes,
      });
      throw new Error(errorMsg);
    }

    logger.info(
      `Loaded ${this.keys.length} API keys for provider ${this.provider}`
    );
  }

  /**
   * Get the next available API key with rotation logic
   */
  getNextKey(): string {
    if (this.keys.length === 0) {
      throw new Error(`No API keys available for provider ${this.provider}`);
    }

    if (this.keys.length === 1) {
      // Only one key available, return it
      return this.keys[0];
    }

    // Find the best key to use (least recently used, within limits)
    let bestKeyIndex = this.currentKeyIndex;
    let bestKeyScore = this.calculateKeyScore(this.keys[bestKeyIndex]);

    for (let i = 0; i < this.keys.length; i++) {
      const score = this.calculateKeyScore(this.keys[i]);
      if (score > bestKeyScore) {
        bestKeyIndex = i;
        bestKeyScore = score;
      }
    }

    this.currentKeyIndex = bestKeyIndex;
    const selectedKey = this.keys[bestKeyIndex];

    // Update usage tracking
    const currentCount = this.keyUsageCounts.get(selectedKey) || 0;
    this.keyUsageCounts.set(selectedKey, currentCount + 1);
    this.keyLastUsed.set(selectedKey, Date.now());

    logger.debug(`Selected API key for ${this.provider}`, {
      keyIndex: bestKeyIndex,
      usageCount: currentCount + 1,
      totalKeys: this.keys.length,
    });

    return selectedKey;
  }

  /**
   * Calculate a score for key selection (higher is better)
   * Considers usage count and time since last use
   */
  private calculateKeyScore(key: string): number {
    const usageCount = this.keyUsageCounts.get(key) || 0;
    const lastUsed = this.keyLastUsed.get(key) || 0;
    const hoursSinceLastUse = (Date.now() - lastUsed) / (1000 * 60 * 60);

    // Penalize heavily used keys and recently used keys
    const usagePenalty = Math.min(usageCount / this.maxRequestsPerKey, 1);
    const recencyPenalty = Math.max(
      0,
      1 - hoursSinceLastUse / this.maxKeyAgeHours
    );

    return 1 - (usagePenalty * 0.7 + recencyPenalty * 0.3);
  }

  /**
   * Mark a key as failed (for circuit breaker pattern)
   */
  markKeyFailed(key: string): void {
    logger.warn(`Marking API key as failed for provider ${this.provider}`, {
      keyIndex: this.keys.indexOf(key),
      usageCount: this.keyUsageCounts.get(key) || 0,
    });

    // Could implement exponential backoff or key quarantine here
    // For now, just log and continue with rotation
  }

  /**
   * Get key rotation statistics
   */
  getRotationStats(): {
    totalKeys: number;
    currentKeyIndex: number;
    keyUsageStats: Array<{
      index: number;
      usageCount: number;
      lastUsed: number;
    }>;
  } {
    return {
      totalKeys: this.keys.length,
      currentKeyIndex: this.currentKeyIndex,
      keyUsageStats: this.keys.map((key, index) => ({
        index,
        usageCount: this.keyUsageCounts.get(key) || 0,
        lastUsed: this.keyLastUsed.get(key) || 0,
      })),
    };
  }
}

export class LLMGateway {
  private provider: LLMProvider;
  private defaultModel: string;
  private gatingEnabled: boolean;
  private lowCostModel: string;
  private highCostModel: string;
  private static circuitBreakerManager = new CircuitBreakerManager();
  private keyRotationManager: KeyRotationManager;

  constructor(
    provider: LLMProvider = "together",
    enableGating: boolean = true
  ) {
    this.provider = provider;
    this.gatingEnabled = enableGating;
    this.keyRotationManager = new KeyRotationManager(provider);

    if (provider === "together") {
      this.defaultModel = "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo";
      this.lowCostModel = "microsoft/phi-4-mini";
      this.highCostModel = "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo";
    } else {
      this.defaultModel = "gpt-4";
      this.lowCostModel = "gpt-3.5-turbo";
      this.highCostModel = "gpt-4";
    }
  }

  /**
   * Validate tracing context and set up initial checks
   */
  private validateAndSetupTracing(taskContext?: TaskContext): void {
    const strictTracing =
      (process.env.VITE_STRICT_TRACING_ENFORCE || "false") === "true";
    const currentTrace = getCurrentTraceContext();
    if (strictTracing && !currentTrace) {
      logger.error(
        "LLMGateway complete aborted - missing trace context (strict tracing enforcement enabled)",
        { taskContext }
      );
      throw new Error("LLM call aborted: missing trace/span context");
    }
  }

  /**
   * Perform pre-call safety checks (rate limiting, circuit breaker)
   */
  private async performPreCallChecks(
    circuitBreaker?: AgentCircuitBreaker
  ): Promise<void> {
    // Apply rate limiting to prevent LLM API abuse
    const rateLimitAllowed = await clientRateLimit.checkLimit("llm-calls");
    if (!rateLimitAllowed) {
      throw new Error("LLM rate limit exceeded. Please try again later.");
    }

    // Track LLM call in circuit breaker
    if (circuitBreaker) {
      circuitBreaker.recordLLMCall();
      circuitBreaker.checkMemory();

      if (circuitBreaker.shouldAbort()) {
        throw new Error("LLM call aborted by circuit breaker");
      }
    }
  }

  /**
   * Apply LLM gating logic to determine model selection
   */
  private async applyGatingLogic(
    config: LLMConfig,
    taskContext?: TaskContext
  ): Promise<string> {
    let selectedModel = config.force_model || config.model || this.defaultModel;

    if (
      this.gatingEnabled &&
      config.use_gating !== false &&
      !config.force_model
    ) {
      const shouldInvoke = await this.shouldInvoke(selectedModel, taskContext);
      if (!shouldInvoke.invoke) {
        // Use low-cost model or heuristic
        if (shouldInvoke.useHeuristic) {
          return "heuristic";
        }
        selectedModel = this.lowCostModel;
      }
    }

    return selectedModel;
  }

  /**
   * Execute the actual LLM call with tracing and metrics
   */
  private async executeLLMCall(
    messages: LLMMessage[],
    config: LLMConfig,
    selectedModel: string,
    taskContext?: TaskContext,
    circuitBreaker?: AgentCircuitBreaker
  ): Promise<LLMResponse> {
    // Run operation in a tracing span to capture metrics and trace context
    const spanResult = await traceLLMOperation(
      "complete",
      {
        provider: this.provider === "together" ? "together_ai" : "openai",
        model: selectedModel,
        userId: taskContext?.userId,
        promptLength: JSON.stringify(messages).length,
      },
      async (_span) => {
        addSpanEvent("llm.request.started", {
          model: selectedModel,
          sessionId: taskContext?.sessionId,
          tenantId: taskContext?.organizationId,
        });

        const response = await LLMGateway.circuitBreakerManager.execute(
          `llm-provider-${this.provider}`,
          () =>
            llmProxyClient.complete({
              messages,
              config: {
                model: selectedModel,
                temperature: config.temperature,
                max_tokens: config.max_tokens,
                top_p: config.top_p,
              },
              provider: this.provider,
            })
        );

        addSpanAttributes({
          "llm.tokens_used": response.tokens_used || 0,
          "llm.latency_ms": response.latency_ms || 0,
          "llm.model": response.model,
        });

        addSpanEvent("llm.request.completed", { cost_estimate: 0 });

        // Metrics
        metrics.llmRequestsTotal.add(1, {
          provider: this.provider,
          model: selectedModel,
          tenant_id:
            taskContext?.organizationId || taskContext?.userId || "unknown",
        });
        metrics.llmRequestDuration.record(response.latency_ms || 0, {
          provider: this.provider,
          model: selectedModel,
          tenant_id:
            taskContext?.organizationId || taskContext?.userId || "unknown",
        });

        // Estimate prompt / completion tokens if we only have total
        const totalTokens = response.tokens_used || 0;
        const promptTokens =
          taskContext?.estimatedPromptTokens ??
          this.estimatePromptTokens(messages, selectedModel);
        const completionTokens =
          taskContext?.estimatedCompletionTokens ??
          Math.max(0, totalTokens - promptTokens);

        if (totalTokens > 0) {
          metrics.llmTokensTotal.add(totalTokens, {
            provider: this.provider,
            model: selectedModel,
            type: "total",
            tenant_id:
              taskContext?.organizationId || taskContext?.userId || "unknown",
          });
          metrics.llmTokensTotal.add(promptTokens, {
            provider: this.provider,
            model: selectedModel,
            type: "prompt",
            tenant_id:
              taskContext?.organizationId || taskContext?.userId || "unknown",
          });
          metrics.llmTokensTotal.add(completionTokens, {
            provider: this.provider,
            model: selectedModel,
            type: "completion",
            tenant_id:
              taskContext?.organizationId || taskContext?.userId || "unknown",
          });
        }

        // Calculate and track cost (estimate) and persist a usage event for tenant billing
        try {
          const estimatedCost = llmCostTracker.calculateCost(
            response.model,
            promptTokens,
            completionTokens
          );

          metrics.llmCostTotal.add(estimatedCost, {
            provider: this.provider,
            model: response.model,
            tenant_id:
              taskContext?.organizationId || taskContext?.userId || "unknown",
          });
          // Track as usage event per-tenant
          if (taskContext?.organizationId) {
            await trackUsage({
              organizationId: taskContext.organizationId,
              type: "agent_call",
              amount: estimatedCost,
              metadata: {
                provider: this.provider,
                model: response.model,
                promptTokens,
                completionTokens,
                sessionId: taskContext.sessionId || null,
              },
              timestamp: new Date(),
            });
          }
        } catch (err) {
          logger.error("Failed to track LLM cost/usage", {
            err: err instanceof Error ? err.message : err,
          });
        }

        return response;
      }
    );

    const response = spanResult;

    return this.processResponse(
      response,
      messages,
      taskContext,
      circuitBreaker
    );
  }

  /**
   * Process the LLM response with sanitization and tracking
   */
  private async processResponse(
    response: LLMResponse,
    messages: LLMMessage[],
    taskContext?: TaskContext,
    circuitBreaker?: AgentCircuitBreaker
  ): Promise<LLMResponse> {
    const rawContent = response.content;

    // Enhanced sanitization using LLMSanitizer for comprehensive security
    const sanitizationResult = llmSanitizer.sanitizeResponse(rawContent, {
      allowHtml: false,
      allowScripts: false,
      maxLength: 50000,
      contentPolicies: [
        "no-credentials",
        "no-personal-data",
        "no-malicious-code",
      ],
    });

    const sanitizedContent = sanitizationResult.content;

    // Log security violations if any
    if (
      sanitizationResult.wasModified ||
      sanitizationResult.violations.length > 0
    ) {
      securityLogger.log({
        category: "llm",
        action: "response-enhanced-sanitized",
        severity: sanitizationResult.violations.length > 0 ? "warn" : "info",
        metadata: {
          provider: this.provider,
          violations: sanitizationResult.violations,
          wasModified: sanitizationResult.wasModified,
        },
      });

      if (sanitizationResult.violations.length > 0) {
        logger.warn("LLM response sanitization violations detected", {
          provider: this.provider,
          model: selectedModel,
          violations: sanitizationResult.violations,
        });
      }
    }

    // Calculate and record cost if circuit breaker provided
    const finalResponse = {
      content: sanitizedContent,
      tokens_used: response.tokens_used,
      latency_ms: response.latency_ms,
      model: response.model,
    };

    if (circuitBreaker && response.tokens_used && response.model) {
      // Estimate prompt/completion tokens from total tokens (following existing pattern)
      const totalTokens = response.tokens_used;
      const promptTokens =
        taskContext?.estimatedPromptTokens ??
        this.estimatePromptTokens(messages, response.model);
      const completionTokens =
        taskContext?.estimatedCompletionTokens ??
        Math.max(0, totalTokens - promptTokens);

      const cost = llmCostTracker.calculateCost(
        response.model,
        promptTokens,
        completionTokens
      );
      circuitBreaker.recordCost(cost);

      // Track usage in cost tracker for monitoring
      await llmCostTracker.trackUsage({
        userId: taskContext?.userId || "system",
        sessionId: taskContext?.sessionId,
        provider: this.provider === "together" ? "together_ai" : "openai",
        model: response.model,
        promptTokens,
        completionTokens,
        endpoint: "llm-gateway",
        success: true,
        latencyMs: response.latency_ms || 0,
      });
    }

    return finalResponse;
  }

  /**
   * Validate LLM messages and config parameters
   */
  private validateInputs(
    messages: LLMMessage[],
    config: LLMConfig,
    operation: string
  ): void {
    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error(`${operation}: messages must be a non-empty array`);
    }

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      if (!message || typeof message !== "object") {
        throw new Error(
          `${operation}: message at index ${i} must be an object`
        );
      }

      if (!message.role || typeof message.role !== "string") {
        throw new Error(
          `${operation}: message at index ${i} must have a valid role`
        );
      }

      if (!["user", "assistant", "system", "tool"].includes(message.role)) {
        throw new Error(
          `${operation}: message at index ${i} has invalid role: ${message.role}`
        );
      }

      if (
        message.content !== undefined &&
        typeof message.content !== "string"
      ) {
        throw new Error(
          `${operation}: message at index ${i} content must be a string or undefined`
        );
      }

      // Validate tool_calls if present
      if (message.tool_calls !== undefined) {
        if (!Array.isArray(message.tool_calls)) {
          throw new Error(
            `${operation}: message at index ${i} tool_calls must be an array`
          );
        }

        for (const toolCall of message.tool_calls) {
          if (
            !toolCall.id ||
            !toolCall.function ||
            !toolCall.function.name ||
            !toolCall.function.arguments
          ) {
            throw new Error(
              `${operation}: message at index ${i} has invalid tool_call structure`
            );
          }
        }
      }

      // Validate tool_call_id if present
      if (
        message.tool_call_id !== undefined &&
        typeof message.tool_call_id !== "string"
      ) {
        throw new Error(
          `${operation}: message at index ${i} tool_call_id must be a string`
        );
      }
    }

    // Validate config
    if (config.temperature !== undefined) {
      if (
        typeof config.temperature !== "number" ||
        config.temperature < 0 ||
        config.temperature > 2
      ) {
        throw new Error(
          `${operation}: temperature must be a number between 0 and 2`
        );
      }
    }

    if (config.max_tokens !== undefined) {
      if (
        typeof config.max_tokens !== "number" ||
        config.max_tokens < 1 ||
        config.max_tokens > 32768
      ) {
        throw new Error(
          `${operation}: max_tokens must be a number between 1 and 32768`
        );
      }
    }

    if (config.top_p !== undefined) {
      if (
        typeof config.top_p !== "number" ||
        config.top_p < 0 ||
        config.top_p > 1
      ) {
        throw new Error(`${operation}: top_p must be a number between 0 and 1`);
      }
    }

    if (config.model !== undefined && typeof config.model !== "string") {
      throw new Error(`${operation}: model must be a string`);
    }

    if (
      config.force_model !== undefined &&
      typeof config.force_model !== "string"
    ) {
      throw new Error(`${operation}: force_model must be a string`);
    }
  }

  async complete(
    messages: LLMMessage[],
    config: LLMConfig = {},
    taskContext?: TaskContext,
    circuitBreaker?: AgentCircuitBreaker
  ): Promise<LLMResponse> {
    // Validate inputs
    this.validateInputs(messages, config, "LLMGateway.complete");

    // Validate tracing context
    this.validateAndSetupTracing(taskContext);

    // Perform pre-call safety checks
    await this.performPreCallChecks(circuitBreaker);

    // Apply gating logic
    const selectedModel = await this.applyGatingLogic(config, taskContext);

    // Handle heuristic case
    if (selectedModel === "heuristic") {
      const heuristicResult = this.applyHeuristic(taskContext);
      return {
        content: heuristicResult || "",
        tokens_used: 0,
        latency_ms: 0,
        model: "heuristic",
      };
    }

    // Execute LLM call
    const response = await this.executeLLMCall(
      messages,
      config,
      selectedModel,
      taskContext,
      circuitBreaker
    );

    // Process response with sanitization and tracking
    return this.processResponse(
      response,
      messages,
      taskContext,
      circuitBreaker
    );
  }

  /**
   * Complete with tool calling support
   * Executes a conversation loop where LLM can call tools
   */
  async completeWithTools(
    messages: LLMMessage[],
    tools: LLMTool[],
    executeToolFn: (
      _name: string,
      _args: Record<string, unknown>
    ) => Promise<string>,
    config: LLMConfig = {},
    maxIterations: number = 5,
    taskContext?: Record<string, unknown>
  ): Promise<LLMResponse> {
    const currentMessages = [...messages];
    let iterations = 0;
    let finalResponse: LLMResponse | null = null;

    while (iterations < maxIterations) {
      iterations++;

      // Call LLM with tools
      const spanResult = await traceLLMOperation(
        "complete_with_tools",
        {
          provider: this.provider === "together" ? "together_ai" : "openai",
          model: config.model || this.defaultModel,
          promptLength: JSON.stringify(currentMessages).length,
        },
        async (_span) => {
          addSpanEvent("llm.request.started", {
            model: config.model || this.defaultModel,
          });

          const response = await LLMGateway.circuitBreakerManager.execute(
            `llm-provider-${this.provider}`,
            () =>
              llmProxyClient.completeWithTools({
                messages: currentMessages,
                tools,
                config: {
                  model: config.model || this.defaultModel,
                  temperature: config.temperature,
                  max_tokens: config.max_tokens,
                },
                provider: this.provider,
              })
          );

          addSpanAttributes({
            "llm.tokens_used": response.tokens_used || 0,
            "llm.latency_ms": response.latency_ms || 0,
          });
          addSpanEvent("llm.request.completed", {
            tool_calls: (response.tool_calls || []).length,
          });

          // Metrics
          metrics.llmRequestsTotal.add(1, {
            provider: this.provider,
            model: config.model || this.defaultModel,
            tenant_id:
              taskContext?.organizationId || taskContext?.userId || "unknown",
          });
          metrics.llmRequestDuration.record(response.latency_ms || 0, {
            provider: this.provider,
            model: config.model || this.defaultModel,
            tenant_id:
              taskContext?.organizationId || taskContext?.userId || "unknown",
          });

          // Track cost as in `complete()`
          const totalTokens = response.tokens_used || 0;
          const promptTokens =
            taskContext?.estimatedPromptTokens ??
            this.estimatePromptTokens(
              currentMessages,
              config.model || this.defaultModel
            );
          const completionTokens =
            taskContext?.estimatedCompletionTokens ??
            Math.max(0, totalTokens - promptTokens);
          if (totalTokens > 0) {
            metrics.llmTokensTotal.add(totalTokens, {
              provider: this.provider,
              model: config.model || this.defaultModel,
              type: "total",
              tenant_id:
                taskContext?.organizationId || taskContext?.userId || "unknown",
            });
            metrics.llmTokensTotal.add(promptTokens, {
              provider: this.provider,
              model: config.model || this.defaultModel,
              type: "prompt",
              tenant_id:
                taskContext?.organizationId || taskContext?.userId || "unknown",
            });
            metrics.llmTokensTotal.add(completionTokens, {
              provider: this.provider,
              model: config.model || this.defaultModel,
              type: "completion",
              tenant_id:
                taskContext?.organizationId || taskContext?.userId || "unknown",
            });
          }

          try {
            const estimatedCost = llmCostTracker.calculateCost(
              response.model,
              promptTokens,
              completionTokens
            );
            metrics.llmCostTotal.add(estimatedCost, {
              provider: this.provider,
              model: response.model,
              tenant_id:
                taskContext?.organizationId || taskContext?.userId || "unknown",
            });
            if (taskContext?.organizationId) {
              await trackUsage({
                organizationId: taskContext.organizationId,
                type: "agent_call",
                amount: estimatedCost,
                metadata: {
                  provider: this.provider,
                  model: response.model,
                  promptTokens,
                  completionTokens,
                },
                timestamp: new Date(),
              });
            }
          } catch (err) {
            logger.error("Failed to track LLM cost/usage", {
              err: err instanceof Error ? err.message : err,
            });
          }

          return response;
        }
      );

      const response = spanResult;

      // If no tool calls, we're done
      if (!response.tool_calls || response.tool_calls.length === 0) {
        finalResponse = response;
        break;
      }

      // Add assistant message with tool calls
      currentMessages.push({
        role: "assistant",
        content: response.content || "",
        tool_calls: response.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of response.tool_calls) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await withRetry(
            () => executeToolFn(toolCall.function.name, args),
            {
              maxRetries: 3,
              initialDelayMs: 200,
              shouldRetry: (err) => {
                // Retry unless explicitly marked as non-retryable or user error
                const msg = err instanceof Error ? err.message : String(err);
                if (
                  msg.includes("Validation Failed") ||
                  msg.includes("Invalid argument")
                )
                  return false;
                return true;
              },
            }
          );

          currentMessages.push({
            role: "tool",
            content: result,
            tool_call_id: toolCall.id,
          });
        } catch (error) {
          currentMessages.push({
            role: "tool",
            content: JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : "Tool execution failed",
            }),
            tool_call_id: toolCall.id,
          });
        }
      }
    }

    return (
      finalResponse || {
        content: "Maximum tool iterations reached",
        tokens_used: 0,
        latency_ms: 0,
        model: this.defaultModel,
      }
    );
  }

  async generateEmbedding(text: string): Promise<number[]> {
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

  // ============================================================================
  // LLM Gating Methods
  // ============================================================================

  /**
   * Determine if LLM should be invoked or if heuristic/low-cost model suffices
   */
  async shouldInvoke(
    model: string,
    taskContext?: Record<string, unknown>
  ): Promise<{
    invoke: boolean;
    useHeuristic: boolean;
    heuristicResult?: string;
    reason: string;
  }> {
    if (!taskContext) {
      return {
        invoke: true,
        useHeuristic: false,
        reason: "No context provided",
      };
    }

    // Estimate task complexity
    const complexity = this.estimateComplexity(taskContext);

    // Estimate confidence in existing knowledge
    const confidence = this.estimateConfidence(taskContext);

    // Low complexity + high confidence = use heuristic
    if (complexity < 0.3 && confidence > 0.8) {
      return {
        invoke: false,
        useHeuristic: true,
        heuristicResult: this.applyHeuristic(taskContext),
        reason: "Low complexity, high confidence - using heuristic",
      };
    }

    // Low complexity = use low-cost model
    if (complexity < 0.5) {
      return {
        invoke: false,
        useHeuristic: false,
        reason: "Low complexity - using low-cost model",
      };
    }

    // High complexity = use requested model
    return {
      invoke: true,
      useHeuristic: false,
      reason: "High complexity - using requested model",
    };
  }

  /**
   * Estimate task complexity (0-1 scale)
   */
  estimateComplexity(taskContext: Record<string, unknown>): number {
    let complexity = 0.5; // Base complexity

    // Factor in input size
    const inputSize = JSON.stringify(taskContext).length;
    complexity += Math.min(inputSize / 10000, 0.3);

    // Factor in task type
    if (taskContext.task_type) {
      const complexTaskTypes = [
        "system_analysis",
        "intervention_design",
        "outcome_engineering",
      ];
      if (complexTaskTypes.includes(taskContext.task_type)) {
        complexity += 0.2;
      }
    }

    // Factor in number of entities/relationships
    if (taskContext.entities && Array.isArray(taskContext.entities)) {
      complexity += Math.min(taskContext.entities.length / 50, 0.2);
    }

    return Math.min(complexity, 1);
  }

  /**
   * Estimate confidence in existing knowledge (0-1 scale)
   */
  estimateConfidence(taskContext: Record<string, unknown>): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence if we have similar past episodes
    if (
      taskContext.similar_episodes &&
      taskContext.similar_episodes.length > 0
    ) {
      confidence += 0.3;
    }

    // Higher confidence if task is well-defined
    if (taskContext.task_intent && taskContext.task_intent.length > 20) {
      confidence += 0.1;
    }

    // Lower confidence if context is sparse
    const contextSize = Object.keys(taskContext).length;
    if (contextSize < 3) {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(confidence, 1));
  }

  /**
   * Select model based on gating logic
   */
  selectModelBasedOnGating(taskContext?: Record<string, unknown>): string {
    if (!this.gatingEnabled || !taskContext) {
      return this.defaultModel;
    }

    const complexity = this.estimateComplexity(taskContext);

    if (complexity < 0.3) {
      return this.lowCostModel;
    } else if (complexity < 0.7) {
      return this.defaultModel;
    } else {
      return this.highCostModel;
    }
  }

  /**
   * Apply heuristic for simple tasks
   */
  private applyHeuristic(taskContext: Record<string, unknown>): string {
    // Simple pattern matching for common tasks
    if (taskContext.task_type === "status_check") {
      return JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    }

    if (taskContext.task_type === "simple_query") {
      return JSON.stringify({ result: "processed", data: taskContext });
    }

    return "";
  }

  /**
   * Get gating statistics
   */
  getGatingStats(): {
    enabled: boolean;
    lowCostModel: string;
    highCostModel: string;
  } {
    return {
      enabled: this.gatingEnabled,
      lowCostModel: this.lowCostModel,
      highCostModel: this.highCostModel,
    };
  }

  /**
   * Enable/disable gating
   */
  /**
   * Record streaming metrics with proper error handling
   */
  private async recordStreamingMetrics(
    model: string,
    latency: number,
    totalTokens: number,
    promptTokens: number,
    completionTokens: number,
    estimatedCost: number,
    taskContext?: TaskContext
  ): Promise<void> {
    const tenantId =
      taskContext?.organizationId || taskContext?.userId || "unknown";

    try {
      await Promise.all([
        metrics.llmRequestsTotal.then((m) =>
          m.add(1, {
            provider: this.provider,
            model,
            tenant_id: tenantId,
          })
        ),
        metrics.llmRequestDuration.then((m) =>
          m.record(latency, {
            provider: this.provider,
            model,
            tenant_id: tenantId,
          })
        ),
        metrics.llmTokensTotal.then((m) =>
          m.add(totalTokens, {
            provider: this.provider,
            model,
            type: "total",
            tenant_id: tenantId,
          })
        ),
        metrics.llmTokensTotal.then((m) =>
          m.add(promptTokens, {
            provider: this.provider,
            model,
            type: "prompt",
            tenant_id: tenantId,
          })
        ),
        metrics.llmTokensTotal.then((m) =>
          m.add(completionTokens, {
            provider: this.provider,
            model,
            type: "completion",
            tenant_id: tenantId,
          })
        ),
        metrics.llmCostTotal.then((m) =>
          m.add(estimatedCost, {
            provider: this.provider,
            model,
            tenant_id: tenantId,
          })
        ),
      ]);
    } catch (err) {
      // Re-throw to be caught by the caller
      throw new Error(
        `Failed to record streaming metrics: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Track streaming usage with proper error handling
   */
  private async trackStreamingUsage(
    taskContext: TaskContext,
    model: string,
    estimatedCost: number,
    promptTokens: number,
    completionTokens: number,
    latency: number
  ): Promise<void> {
    if (!taskContext.organizationId) {
      return;
    }

    try {
      await trackUsage({
        organizationId: taskContext.organizationId,
        type: "agent_call",
        amount: estimatedCost,
        metadata: {
          provider: this.provider,
          model,
          promptTokens,
          completionTokens,
          sessionId: taskContext.sessionId || null,
          latencyMs: latency,
        },
        timestamp: new Date(),
      });
    } catch (err) {
      // Re-throw to be caught by the caller
      throw new Error(
        `Failed to track streaming usage: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private estimateTokenCount(messages: Array<{ role: string; content: string; tool_calls?: unknown; tool_call_id?: string }>, model: string): number {
    let totalChars = 0;

    for (const message of messages) {
      // Add role overhead
      totalChars += message.role.length + 10; // ": " + quotes + comma

      // Add content length
      const content =
        typeof message.content === "string" ? message.content : "";
      totalChars += content.length;

      // Add tool_calls overhead if present
      if (message.tool_calls) {
        totalChars += JSON.stringify(message.tool_calls).length;
      }

      // Add tool_call_id overhead if present
      if (message.tool_call_id) {
        totalChars += message.tool_call_id.length + 20;
      }
    }

    // Model-specific token estimation (rough approximation)
    // GPT models: ~4 chars per token, Llama models: ~3.5 chars per token
    const charsPerToken = model.includes("gpt") ? 4 : 3.5;
    const estimatedTokens = Math.ceil(totalChars / charsPerToken);

    // Add 10% overhead for formatting and special tokens
    return Math.ceil(estimatedTokens * 1.1);
  }

  getSupportedModels(): string[] {
    if (this.provider === "together") {
      return [
        "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
        "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        "microsoft/phi-4-mini",
        "mistralai/Mixtral-8x7B-Instruct-v0.1",
        "mistralai/Mistral-7B-Instruct-v0.2",
        "Qwen/Qwen2.5-72B-Instruct-Turbo",
        "google/gemma-2-27b-it",
        "deepseek-ai/deepseek-llm-67b-chat",
      ];
    } else {
      return ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"];
    }
  }

  async completeStream(
    messages: LLMMessage[],
    onChunk: LLMStreamCallback,
    config: LLMConfig = {},
    taskContext?: TaskContext,
    circuitBreaker?: AgentCircuitBreaker,
    sessionId?: string
  ): Promise<void> {
    const strictTracing =
      (process.env.VITE_STRICT_TRACING_ENFORCE || "false") === "true";
    const currentTrace = getCurrentTraceContext();
    if (strictTracing && !currentTrace) {
      logger.error(
        "LLMGateway completeStream aborted - missing trace context (strict tracing enforcement enabled)",
        { taskContext }
      );
      throw new Error("LLM call aborted: missing trace/span context");
    }

    // Track LLM call in circuit breaker
    if (circuitBreaker) {
      circuitBreaker.recordLLMCall();
      circuitBreaker.checkMemory();

      if (circuitBreaker.shouldAbort()) {
        throw new Error("LLM call aborted by circuit breaker");
      }
    }

    // Apply LLM gating if enabled
    let selectedModel = config.force_model || config.model || this.defaultModel;

    if (
      this.gatingEnabled &&
      config.use_gating !== false &&
      !config.force_model
    ) {
      const shouldInvoke = await this.shouldInvoke(selectedModel, taskContext);
      if (!shouldInvoke.invoke) {
        // For streaming, we can't easily use heuristics, so just use low-cost model
        selectedModel = this.lowCostModel;
      }
    }

    // Run operation in a tracing span to capture metrics and trace context
    await traceLLMOperation(
      "complete_stream",
      {
        provider: this.provider === "together" ? "together_ai" : "openai",
        model: selectedModel,
        userId: taskContext?.userId,
        promptLength: JSON.stringify(messages).length,
      },
      async (_span) => {
        addSpanEvent("llm.stream.request.started", {
          model: selectedModel,
          sessionId: taskContext?.sessionId,
          tenantId: taskContext?.organizationId,
        });

        let totalTokens = 0;
        let startTime = Date.now();

        const wrappedOnChunk: LLMStreamCallback = (chunk) => {
          totalTokens += chunk.tokens_used || 0;

          // Sanitize the chunk content
          const sanitizedContent = sanitizeLLMContent(chunk.content);
          if (sanitizedContent !== chunk.content) {
            securityLogger.log({
              category: "llm",
              action: "stream-chunk-sanitized",
              severity: "info",
              metadata: { provider: this.provider },
            });
          }

          onChunk({
            ...chunk,
            content: sanitizedContent,
          });

          if (chunk.finish_reason) {
            const latency = Date.now() - startTime;

            addSpanAttributes({
              "llm.tokens_used": totalTokens,
              "llm.latency_ms": latency,
              "llm.model": selectedModel,
            });

            // Estimate prompt / completion tokens
            const promptTokens =
              typeof taskContext?.estimatedPromptTokens === "number"
                ? taskContext.estimatedPromptTokens
                : this.estimatePromptTokens(messages, selectedModel);
            const completionTokens =
              typeof taskContext?.estimatedCompletionTokens === "number"
                ? taskContext.estimatedCompletionTokens
                : Math.max(0, totalTokens - promptTokens);

            // Calculate and track cost
            const estimatedCost = llmCostTracker.calculateCost(
              selectedModel,
              promptTokens,
              completionTokens
            );

            addSpanEvent("llm.stream.request.completed", {
              cost_estimate: estimatedCost,
            });

            // Metrics
            if (totalTokens > 0) {
              // Note: metrics are async but we're in callback context
              // For streaming, metrics are recorded per chunk
              this.recordStreamingMetrics(
                selectedModel,
                latency,
                totalTokens,
                promptTokens,
                completionTokens,
                estimatedCost,
                taskContext
              ).catch((err) => {
                logger.error("Failed to record streaming metrics", {
                  err: err instanceof Error ? err.message : err,
                  model: selectedModel,
                  totalTokens,
                });
              });
            }

            // Track usage
            if (taskContext?.organizationId) {
              // Note: trackUsage is async but we're in a callback context
              // For streaming, cost tracking happens per chunk, not at completion
              this.trackStreamingUsage(
                taskContext,
                selectedModel,
                estimatedCost,
                promptTokens,
                completionTokens,
                latency
              ).catch((err) => {
                logger.error("Failed to track streaming usage", {
                  err: err instanceof Error ? err.message : err,
                  model: selectedModel,
                });
              });
            }
          }
        };

        const response = await LLMGateway.circuitBreakerManager.execute(
          `llm-provider-${this.provider}-stream`,
          () =>
            llmProxyClient.completeStream(
              {
                messages,
                config: {
                  model: selectedModel,
                  temperature: config.temperature,
                  max_tokens: config.max_tokens,
                  top_p: config.top_p,
                },
                provider: this.provider,
              },
              wrappedOnChunk,
              sessionId || "unknown"
            )
        );

        // Note: completeStream returns void, cost recording is handled in the callback above
      }
    );
  }
}
