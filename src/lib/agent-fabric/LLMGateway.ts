// Re-export types from shared file to maintain backwards compatibility
export type { LLMMessage, LLMResponse, LLMConfig, LLMProvider, LLMTool, LLMToolCall } from './llm-types';
import type { LLMMessage, LLMResponse, LLMConfig, LLMProvider, LLMTool, LLMStreamCallback } from './llm-types';

import { sanitizeLLMContent } from '../../utils/security';
import { securityLogger } from '../../services/SecurityLogger';
import { llmProxyClient } from '../../services/LlmProxyClient';
import { AgentCircuitBreaker } from './CircuitBreaker';
import { traceLLMOperation, addSpanAttributes, addSpanEvent, metrics, getCurrentTraceContext } from '../../config/telemetry';
import type TaskContext from './TaskContext';
import { llmCostTracker } from '../../services/LLMCostTracker';
import { trackUsage } from '../../services/UsageTrackingService';
import { logger } from '../../lib/logger';
import { clientRateLimit } from '../../services/ClientRateLimit';

export class LLMGateway {
  private provider: LLMProvider;
  private defaultModel: string;
  private gatingEnabled: boolean;
  private lowCostModel: string;
  private highCostModel: string;

  constructor(provider: LLMProvider = 'together', enableGating: boolean = true) {
    this.provider = provider;
    this.gatingEnabled = enableGating;
    
    if (provider === 'together') {
      this.defaultModel = 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';
      this.lowCostModel = 'microsoft/phi-4-mini';
      this.highCostModel = 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';
    } else {
      this.defaultModel = 'gpt-4';
      this.lowCostModel = 'gpt-3.5-turbo';
      this.highCostModel = 'gpt-4';
    }
  }

  async complete(
    messages: LLMMessage[],
    config: LLMConfig = {},
    taskContext?: TaskContext,
    circuitBreaker?: AgentCircuitBreaker
  ): Promise<LLMResponse> {
    const strictTracing = (process.env.VITE_STRICT_TRACING_ENFORCE || 'false') === 'true';
    const currentTrace = getCurrentTraceContext();
    if (strictTracing && !currentTrace) {
      logger.error('LLMGateway complete aborted - missing trace context (strict tracing enforcement enabled)', { taskContext });
      throw new Error('LLM call aborted: missing trace/span context');
    }

    // Apply rate limiting to prevent LLM API abuse
    const rateLimitAllowed = await clientRateLimit.checkLimit('llm-calls');
    if (!rateLimitAllowed) {
      throw new Error('LLM rate limit exceeded. Please try again later.');
    }

    // Track LLM call in circuit breaker
    if (circuitBreaker) {
      circuitBreaker.recordLLMCall();
      circuitBreaker.checkMemory();
      
      if (circuitBreaker.shouldAbort()) {
        throw new Error('LLM call aborted by circuit breaker');
      }
    }
    // Apply LLM gating if enabled
    let selectedModel = config.force_model || config.model || this.defaultModel;
    
    if (this.gatingEnabled && config.use_gating !== false && !config.force_model) {
      const shouldInvoke = await this.shouldInvoke(selectedModel, taskContext);
      if (!shouldInvoke.invoke) {
        // Use low-cost model or heuristic
        if (shouldInvoke.useHeuristic) {
          return {
            content: shouldInvoke.heuristicResult || '',
            tokens_used: 0,
            latency_ms: 0,
            model: 'heuristic',
          };
        }
        selectedModel = this.lowCostModel;
      }
    }

    // Run operation in a tracing span to capture metrics and trace context
    const spanResult = await traceLLMOperation(
      'complete',
      {
        provider: this.provider === 'together' ? 'together_ai' : 'openai',
        model: selectedModel,
        userId: taskContext?.userId,
        promptLength: JSON.stringify(messages).length
      },
      async (_span) => {
        addSpanEvent('llm.request.started', { model: selectedModel, sessionId: taskContext?.sessionId, tenantId: taskContext?.organizationId });

        const response = await llmProxyClient.complete({
      messages,
      config: {
        model: selectedModel,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        top_p: config.top_p,
      },
      provider: this.provider,
    });

        addSpanAttributes({
          'llm.tokens_used': response.tokens_used || 0,
          'llm.latency_ms': response.latency_ms || 0,
          'llm.model': response.model
        });

        addSpanEvent('llm.request.completed', { cost_estimate: 0 });

        // Metrics
        metrics.llmRequestsTotal.add(1, { provider: this.provider, model: selectedModel, tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' });
        metrics.llmRequestDuration.record(response.latency_ms || 0, { provider: this.provider, model: selectedModel, tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' });

        // Estimate prompt / completion tokens if we only have total
        const totalTokens = response.tokens_used || 0;
        const promptTokens = taskContext?.estimatedPromptTokens ?? Math.round(totalTokens * 0.4);
        const completionTokens = taskContext?.estimatedCompletionTokens ?? (totalTokens - promptTokens);

        if (totalTokens > 0) {
          metrics.llmTokensTotal.add(totalTokens, { provider: this.provider, model: selectedModel, type: 'total', tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' });
          metrics.llmTokensTotal.add(promptTokens, { provider: this.provider, model: selectedModel, type: 'prompt', tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' });
          metrics.llmTokensTotal.add(completionTokens, { provider: this.provider, model: selectedModel, type: 'completion', tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' });
        }

        // Calculate and track cost (estimate) and persist a usage event for tenant billing
        try {
          const estimatedCost = llmCostTracker.calculateCost(response.model, promptTokens, completionTokens);

          metrics.llmCostTotal.add(estimatedCost, { provider: this.provider, model: response.model, tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' });

          // Track as usage event per-tenant
          if (taskContext?.organizationId) {
            await trackUsage({
              organizationId: taskContext.organizationId,
              type: 'agent_call',
              amount: estimatedCost,
              metadata: {
                provider: this.provider,
                model: response.model,
                promptTokens,
                completionTokens,
                sessionId: taskContext.sessionId || null
              },
              timestamp: new Date()
            });
          }
        } catch (err) {
          logger.error('Failed to track LLM cost/usage', { err: err instanceof Error ? err.message : err });
        }

        return response;
      }
    );

    const response = spanResult;

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

    // Calculate and record cost if circuit breaker provided
    const finalResponse = {
      content: sanitizedContent,
      tokens_used: response.tokens_used,
      latency_ms: response.latency_ms,
      model: response.model
    };

    if (circuitBreaker && response.tokens_used && response.model) {
      // Estimate prompt/completion tokens from total tokens (following existing pattern)
      const totalTokens = response.tokens_used;
      const promptTokens = taskContext?.estimatedPromptTokens ?? Math.round(totalTokens * 0.4);
      const completionTokens = taskContext?.estimatedCompletionTokens ?? (totalTokens - promptTokens);
      
      const cost = llmCostTracker.calculateCost(response.model, promptTokens, completionTokens);
      circuitBreaker.recordCost(cost);

      // Track usage in cost tracker for monitoring
      await llmCostTracker.trackUsage({
        userId: taskContext?.userId || 'system',
        sessionId: taskContext?.sessionId,
        provider: this.provider === 'together' ? 'together_ai' : 'openai',
        model: response.model,
        promptTokens,
        completionTokens,
        endpoint: 'llm-gateway',
        success: true,
        latencyMs: response.latency_ms || 0,
      });
    }

    return finalResponse;
  }

  /**
   * Complete with tool calling support
   * Executes a conversation loop where LLM can call tools
   */
  async completeWithTools(
    messages: LLMMessage[],
    tools: LLMTool[],
    executeToolFn: (_name: string, _args: Record<string, unknown>) => Promise<string>,
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
        'complete_with_tools',
        {
          provider: this.provider === 'together' ? 'together_ai' : 'openai',
          model: config.model || this.defaultModel,
          promptLength: JSON.stringify(currentMessages).length
        },
        async (_span) => {
          addSpanEvent('llm.request.started', { model: config.model || this.defaultModel });

          const response = await llmProxyClient.completeWithTools({
        messages: currentMessages,
        tools,
        config: {
          model: config.model || this.defaultModel,
          temperature: config.temperature,
          max_tokens: config.max_tokens,
        },
        provider: this.provider,
      });

          addSpanAttributes({ 'llm.tokens_used': response.tokens_used || 0, 'llm.latency_ms': response.latency_ms || 0 });
          addSpanEvent('llm.request.completed', { tool_calls: (response.tool_calls || []).length });

          // Metrics
          metrics.llmRequestsTotal.add(1, { provider: this.provider, model: config.model || this.defaultModel, tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' });
          metrics.llmRequestDuration.record(response.latency_ms || 0, { provider: this.provider, model: config.model || this.defaultModel, tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' });

          // Track cost as in `complete()`
          const totalTokens = response.tokens_used || 0;
          const promptTokens = taskContext?.estimatedPromptTokens ?? Math.round(totalTokens * 0.4);
          const completionTokens = taskContext?.estimatedCompletionTokens ?? (totalTokens - promptTokens);
          if (totalTokens > 0) {
            metrics.llmTokensTotal.add(totalTokens, { provider: this.provider, model: config.model || this.defaultModel, type: 'total', tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' });
            metrics.llmTokensTotal.add(promptTokens, { provider: this.provider, model: config.model || this.defaultModel, type: 'prompt', tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' });
            metrics.llmTokensTotal.add(completionTokens, { provider: this.provider, model: config.model || this.defaultModel, type: 'completion', tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' });
          }

          try {
            const estimatedCost = llmCostTracker.calculateCost(response.model, promptTokens, completionTokens);
            metrics.llmCostTotal.add(estimatedCost, { provider: this.provider, model: response.model, tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' });
            if (taskContext?.organizationId) {
              await trackUsage({
                organizationId: taskContext.organizationId,
                type: 'agent_call',
                amount: estimatedCost,
                metadata: {
                  provider: this.provider,
                  model: response.model,
                  promptTokens,
                  completionTokens
                },
                timestamp: new Date()
              });
            }
          } catch (err) {
            logger.error('Failed to track LLM cost/usage', { err: err instanceof Error ? err.message : err });
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
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of response.tool_calls) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await executeToolFn(toolCall.function.name, args);
          
          currentMessages.push({
            role: 'tool',
            content: result,
            tool_call_id: toolCall.id,
          });
        } catch (error) {
          currentMessages.push({
            role: 'tool',
            content: JSON.stringify({ error: error instanceof Error ? error.message : 'Tool execution failed' }),
            tool_call_id: toolCall.id,
          });
        }
      }
    }

    return finalResponse || {
      content: 'Maximum tool iterations reached',
      tokens_used: 0,
      latency_ms: 0,
      model: this.defaultModel,
    };
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
      return { invoke: true, useHeuristic: false, reason: 'No context provided' };
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
        reason: 'Low complexity, high confidence - using heuristic',
      };
    }

    // Low complexity = use low-cost model
    if (complexity < 0.5) {
      return {
        invoke: false,
        useHeuristic: false,
        reason: 'Low complexity - using low-cost model',
      };
    }

    // High complexity = use requested model
    return {
      invoke: true,
      useHeuristic: false,
      reason: 'High complexity - using requested model',
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
        'system_analysis',
        'intervention_design',
        'outcome_engineering',
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
    if (taskContext.similar_episodes && taskContext.similar_episodes.length > 0) {
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
    if (taskContext.task_type === 'status_check') {
      return JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() });
    }

    if (taskContext.task_type === 'simple_query') {
      return JSON.stringify({ result: 'processed', data: taskContext });
    }

    return '';
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
  setGatingEnabled(enabled: boolean): void {
    this.gatingEnabled = enabled;
  }

  getSupportedModels(): string[] {
    if (this.provider === 'together') {
      return [
        'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        'microsoft/phi-4-mini',
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

  async completeStream(
    messages: LLMMessage[],
    onChunk: LLMStreamCallback,
    config: LLMConfig = {},
    taskContext?: TaskContext,
    circuitBreaker?: AgentCircuitBreaker,
    sessionId?: string
  ): Promise<void> {
    const strictTracing = (process.env.VITE_STRICT_TRACING_ENFORCE || 'false') === 'true';
    const currentTrace = getCurrentTraceContext();
    if (strictTracing && !currentTrace) {
      logger.error('LLMGateway completeStream aborted - missing trace context (strict tracing enforcement enabled)', { taskContext });
      throw new Error('LLM call aborted: missing trace/span context');
    }

    // Track LLM call in circuit breaker
    if (circuitBreaker) {
      circuitBreaker.recordLLMCall();
      circuitBreaker.checkMemory();
      
      if (circuitBreaker.shouldAbort()) {
        throw new Error('LLM call aborted by circuit breaker');
      }
    }

    // Apply LLM gating if enabled
    let selectedModel = config.force_model || config.model || this.defaultModel;
    
    if (this.gatingEnabled && config.use_gating !== false && !config.force_model) {
      const shouldInvoke = await this.shouldInvoke(selectedModel, taskContext);
      if (!shouldInvoke.invoke) {
        // For streaming, we can't easily use heuristics, so just use low-cost model
        selectedModel = this.lowCostModel;
      }
    }

    // Run operation in a tracing span to capture metrics and trace context
    await traceLLMOperation(
      'complete_stream',
      {
        provider: this.provider === 'together' ? 'together_ai' : 'openai',
        model: selectedModel,
        userId: taskContext?.userId,
        promptLength: JSON.stringify(messages).length
      },
      async (_span) => {
        addSpanEvent('llm.stream.request.started', { model: selectedModel, sessionId: taskContext?.sessionId, tenantId: taskContext?.organizationId });

        let totalTokens = 0;
        let startTime = Date.now();

        const wrappedOnChunk: LLMStreamCallback = (chunk) => {
          totalTokens += chunk.tokens_used || 0;

          // Sanitize the chunk content
          const sanitizedContent = sanitizeLLMContent(chunk.content);
          if (sanitizedContent !== chunk.content) {
            securityLogger.log({
              category: 'llm',
              action: 'stream-chunk-sanitized',
              severity: 'info',
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
              'llm.tokens_used': totalTokens,
              'llm.latency_ms': latency,
              'llm.model': selectedModel
            });

            // Estimate prompt / completion tokens
            const promptTokens = typeof taskContext?.estimatedPromptTokens === 'number' 
              ? taskContext.estimatedPromptTokens 
              : Math.round(totalTokens * 0.4);
            const completionTokens = typeof taskContext?.estimatedCompletionTokens === 'number'
              ? taskContext.estimatedCompletionTokens
              : (totalTokens - promptTokens);

            // Calculate and track cost
            const estimatedCost = llmCostTracker.calculateCost(selectedModel, promptTokens, completionTokens);

            addSpanEvent('llm.stream.request.completed', { cost_estimate: estimatedCost });

            // Metrics
            if (totalTokens > 0) {
              // Note: metrics are async but we're in callback context
              // For streaming, metrics are recorded per chunk
              Promise.all([
                metrics.llmRequestsTotal.then(m => m.add(1, { provider: this.provider, model: selectedModel, tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' })),
                metrics.llmRequestDuration.then(m => m.record(latency, { provider: this.provider, model: selectedModel, tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' })),
                metrics.llmTokensTotal.then(m => m.add(totalTokens, { provider: this.provider, model: selectedModel, type: 'total', tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' })),
                metrics.llmTokensTotal.then(m => m.add(promptTokens, { provider: this.provider, model: selectedModel, type: 'prompt', tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' })),
                metrics.llmTokensTotal.then(m => m.add(completionTokens, { provider: this.provider, model: selectedModel, type: 'completion', tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' })),
                metrics.llmCostTotal.then(m => m.add(estimatedCost, { provider: this.provider, model: selectedModel, tenant_id: taskContext?.organizationId || taskContext?.userId || 'unknown' }))
              ]).catch(err => {
                logger.error('Failed to record metrics', { err: err instanceof Error ? err.message : err });
              });
            }

            // Track usage
            if (taskContext?.organizationId) {
              // Note: trackUsage is async but we're in a callback context
              // For streaming, cost tracking happens per chunk, not at completion
              trackUsage({
                organizationId: taskContext.organizationId,
                type: 'agent_call',
                amount: estimatedCost,
                metadata: {
                  provider: this.provider,
                  model: selectedModel,
                  promptTokens,
                  completionTokens,
                  sessionId: taskContext.sessionId || null
                },
                timestamp: new Date()
              }).catch((err) => {
                logger.error('Failed to track LLM cost/usage', { err: err instanceof Error ? err.message : err });
              });
            }
          }
        };

        const response = await llmProxyClient.completeStream({
          messages,
          config: {
            model: selectedModel,
            temperature: config.temperature,
            max_tokens: config.max_tokens,
            top_p: config.top_p,
          },
          provider: this.provider,
        }, wrappedOnChunk, sessionId || 'unknown');

        // Note: completeStream returns void, cost recording is handled in the callback above
      }
    );
  }
}
