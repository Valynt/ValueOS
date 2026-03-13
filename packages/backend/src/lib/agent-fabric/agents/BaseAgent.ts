/**
 * Base Agent
 *
 * Abstract base class for all agents in the agent fabric.
 * Provides secureInvoke (circuit breaker + Zod validation + hallucination
 * detection) and memory access for all lifecycle agents.
 */

import { z } from "zod";

import type { AgentType } from "../../../services/agent-types.js";
import { assertTenantContextMatch } from "../../tenant/assertTenantContextMatch.js";
import type {
  AgentConfig,
  AgentOutput,
  AgentOutputMetadata,
  AgentOutputStatus,
  ConfidenceLevel,
  LifecycleContext,
  LifecycleStage,
  PromptVersionReference,
} from "../../../types/agent.js";
import { logger } from "../../logger.js";
import { CircuitBreaker } from "../CircuitBreaker.js";
import type { HallucinationCheckResult as KFHallucinationCheckResult, KnowledgeFabricValidator } from "../KnowledgeFabricValidator.js";
import { LLMGateway } from "../LLMGateway.js";
import { MemorySystem } from "../MemorySystem.js";

// ---------------------------------------------------------------------------
// Hallucination detection types
// ---------------------------------------------------------------------------

export interface HallucinationSignal {
  type: 'refusal_pattern' | 'fabricated_data' | 'self_reference' | 'confidence_mismatch' | 'internal_contradiction' | 'ungrounded_claim';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface HallucinationCheckResult {
  /** True when no hallucination signals detected */
  passed: boolean;
  /** Individual signals that fired */
  signals: HallucinationSignal[];
  /** Aggregate confidence that the output is grounded (0-1) */
  groundingScore: number;
  /** When true, the output should be routed to human review */
  requiresEscalation: boolean;
  /** Knowledge Fabric validation result (when validator is configured) */
  knowledgeFabric?: KFHallucinationCheckResult;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export abstract class BaseAgent {
  public readonly lifecycleStage: string;
  public readonly version: string;
  public readonly name: string;
  protected organizationId: string;
  protected memorySystem: MemorySystem;
  protected llmGateway: LLMGateway;
  protected circuitBreaker: CircuitBreaker;
  protected knowledgeFabricValidator: KnowledgeFabricValidator | null;
  // Prompt version references set during execution, included in output metadata.
  protected _promptVersionRefs: PromptVersionReference[] = [];

  constructor(
    config: AgentConfig,
    organizationId: string,
    memorySystem: MemorySystem,
    llmGateway: LLMGateway,
    circuitBreaker: CircuitBreaker
  ) {
    this.lifecycleStage = config.lifecycle_stage;
    this.version = "1.0.0";
    this.name = config.name;
    this.organizationId = organizationId;
    this.memorySystem = memorySystem;
    this.llmGateway = llmGateway;
    this.circuitBreaker = circuitBreaker;
    this.knowledgeFabricValidator = null;
  }

    /**
     * Records prompt version references for the current execution.
     * Stored on the instance so buildOutput can include them in metadata.
     */
    protected setPromptVersionReferences(
      refs: Array<{ key: string; version: string }>,
      _approvals?: unknown[],
    ): void {
      this._promptVersionRefs = refs.map(r => ({ key: r.key, version: r.version }));
    }

    /**
     * Converts a numeric score to a confidence level string.
     */
    protected toConfidenceLevel(score: number): ConfidenceLevel {
      if (score >= 0.85) return 'very_high';
      if (score >= 0.7) return 'high';
      if (score >= 0.5) return 'medium';
      if (score >= 0.3) return 'low';
      return 'very_low';
    }

    /**
     * Builds a standardized AgentOutput object.
     */
    protected buildOutput(
      result: Record<string, unknown>,
      status: AgentOutput['status'],
      confidence: ConfidenceLevel,
      startTime: number,
      extra?: {
        reasoning?: string;
        suggested_next_actions?: string[];
        warnings?: string[];
        prompt_version_refs?: PromptVersionReference[];
      },
    ): AgentOutput {
      const metadata: AgentOutputMetadata = {
        execution_time_ms: Date.now() - startTime,
        model_version: this.version,
        timestamp: new Date().toISOString(),
        prompt_version_refs: extra?.prompt_version_refs,
      };
      return {
        agent_id: this.name,
        agent_type: this.lifecycleStage,
        lifecycle_stage: this.lifecycleStage,
        status,
        result,
        confidence,
        metadata,
        ...(extra || {}),
      };
    }

  /**
   * Inject a KnowledgeFabricValidator for hallucination detection.
   * Called by AgentFactory after construction.
   */
  setKnowledgeFabricValidator(validator: KnowledgeFabricValidator): void {
    this.knowledgeFabricValidator = validator;
  }

  abstract execute(context: LifecycleContext): Promise<AgentOutput>;

  async validateInput(context: LifecycleContext): Promise<boolean> {
    if (!context.workspace_id || !context.organization_id || !context.user_id) {
      logger.error("Invalid agent input context", {
        agent_id: this.name,
        has_workspace: !!context.workspace_id,
        has_org: !!context.organization_id,
        has_user: !!context.user_id,
      });
      return false;
    }

    assertTenantContextMatch({
      expectedTenantId: this.organizationId,
      actualTenantId: context.organization_id,
      source: `${this.name}.validateInput`,
    });

    // organizationId is set in constructor; do not mutate here
    return true;
  }

  async prepareOutput(result: Record<string, unknown>, status: AgentOutputStatus): Promise<AgentOutput> {
    return {
      agent_id: this.name,
      agent_type: this.lifecycleStage as AgentType,
      lifecycle_stage: this.lifecycleStage as LifecycleStage,
      status,
      result,
      confidence: "medium",
      metadata: {
        execution_time_ms: 0,
        model_version: "unknown",
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Secure LLM invocation with circuit breaker, multi-signal hallucination
   * detection, Knowledge Fabric cross-referencing, and Zod validation.
   *
   * Hallucination detection runs two layers:
   * 1. Multi-signal pattern analysis (refusal, self-reference, fabricated data,
   *    internal contradictions, memory cross-reference, confidence calibration)
   * 2. Knowledge Fabric validation (semantic memory contradictions, GroundTruth
   *    benchmark checks) when a KnowledgeFabricValidator is configured
   *
   * Returns `hallucination_check` (boolean) and `hallucination_details`
   * (full signal breakdown with grounding score).
   */
  protected async secureInvoke<T>(
    sessionId: string,
    prompt: string,
    zodSchema: z.ZodSchema<T>,
    options: {
      trackPrediction?: boolean;
      confidenceThresholds?: { low: number; high: number };
      context?: Record<string, unknown>;
      idempotencyKey?: string;
    } = {}
  ): Promise<T & {
    hallucination_check?: boolean;
    hallucination_details?: HallucinationCheckResult;
    /** Token counts from the LLM response. Undefined when the provider does not return usage. */
    token_usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  }> {
    const {
      trackPrediction = true,
      confidenceThresholds = { low: 0.6, high: 0.85 },
      context = {},
      idempotencyKey,
    } = options;

    return this.circuitBreaker.execute(async () => {
      const traceId =
        typeof context.trace_id === "string" ? context.trace_id
          : typeof context.traceId === "string" ? context.traceId
            : sessionId;

      const request = {
        messages: [{ role: "user" as const, content: prompt }],
        metadata: {
          tenantId: this.organizationId,
          tenant_id: this.organizationId,
          sessionId,
          userId: "system",
          trace_id: traceId,
          idempotencyKey,
          ...context,
        },
      };

      const response = await this.llmGateway.complete(request);

      // Knowledge Fabric cross-reference (runs in parallel with parse)
      const kfResultPromise = this.validateWithKnowledgeFabric(response.content);

      // Validate response with Zod (fails fast on bad JSON)
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(response.content);
      } catch (err) {
        logger.error("Failed to parse LLM response as JSON", {
          agent: this.name,
          session_id: sessionId,
          error: (err as Error).message,
          content: response.content,
        });
        throw new Error("LLM response was not valid JSON: " + (err as Error).message);
      }
      const parsed = zodSchema.parse(parsedJson);

      // Run multi-signal hallucination detection
      const hallucinationResult = await this.checkHallucination(
        response.content,
        parsed as Record<string, unknown>,
        sessionId,
      );

      // Merge Knowledge Fabric result
      const kfResult = await kfResultPromise;
      hallucinationResult.knowledgeFabric = kfResult;

      if (!kfResult.passed) {
        hallucinationResult.passed = false;
        hallucinationResult.requiresEscalation = true;
        hallucinationResult.groundingScore = Math.min(
          hallucinationResult.groundingScore,
          kfResult.confidence,
        );
      }

      // Track prediction if enabled
      if (trackPrediction) {
        await this.memorySystem.storeSemanticMemory(
          sessionId,
          this.name,
          "episodic",
          `LLM Response: ${response.content.substring(0, 200)}...`,
          {
            confidence: hallucinationResult.groundingScore,
            hallucination_check: hallucinationResult.passed,
            hallucination_signals: hallucinationResult.signals.length,
            requires_escalation: hallucinationResult.requiresEscalation,
            validation_method: kfResult.method,
            contradiction_count: kfResult.contradictions.length,
            benchmark_misalignment_count: kfResult.benchmarkMisalignments.length,
          },
          this.organizationId
        );
      }

      if (hallucinationResult.requiresEscalation) {
        logger.warn("Hallucination escalation triggered", {
          agent: this.name,
          session_id: sessionId,
          signals: hallucinationResult.signals.map(s => s.type),
          grounding_score: hallucinationResult.groundingScore,
        });
      }

      // Surface token counts so the API layer can emit usage events without
      // re-parsing the raw LLM response.
      const tokenUsage = response.usage
        ? {
            input_tokens: response.usage.prompt_tokens,
            output_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
          }
        : undefined;

      return {
        ...parsed,
        hallucination_check: hallucinationResult.passed,
        hallucination_details: hallucinationResult,
        token_usage: tokenUsage,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Knowledge Fabric Validation
  // -------------------------------------------------------------------------

  private async validateWithKnowledgeFabric(content: string): Promise<KFHallucinationCheckResult> {
    if (!this.knowledgeFabricValidator) {
      return {
        passed: true,
        confidence: 0.5,
        contradictions: [],
        benchmarkMisalignments: [],
        method: "knowledge_fabric",
      };
    }

    try {
      return await this.knowledgeFabricValidator.validate(
        content,
        this.organizationId,
        this.name
      );
    } catch (err) {
      logger.error("Knowledge Fabric validation failed, defaulting to fail", {
        agent_id: this.name,
        error: (err as Error).message,
      });
      return {
        passed: false,
        confidence: 0.5,
        contradictions: [],
        benchmarkMisalignments: [],
        method: "knowledge_fabric",
        requiresEscalation: true,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Multi-Signal Hallucination Detection
  // -------------------------------------------------------------------------

  /**
   * 6-signal hallucination detection pipeline:
   * 1. Refusal patterns — LLM declining to answer
   * 2. Self-reference — LLM breaking character
   * 3. Fabricated data — fake URLs, round numbers, implausible percentages
   * 4. Internal contradictions — range inversions, out-of-bounds confidence
   * 5. Memory cross-reference — contradictions against stored facts
   * 6. Confidence calibration — high confidence with thin evidence
   */
  protected async checkHallucination(
    rawContent: string,
    parsedOutput: Record<string, unknown>,
    sessionId: string,
  ): Promise<HallucinationCheckResult> {
    const signals: HallucinationSignal[] = [];

    // 1. Refusal patterns
    const refusalPatterns = [
      /I'm sorry,? but I cannot/i,
      /I don't have access to/i,
      /As an AI,? I must/i,
      /I cannot provide/i,
      /I'm unable to/i,
      /I apologize,? but/i,
      /I need to clarify that/i,
      /It's important to note that I/i,
    ];
    for (const pattern of refusalPatterns) {
      if (pattern.test(rawContent)) {
        signals.push({
          type: 'refusal_pattern',
          description: `LLM refusal detected: ${pattern.source}`,
          severity: 'high',
        });
        break;
      }
    }

    // 2. Self-reference patterns
    const selfRefPatterns = [
      /as an? (?:AI )?language model/i,
      /as an AI assistant/i,
      /my training data/i,
      /I was trained/i,
      /my knowledge cutoff/i,
      /I don't have real-time/i,
    ];
    for (const pattern of selfRefPatterns) {
      if (pattern.test(rawContent)) {
        signals.push({
          type: 'self_reference',
          description: `LLM self-reference detected: ${pattern.source}`,
          severity: 'medium',
        });
        break;
      }
    }

    // 3. Fabricated data
    this.checkFabricatedData(rawContent, parsedOutput, signals);

    // 4. Internal contradictions
    this.checkInternalContradictions(parsedOutput, signals);

    // 5. Memory cross-reference
    await this.crossReferenceMemory(parsedOutput, sessionId, signals);

    // 6. Confidence calibration
    this.checkConfidenceCalibration(parsedOutput, signals);

    // Compute grounding score
    const severityWeights: Record<string, number> = { low: 0.1, medium: 0.25, high: 0.5 };
    const totalPenalty = signals.reduce(
      (sum, s) => sum + (severityWeights[s.severity] || 0.1),
      0,
    );
    const groundingScore = Math.max(0, Math.min(1, 1 - totalPenalty));

    const hasHighSeverity = signals.some(s => s.severity === 'high');
    const requiresEscalation = hasHighSeverity || groundingScore < 0.5;

    return {
      passed: !hasHighSeverity && groundingScore >= 0.6,
      signals,
      groundingScore,
      requiresEscalation,
    };
  }

  private checkFabricatedData(
    rawContent: string,
    parsedOutput: Record<string, unknown>,
    signals: HallucinationSignal[],
  ): void {
    const fakeUrlPattern = /https?:\/\/(?:www\.)?(?:example\.com|fake|placeholder|lorem)/i;
    if (fakeUrlPattern.test(rawContent)) {
      signals.push({
        type: 'fabricated_data',
        description: 'Placeholder or fake URL detected in output',
        severity: 'high',
      });
    }

    const roundNumberPattern = /\b\d{1,3}(,000){2,}\b/g;
    const roundMatches = rawContent.match(roundNumberPattern);
    if (roundMatches && roundMatches.length > 3) {
      signals.push({
        type: 'fabricated_data',
        description: `Multiple suspiciously round numbers detected (${roundMatches.length} instances)`,
        severity: 'low',
      });
    }

    const percentages = this.extractNumbers(parsedOutput, 'percent');
    for (const pct of percentages) {
      if (pct > 1000 || pct < -100) {
        signals.push({
          type: 'fabricated_data',
          description: `Implausible percentage value: ${pct}%`,
          severity: 'medium',
        });
        break;
      }
    }
  }

  private checkInternalContradictions(
    parsedOutput: Record<string, unknown>,
    signals: HallucinationSignal[],
  ): void {
    const ranges = this.extractRanges(parsedOutput);
    for (const range of ranges) {
      if (range.low > range.high) {
        signals.push({
          type: 'internal_contradiction',
          description: `Range inversion: low (${range.low}) > high (${range.high}) in ${range.path}`,
          severity: 'high',
        });
      }
    }

    const confidences = this.extractNumbers(parsedOutput, 'confidence');
    for (const conf of confidences) {
      if (conf < 0 || conf > 1) {
        signals.push({
          type: 'internal_contradiction',
          description: `Confidence value out of bounds: ${conf}`,
          severity: 'medium',
        });
      }
    }
  }

  private async crossReferenceMemory(
    parsedOutput: Record<string, unknown>,
    sessionId: string,
    signals: HallucinationSignal[],
  ): Promise<void> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: this.name,
        memory_type: 'semantic',
        limit: 5,
        organization_id: this.organizationId,
      });

      if (memories.length === 0) return;

      const outputStr = JSON.stringify(parsedOutput).toLowerCase();

      for (const memory of memories) {
        if (memory.metadata?.type === 'integrity_validation' && memory.metadata?.veto === true) {
          if (outputStr.includes('supported') || outputStr.includes('validated')) {
            signals.push({
              type: 'ungrounded_claim',
              description: 'Output claims validation success but previous integrity check vetoed',
              severity: 'medium',
            });
          }
        }
      }
    } catch (err) {
      logger.warn('[BaseAgent.crossReferenceMemory] Memory cross-reference failed', {
        agent: this.name,
        organizationId: this.organizationId,
        error: (err as Error).message,
      });
      if (err && typeof err.message === 'string' && err.message.includes('tenant')) {
        throw new Error(`Tenant isolation violation in crossReferenceMemory: ${err.message}`);
      }
      // Otherwise, skip cross-reference but error is now visible
    }
  }

  private checkConfidenceCalibration(
    parsedOutput: Record<string, unknown>,
    signals: HallucinationSignal[],
  ): void {
    const confidences = this.extractNumbers(parsedOutput, 'confidence');
    const evidenceArrays = this.extractArrayLengths(parsedOutput, 'evidence');

    if (confidences.length > 0 && evidenceArrays.length > 0) {
      const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      const avgEvidence = evidenceArrays.reduce((a, b) => a + b, 0) / evidenceArrays.length;

      if (avgConfidence > 0.85 && avgEvidence < 2) {
        signals.push({
          type: 'confidence_mismatch',
          description: `High confidence (${avgConfidence.toFixed(2)}) with thin evidence (avg ${avgEvidence.toFixed(1)} items)`,
          severity: 'medium',
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Utility methods
  // -------------------------------------------------------------------------

  private extractNumbers(obj: unknown, keyPattern: string, results: number[] = []): number[] {
    if (obj === null || obj === undefined) return results;
    if (typeof obj === 'number' && !Number.isNaN(obj)) return results;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.extractNumbers(item, keyPattern, results);
      }
    } else if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (key.toLowerCase().includes(keyPattern) && typeof value === 'number') {
          results.push(value);
        } else {
          this.extractNumbers(value, keyPattern, results);
        }
      }
    }
    return results;
  }

  private extractRanges(
    obj: unknown,
    path: string = '',
    results: Array<{ low: number; high: number; path: string }> = [],
  ): Array<{ low: number; high: number; path: string }> {
    if (obj === null || obj === undefined || typeof obj !== 'object') return results;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        this.extractRanges(obj[i], `${path}[${i}]`, results);
      }
    } else {
      const record = obj as Record<string, unknown>;
      if (typeof record.low === 'number' && typeof record.high === 'number') {
        results.push({ low: record.low, high: record.high, path: path || 'root' });
      }
      for (const [key, value] of Object.entries(record)) {
        this.extractRanges(value, path ? `${path}.${key}` : key, results);
      }
    }
    return results;
  }

  private extractArrayLengths(obj: unknown, keyPattern: string, results: number[] = []): number[] {
    if (obj === null || obj === undefined || typeof obj !== 'object') return results;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.extractArrayLengths(item, keyPattern, results);
      }
    } else {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (key.toLowerCase().includes(keyPattern) && Array.isArray(value)) {
          results.push(value.length);
        } else {
          this.extractArrayLengths(value, keyPattern, results);
        }
      }
    }
    return results;
  }

  getCapabilities(): string[] {
    return [];
  }

  getId(): string {
    return this.name;
  }

  getName(): string {
    return this.name;
  }
}
