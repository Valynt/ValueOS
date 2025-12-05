// Re-export types from shared file to maintain backwards compatibility
export type { LLMMessage, LLMResponse, LLMConfig, LLMProvider, LLMTool, LLMToolCall } from './llm-types';
import type { LLMMessage, LLMResponse, LLMConfig, LLMProvider, LLMTool } from './llm-types';

import { sanitizeLLMContent } from '../../utils/security';
import { securityLogger } from '../../services/SecurityLogger';
import { llmProxyClient } from '../../services/LlmProxyClient';
import { AgentCircuitBreaker } from './CircuitBreaker';
import { logger } from '../logger';

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
    taskContext?: any,
    circuitBreaker?: AgentCircuitBreaker
  ): Promise<LLMResponse> {
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

    return {
      content: sanitizedContent,
      tokens_used: response.tokens_used,
      latency_ms: response.latency_ms,
      model: response.model
    };
  }

  /**
   * Complete with tool calling support
   * Executes a conversation loop where LLM can call tools
   */
  async completeWithTools(
    messages: LLMMessage[],
    tools: LLMTool[],
    executeToolFn: (name: string, args: Record<string, any>) => Promise<string>,
    config: LLMConfig = {},
    maxIterations: number = 5
  ): Promise<LLMResponse> {
    let currentMessages = [...messages];
    let iterations = 0;
    let finalResponse: LLMResponse | null = null;

    while (iterations < maxIterations) {
      iterations++;

      // Call LLM with tools
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
    taskContext?: any
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
  estimateComplexity(taskContext: any): number {
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
    if (taskContext.entities) {
      complexity += Math.min(taskContext.entities.length / 50, 0.2);
    }

    return Math.min(complexity, 1);
  }

  /**
   * Estimate confidence in existing knowledge (0-1 scale)
   */
  estimateConfidence(taskContext: any): number {
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
  selectModelBasedOnGating(taskContext?: any): string {
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
  private applyHeuristic(taskContext: any): string {
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
}
