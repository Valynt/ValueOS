/**
 * Gated LLM Gateway
 *
 * Enhanced LLM Gateway with comprehensive gating based on:
 * 1. Architectural Gating: Model selection based on MoE/sparse attention
 * 2. Application Gating: Pre/post invocation security gates
 *
 * Wraps the base LLMGateway with full gating support.
 */

import { logger } from '../../lib/logger';
import { LLMConfig, LLMGateway, LLMMessage, LLMProvider, LLMResponse } from '../agent-fabric/LLMGateway';
import { AgentCircuitBreaker } from '../agent-fabric/CircuitBreaker';
import {
  DEFAULT_GATING_CONFIG,
  IntegrityCheckResult,
  LLMGatingConfig,
  PolicyViolationError,
  PostInvocationContext,
  PostInvocationGateResult,
  PreInvocationContext,
  PreInvocationGateResult,
  TenantBudgetStatus,
} from './types';
import {
  createDefaultPreInvocationGates,
  PreInvocationGateManager,
} from './PreInvocationGates';
import {
  createDefaultPostInvocationGates,
  PostInvocationGateManager,
} from './PostInvocationGates';
import {
  getCostEffectiveAlternative,
  getModelTraits,
  MODEL_REGISTRY,
  selectBestModel,
} from './ModelRegistry';

/**
 * Extended LLM config with gating options
 */
export interface GatedLLMConfig extends LLMConfig {
  /** Organization ID for tenant isolation */
  organizationId?: string;
  /** User ID for tracking */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Agent making the request */
  agentId?: string;
  /** Trace ID for observability */
  traceId?: string;
  /** Whether this is a RAG task */
  isRAG?: boolean;
  /** Task type hint */
  taskType?: string;
  /** Skip pre-invocation gates */
  skipPreGates?: boolean;
  /** Skip post-invocation gates */
  skipPostGates?: boolean;
}

/**
 * Gated LLM response with additional metadata
 */
export interface GatedLLMResponse extends LLMResponse {
  /** Pre-invocation gate results */
  preGateResult?: PreInvocationGateResult;
  /** Post-invocation gate results */
  postGateResult?: PostInvocationGateResult;
  /** Whether model was downgraded */
  modelDowngraded: boolean;
  /** Original requested model */
  requestedModel: string;
  /** Adjusted confidence (after post-gate multipliers) */
  adjustedConfidence?: number;
  /** Whether reflection was triggered */
  reflectionTriggered: boolean;
  /** Number of reflection attempts */
  reflectionAttempts: number;
}

/**
 * Gated LLM Gateway
 *
 * Provides comprehensive gating around LLM calls:
 * - Pre-invocation: Cost, compliance, tenant isolation
 * - Model selection: MoE/gated attention preference
 * - Post-invocation: Confidence, hallucination, integrity
 */
export class GatedLLMGateway {
  private baseGateway: LLMGateway;
  private config: LLMGatingConfig;
  private preGates: PreInvocationGateManager;
  private postGates: PostInvocationGateManager;
  private provider: LLMProvider;

  constructor(
    provider: LLMProvider = 'together',
    gatingConfig: Partial<LLMGatingConfig> = {},
    getBudgetStatus?: (orgId: string) => Promise<TenantBudgetStatus>,
    verifyWithKnowledgeFabric?: (output: string, context: PostInvocationContext) => Promise<IntegrityCheckResult>
  ) {
    this.provider = provider;
    this.config = { ...DEFAULT_GATING_CONFIG, ...gatingConfig };

    // Create base gateway with gating enabled
    this.baseGateway = new LLMGateway(provider, this.config.enabled);

    // Create gate managers
    const defaultBudgetStatus = async (_orgId: string): Promise<TenantBudgetStatus> => ({
      organizationId: _orgId,
      period: { start: new Date(), end: new Date() },
      budgetLimit: 1000,
      usedAmount: 0,
      remainingBudget: 1000,
      usagePercentage: 0,
      inGracePeriod: false,
      hardLimit: 1200,
    });

    this.preGates = createDefaultPreInvocationGates(
      getBudgetStatus || defaultBudgetStatus,
      this.config
    );
    this.postGates = createDefaultPostInvocationGates(this.config, verifyWithKnowledgeFabric);
  }

  /**
   * Complete with full gating
   */
  async complete(
    messages: LLMMessage[],
    config: GatedLLMConfig = {},
    taskContext?: any,
    circuitBreaker?: AgentCircuitBreaker
  ): Promise<GatedLLMResponse> {
    const startTime = Date.now();
    const requestedModel = config.model || this.baseGateway.getDefaultModel();
    let selectedModel = requestedModel;
    let modelDowngraded = false;
    let reflectionTriggered = false;
    let reflectionAttempts = 0;

    // Build input content for compliance checks
    const inputContent = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n');

    // Estimate tokens
    const estimatedInputTokens = Math.ceil(inputContent.length / 4);
    const estimatedOutputTokens = config.max_tokens || 2000;

    // Pre-invocation context
    const preContext: PreInvocationContext = {
      organizationId: config.organizationId || 'unknown',
      userId: config.userId || 'unknown',
      sessionId: config.sessionId,
      requestedModel,
      estimatedInputTokens,
      estimatedOutputTokens,
      inputContent,
      taskType: config.taskType,
      isRAG: config.isRAG,
      agentId: config.agentId,
      traceId: config.traceId,
    };

    let preGateResult: PreInvocationGateResult | undefined;

    // =========================================================================
    // Pre-Invocation Gates
    // =========================================================================
    if (this.config.enabled && !config.skipPreGates) {
      try {
        const gateResult = await this.preGates.checkAll(preContext);
        preGateResult = {
          allowed: gateResult.allowed,
          gates: gateResult.results,
          selectedModel: gateResult.suggestedModel || selectedModel,
          modelDowngraded: !!gateResult.suggestedModel && gateResult.suggestedModel !== selectedModel,
          gateCheckDurationMs: Date.now() - startTime,
        };

        if (gateResult.suggestedModel) {
          selectedModel = gateResult.suggestedModel;
          modelDowngraded = true;
          logger.info('Model downgraded by pre-gate', {
            from: requestedModel,
            to: selectedModel,
            reason: gateResult.results.find((r) => r.suggestedAction?.type === 'downgrade')?.reason,
          });
        }
      } catch (error) {
        if (error instanceof PolicyViolationError) {
          throw error;
        }
        logger.error('Pre-invocation gates failed', { error });
        // Continue with caution on gate failure
      }
    }

    // =========================================================================
    // Model Selection (Architectural Gating)
    // =========================================================================
    if (this.config.modelSelection.preferMoEForComplexTasks || this.config.modelSelection.preferGatedAttentionForRAG) {
      const optimalModel = this.selectOptimalModel(selectedModel, config);
      if (optimalModel && optimalModel !== selectedModel) {
        logger.debug('Model upgraded based on architecture preferences', {
          from: selectedModel,
          to: optimalModel,
          isRAG: config.isRAG,
        });
        selectedModel = optimalModel;
      }
    }

    // =========================================================================
    // LLM Invocation with Reflection Loop
    // =========================================================================
    let response: LLMResponse;
    let postGateResult: PostInvocationGateResult | undefined;
    const maxReflectionAttempts = this.config.confidence.maxReflectionAttempts;

    do {
      // Invoke LLM
      response = await this.baseGateway.complete(
        messages,
        { ...config, model: selectedModel },
        taskContext,
        circuitBreaker
      );

      // =========================================================================
      // Post-Invocation Gates
      // =========================================================================
      if (this.config.enabled && !config.skipPostGates) {
        const postContext: PostInvocationContext = {
          preContext,
          rawOutput: response.content,
          actualInputTokens: response.tokens_used || estimatedInputTokens,
          actualOutputTokens: response.tokens_used || estimatedOutputTokens,
          latencyMs: response.latency_ms || 0,
          modelUsed: selectedModel,
        };

        try {
          const gateResult = await this.postGates.checkAll(postContext);
          postGateResult = {
            allowed: gateResult.allowed,
            gates: gateResult.results,
            outputModified: false,
            confidenceMultiplier: gateResult.confidenceMultiplier,
          };

          // Check if reflection is needed
          if (gateResult.shouldRetry && reflectionAttempts < maxReflectionAttempts) {
            reflectionTriggered = true;
            reflectionAttempts++;

            // Add reflection prompt
            const reflectionMessages: LLMMessage[] = [
              ...messages,
              {
                role: 'assistant',
                content: response.content,
              },
              {
                role: 'user',
                content: `Your previous response had low confidence. Please reconsider and provide a more confident, well-reasoned response. Focus on accuracy and cite evidence where possible.`,
              },
            ];

            messages = reflectionMessages;
            logger.info('Triggering reflection loop', {
              attempt: reflectionAttempts,
              maxAttempts: maxReflectionAttempts,
            });
            continue;
          }

          // If post-gate blocks, throw
          if (!gateResult.allowed) {
            throw new PolicyViolationError(
              'Output blocked by post-invocation gates',
              gateResult.results,
              'post-invocation',
              'error'
            );
          }
        } catch (error) {
          if (error instanceof PolicyViolationError) {
            throw error;
          }
          logger.error('Post-invocation gates failed', { error });
        }
      }

      break; // Exit loop if no reflection needed
    } while (reflectionAttempts <= maxReflectionAttempts);

    // =========================================================================
    // Build Response
    // =========================================================================
    const gatedResponse: GatedLLMResponse = {
      ...response,
      preGateResult,
      postGateResult,
      modelDowngraded,
      requestedModel,
      reflectionTriggered,
      reflectionAttempts,
    };

    // Calculate adjusted confidence
    if (postGateResult?.confidenceMultiplier !== undefined) {
      gatedResponse.adjustedConfidence = postGateResult.confidenceMultiplier;
    }

    logger.debug('Gated LLM call complete', {
      requestedModel,
      actualModel: selectedModel,
      modelDowngraded,
      reflectionTriggered,
      reflectionAttempts,
      durationMs: Date.now() - startTime,
    });

    return gatedResponse;
  }

  /**
   * Select optimal model based on task and architecture preferences
   */
  private selectOptimalModel(currentModel: string, config: GatedLLMConfig): string | null {
    const traits = getModelTraits(currentModel);

    // If already has preferred architecture, keep it
    if (config.isRAG && traits.recommendedForRAG && (traits.hasMoE || traits.hasGatedAttention)) {
      return null;
    }

    // Try to find a better model
    const availableModels = this.getAvailableModels();

    return selectBestModel(
      {
        requiresLongContext: (config.max_tokens || 0) > 4000,
        isRAGTask: config.isRAG || false,
        latencySensitive: false,
        maxCostTier: traits.costTier, // Don't go more expensive
        minContextLength: traits.effectiveContextLength,
      },
      availableModels
    );
  }

  /**
   * Get models available for current provider
   */
  private getAvailableModels(): string[] {
    const providerPrefixes: Record<LLMProvider, string[]> = {
      together: ['meta-llama', 'mistralai', 'microsoft', 'Qwen', 'deepseek-ai'],
      openai: ['gpt-'],
      anthropic: ['claude-'],
      'together-fallback': ['meta-llama', 'mistralai'],
    };

    const prefixes = providerPrefixes[this.provider] || [];

    return Object.keys(MODEL_REGISTRY).filter((model) =>
      prefixes.some((prefix) => model.startsWith(prefix))
    );
  }

  /**
   * Get the underlying base gateway
   */
  getBaseGateway(): LLMGateway {
    return this.baseGateway;
  }

  /**
   * Get gating configuration
   */
  getGatingConfig(): LLMGatingConfig {
    return this.config;
  }

  /**
   * Update gating configuration
   */
  updateGatingConfig(config: Partial<LLMGatingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable/disable gating
   */
  setGatingEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.baseGateway.setGatingEnabled(enabled);
  }

  /**
   * Get provider
   */
  getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Get default model
   */
  getDefaultModel(): string {
    return this.baseGateway.getDefaultModel();
  }
}

/**
 * Create a gated LLM gateway with default configuration
 */
export function createGatedLLMGateway(
  provider: LLMProvider = 'together',
  options?: {
    gatingConfig?: Partial<LLMGatingConfig>;
    getBudgetStatus?: (orgId: string) => Promise<TenantBudgetStatus>;
    verifyWithKnowledgeFabric?: (output: string, context: PostInvocationContext) => Promise<IntegrityCheckResult>;
  }
): GatedLLMGateway {
  return new GatedLLMGateway(
    provider,
    options?.gatingConfig,
    options?.getBudgetStatus,
    options?.verifyWithKnowledgeFabric
  );
}
