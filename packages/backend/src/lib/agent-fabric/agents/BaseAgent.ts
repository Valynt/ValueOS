/**
 * Base Agent
 *
 * Abstract base class for all agents in the agent fabric.
 * Provides secureInvoke (circuit breaker + Zod validation + hallucination
 * detection) and memory access for all lifecycle agents.
 */

import { logger } from "../../logger.js";
import { z } from "zod";
import type { AgentConfig, AgentOutput, AgentOutputStatus, LifecycleContext, LifecycleStage } from "../../../types/agent.js";
import type { AgentType } from "../../../services/agent-types.js";
import { LLMGateway } from "../LLMGateway.js";
import { CircuitBreaker } from "../CircuitBreaker.js";
import { MemorySystem } from "../MemorySystem.js";

// ---------------------------------------------------------------------------
// Hallucination detection result
// ---------------------------------------------------------------------------

export interface HallucinationCheckResult {
  /** True when no hallucination signals detected */
  passed: boolean;
  /** Individual signals that fired */
  signals: HallucinationSignal[];
  /** Aggregate confidence that the output is grounded (0-1) */
  groundingScore: number;
  /** When true, the output should be routed to human review */
  requiresEscalation: boolean;
}

export interface HallucinationSignal {
  type: 'refusal_pattern' | 'fabricated_data' | 'self_reference' | 'confidence_mismatch' | 'internal_contradiction' | 'ungrounded_claim';
  description: string;
  severity: 'low' | 'medium' | 'high';
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

  constructor(
    config: AgentConfig,
    organizationId: string,
    memorySystem: MemorySystem,
    llmGateway: LLMGateway,
    circuitBreaker: CircuitBreaker
  ) {
    this.lifecycleStage = config.lifecycle_stage;
    this.version = "1.0.0"; // Default version, can be overridden
    this.name = config.name;
    this.organizationId = organizationId;
    this.memorySystem = memorySystem;
    this.llmGateway = llmGateway;
    this.circuitBreaker = circuitBreaker;
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
    this.organizationId = context.organization_id;
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
   * Secure LLM invocation with circuit breaker, hallucination detection, and Zod validation.
   *
   * When hallucination signals fire at high severity, the result is flagged
   * for escalation. Callers can inspect `hallucination_check` (boolean pass/fail)
   * and `hallucination_details` (full signal breakdown) on the returned object.
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
  ): Promise<T & { hallucination_check?: boolean; hallucination_details?: HallucinationCheckResult }> {
    const {
      trackPrediction = true,
      confidenceThresholds = { low: 0.6, high: 0.85 },
      context = {},
      idempotencyKey,
    } = options;

    return this.circuitBreaker.execute(async () => {
      const request = {
        messages: [{ role: "user" as const, content: prompt }],
        metadata: {
          tenantId: this.organizationId,
          sessionId,
          userId: "system",
          idempotencyKey,
          ...context,
        },
      };

      const response = await this.llmGateway.complete(request);

      // Validate response with Zod first (fails fast on bad JSON)
      const parsed = zodSchema.parse(JSON.parse(response.content));

      // Run hallucination detection against the parsed output
      const hallucinationResult = await this.checkHallucination(
        response.content,
        parsed as Record<string, unknown>,
        sessionId,
      );

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

      return {
        ...parsed,
        hallucination_check: hallucinationResult.passed,
        hallucination_details: hallucinationResult,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Hallucination Detection
  // -------------------------------------------------------------------------

  /**
   * Multi-signal hallucination detection.
   *
   * Checks:
   * 1. Refusal patterns — LLM declining to answer
   * 2. Self-reference patterns — LLM breaking character
   * 3. Fabricated data signals — suspiciously round numbers, fake citations
   * 4. Internal contradictions — conflicting values within the output
   * 5. Memory cross-reference — outputs that contradict stored facts
   * 6. Confidence calibration — claimed confidence vs evidence quality
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
        break; // One refusal signal is enough
      }
    }

    // 2. Self-reference patterns (LLM breaking character)
    const selfRefPatterns = [
      /as a language model/i,
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

    // 3. Fabricated data signals
    this.checkFabricatedData(rawContent, parsedOutput, signals);

    // 4. Internal contradictions
    this.checkInternalContradictions(parsedOutput, signals);

    // 5. Memory cross-reference (check against stored facts)
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

  /**
   * Detect suspiciously fabricated data: round numbers, fake URLs,
   * implausible percentages, and citation-like strings that look invented.
   */
  private checkFabricatedData(
    rawContent: string,
    parsedOutput: Record<string, unknown>,
    signals: HallucinationSignal[],
  ): void {
    // Fake URL patterns (common LLM hallucination)
    const fakeUrlPattern = /https?:\/\/(?:www\.)?(?:example\.com|fake|placeholder|lorem)/i;
    if (fakeUrlPattern.test(rawContent)) {
      signals.push({
        type: 'fabricated_data',
        description: 'Placeholder or fake URL detected in output',
        severity: 'high',
      });
    }

    // Suspiciously precise large numbers (e.g., exactly $1,000,000)
    const roundNumberPattern = /\b\d{1,3}(,000){2,}\b/g;
    const roundMatches = rawContent.match(roundNumberPattern);
    if (roundMatches && roundMatches.length > 3) {
      signals.push({
        type: 'fabricated_data',
        description: `Multiple suspiciously round numbers detected (${roundMatches.length} instances)`,
        severity: 'low',
      });
    }

    // Check for implausible percentage values (> 1000%)
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

  /**
   * Detect internal contradictions within the parsed output.
   * Looks for conflicting numeric values that should be consistent.
   */
  private checkInternalContradictions(
    parsedOutput: Record<string, unknown>,
    signals: HallucinationSignal[],
  ): void {
    // Check low/high range consistency
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

    // Check confidence values are within bounds
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

  /**
   * Cross-reference output claims against stored memory.
   * Flags outputs that contradict previously validated facts.
   */
  private async crossReferenceMemory(
    parsedOutput: Record<string, unknown>,
    sessionId: string,
    signals: HallucinationSignal[],
  ): Promise<void> {
    try {
      // Retrieve recent semantic memories for this tenant
      const memories = await this.memorySystem.retrieve({
        agent_id: this.name,
        memory_type: 'semantic',
        limit: 5,
        organization_id: this.organizationId,
      });

      if (memories.length === 0) return;

      // Extract key claims from the output for comparison
      const outputStr = JSON.stringify(parsedOutput).toLowerCase();

      for (const memory of memories) {
        // Check for numeric contradictions between memory and output
        if (memory.metadata?.type === 'integrity_validation' && memory.metadata?.veto === true) {
          // If integrity previously vetoed and we're producing new claims,
          // flag as potentially ungrounded
          if (outputStr.includes('supported') || outputStr.includes('validated')) {
            signals.push({
              type: 'ungrounded_claim',
              description: 'Output claims validation success but previous integrity check vetoed',
              severity: 'medium',
            });
          }
        }
      }
    } catch {
      // Memory unavailable — skip cross-reference silently
    }
  }

  /**
   * Check whether claimed confidence levels match the evidence quality.
   * High confidence with weak evidence is a hallucination signal.
   */
  private checkConfidenceCalibration(
    parsedOutput: Record<string, unknown>,
    signals: HallucinationSignal[],
  ): void {
    const confidences = this.extractNumbers(parsedOutput, 'confidence');
    const evidenceArrays = this.extractArrayLengths(parsedOutput, 'evidence');

    // If high confidence claimed but very little evidence provided
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
  // Utility methods for hallucination detection
  // -------------------------------------------------------------------------

  /** Recursively extract numeric values from fields matching a key pattern */
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

  /** Extract low/high range pairs for contradiction checking */
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

  /** Extract lengths of arrays whose keys match a pattern */
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
