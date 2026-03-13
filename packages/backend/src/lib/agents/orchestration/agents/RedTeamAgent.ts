/**
 * Red Team Agent
 *
 * Stress-tests value claims by simulating CFO pushback.
 * Challenges assumptions, questions data sources, probes for math hallucinations.
 * Produces structured Objection[] with severity and category.
 *
 * Extends BaseAgent so all LLM calls go through secureInvoke (circuit breaker +
 * hallucination detection + Zod validation). Sprint 25 KR 25-3.
 */

import { z } from 'zod';

import { BaseAgent } from '../../../agent-fabric/agents/BaseAgent.js';
import { CircuitBreaker } from '../../../agent-fabric/CircuitBreaker.js';
import type { LLMGateway } from '../../../agent-fabric/LLMGateway.js';
import { MemorySystem } from '../../../agent-fabric/MemorySystem.js';
import type { AgentOutput, LifecycleContext } from '../../../../types/agent.js';

// ============================================================================
// Types
// ============================================================================

export interface Objection {
  id: string;
  targetComponent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'assumption' | 'data_quality' | 'math_error' | 'missing_evidence' | 'logical_gap';
  description: string;
  suggestedRevision?: string;
}

export interface RedTeamInput {
  valueCaseId: string;
  tenantId: string;
  valueTree: Record<string, unknown>;
  narrativeBlock: Record<string, unknown>;
  evidenceBundle: Record<string, unknown>;
  idempotencyKey: string;
}

export interface RedTeamOutput {
  objections: Objection[];
  summary: string;
  hasCritical: boolean;
  confidence: 'high' | 'medium' | 'low';
  timestamp: string;
  hallucination_check?: boolean;
  hallucination_details?: {
    grounding_score: number;
    matched_signals: string[];
    requires_escalation: boolean;
  };
}

// ============================================================================
// LLM Interface (kept for backward-compatible constructor injection in tests)
// ============================================================================

export interface RedTeamLLMGateway {
  complete(request: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    metadata: { tenantId: string; [key: string]: unknown };
  }): Promise<{
    content: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }>;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const ObjectionSchema = z.object({
  id: z.string(),
  targetComponent: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.enum(['assumption', 'data_quality', 'math_error', 'missing_evidence', 'logical_gap']),
  description: z.string(),
  suggestedRevision: z.string().optional(),
});

export const RedTeamOutputSchema = z.object({
  objections: z.array(ObjectionSchema),
  summary: z.string(),
  hasCritical: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]).optional().default("medium"),
  hallucination_check: z.boolean().optional(),
});

// ============================================================================
// System Prompt
// ============================================================================

const RED_TEAM_SYSTEM_PROMPT = `You are a Red Team analyst for a Value Engineering platform. Your role is to stress-test value claims by simulating CFO-level pushback.

For each value claim, you must:
1. Challenge underlying assumptions — are they realistic or optimistic?
2. Question data sources — are they current, reliable, and properly cited?
3. Probe for math errors — do the numbers add up? Are projections reasonable?
4. Identify missing evidence — what claims lack supporting data?
5. Find logical gaps — does the narrative follow from the evidence?

You MUST respond with valid JSON matching this schema:
{
  "objections": [...],
  "summary": "<overall assessment>",
  "hasCritical": <true if any critical objections>,
  "confidence": "high" | "medium" | "low"
}

Be thorough but fair. Only mark objections as "critical" if they would materially change the business case conclusion.`;

// ============================================================================
// RedTeamAgent
// ============================================================================

export class RedTeamAgent extends BaseAgent {
  public readonly lifecycleStage = 'integrity';
  public readonly version = '2.0.0';
  public readonly name = 'RedTeamAgent';

  /**
   * Accepts a RedTeamLLMGateway (or LLMGateway) and MemorySystem.
   * CircuitBreaker is created internally with default config.
   * This signature is intentionally minimal so tests can inject mocks directly.
   */
  constructor(
    gateway: RedTeamLLMGateway,
    memorySystem: MemorySystem,
  ) {
    super(
      { name: 'RedTeamAgent', lifecycle_stage: 'integrity' as const },
      // organizationId is set per-call from RedTeamInput.tenantId
      'system',
      memorySystem,
      // RedTeamLLMGateway.complete() is structurally compatible with LLMGateway.complete()
      gateway as unknown as LLMGateway,
      new CircuitBreaker(),
    );
  }

  /**
   * Execute red team analysis on a value case.
   * All LLM calls go through secureInvoke (circuit breaker + hallucination detection).
   */
  async analyze(input: RedTeamInput): Promise<RedTeamOutput> {
    // Set organizationId for this call so secureInvoke propagates tenant context correctly
    (this as unknown as { organizationId: string }).organizationId = input.tenantId;

    const prompt = [
      RED_TEAM_SYSTEM_PROMPT,
      '',
      '## Value Tree',
      '```json',
      JSON.stringify(input.valueTree, null, 2),
      '```',
      '',
      '## Narrative',
      '```json',
      JSON.stringify(input.narrativeBlock, null, 2),
      '```',
      '',
      '## Evidence Bundle',
      '```json',
      JSON.stringify(input.evidenceBundle, null, 2),
      '```',
      '',
      'Analyze the above value case. Identify all weaknesses, questionable assumptions, data quality issues, math errors, missing evidence, and logical gaps. Respond with JSON only.',
    ].join('\n');

    const result = await this.secureInvoke(
      input.valueCaseId,
      prompt,
      RedTeamOutputSchema,
      {
        trackPrediction: true,
        confidenceThresholds: { low: 0.6, high: 0.85 },
        context: {
          agentType: 'red-team',
          valueCaseId: input.valueCaseId,
          idempotencyKey: input.idempotencyKey,
        },
        idempotencyKey: input.idempotencyKey,
      },
    );

    const hallucinationDetails = result.hallucination_details
      ? {
          grounding_score: result.hallucination_details.groundingScore,
          matched_signals: result.hallucination_details.signals.map((s) => s.type),
          requires_escalation: result.hallucination_details.requiresEscalation,
        }
      : undefined;

    return {
      objections: result.objections,
      summary: result.summary,
      hasCritical: result.hasCritical,
      confidence: result.confidence ?? 'medium',
      timestamp: new Date().toISOString(),
      hallucination_check: result.hallucination_check,
      hallucination_details: hallucinationDetails,
    };
  }

  /**
   * Required by BaseAgent — not used in the red-team path (use analyze() instead).
   */
  async execute(_context: LifecycleContext): Promise<AgentOutput> {
    return this.prepareOutput({ error: 'Use RedTeamAgent.analyze() directly' }, 'error');
  }

  /** Check if any objections are critical (requiring automatic revision). */
  static hasCriticalObjections(objections: Objection[]): boolean {
    return objections.some((o) => o.severity === 'critical');
  }

  /** Filter objections by severity. */
  static filterBySeverity(
    objections: Objection[],
    severity: Objection['severity'],
  ): Objection[] {
    return objections.filter((o) => o.severity === severity);
  }
}
