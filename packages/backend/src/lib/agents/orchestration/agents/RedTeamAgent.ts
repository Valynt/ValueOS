/**
 * Red Team Agent
 *
 * Stress-tests value claims by simulating CFO pushback.
 * Challenges assumptions, questions data sources, probes for math hallucinations.
 * Produces structured Objection[] with severity and category.
 */

import { z } from 'zod';

import { BaseAgent, type HallucinationCheckResult } from '../../../agent-fabric/agents/BaseAgent.js';
import { CircuitBreaker } from '../../../agent-fabric/CircuitBreaker.js';
import { type LLMGateway } from '../../../agent-fabric/LLMGateway.js';
import { MemorySystem } from '../../../agent-fabric/MemorySystem.js';
import type { AgentConfig, LifecycleContext } from '../../../../types/agent.js';

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
  confidence: 'low' | 'medium' | 'high';
  hallucination_check?: boolean;
  hallucination_details?: HallucinationCheckResult;
  timestamp: string;
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
  confidence: z.enum(['low', 'medium', 'high']),
  hallucination_check: z.boolean().optional(),
  hallucination_details: z.unknown().optional(),
  timestamp: z.string(),
});

const RedTeamLLMResponseSchema = RedTeamOutputSchema.omit({
  hallucination_details: true,
  timestamp: true,
}).extend({
  timestamp: z.string().optional(),
});

// ============================================================================
// LLM Interface (dependency injection)
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

const RED_TEAM_AGENT_CONFIG: AgentConfig = {
  id: 'red-team-agent',
  name: 'RedTeamAgent',
  type: 'narrative' as AgentConfig['type'],
  lifecycle_stage: 'integrity' as AgentConfig['lifecycle_stage'],
  capabilities: ['objection-analysis'],
  model: {
    provider: 'openai',
    model_name: 'gpt-4',
  },
  prompts: {
    system_prompt: 'Red-team analysis',
    user_prompt_template: '{{input}}',
  },
  parameters: {
    timeout_seconds: 30,
    max_retries: 2,
    retry_delay_ms: 500,
    enable_caching: false,
    enable_telemetry: true,
  },
  constraints: {
    max_input_tokens: 8000,
    max_output_tokens: 2000,
    allowed_actions: ['analyze'],
    forbidden_actions: [],
    required_permissions: [],
  },
};

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
  "objections": [
    {
      "id": "<unique-id>",
      "targetComponent": "<which value tree node or narrative claim>",
      "severity": "low" | "medium" | "high" | "critical",
      "category": "assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap",
      "description": "<specific objection>",
      "suggestedRevision": "<optional: how to fix>"
    }
  ],
  "summary": "<overall assessment>",
  "hasCritical": <true if any critical objections>,
  "confidence": "low" | "medium" | "high",
  "hallucination_check": <optional boolean>
}

Be thorough but fair. Only mark objections as "critical" if they would materially change the business case conclusion.`;

// ============================================================================
// RedTeamAgent
// ============================================================================

export class RedTeamAgent extends BaseAgent {
  constructor(
    llmGateway: RedTeamLLMGateway,
    memorySystem: MemorySystem = new MemorySystem({ max_memories: 100, enable_persistence: false }),
    circuitBreaker: CircuitBreaker = new CircuitBreaker(),
    organizationId = 'red-team-default-organization'
  ) {
    super(
      RED_TEAM_AGENT_CONFIG,
      organizationId,
      memorySystem,
      llmGateway as unknown as LLMGateway,
      circuitBreaker,
    );
  }

  async execute(_context: LifecycleContext) {
    throw new Error('RedTeamAgent.execute is not implemented. Use analyze() for orchestration flow.');
  }

  /**
   * Execute red team analysis on a value case
   */
  async analyze(input: RedTeamInput): Promise<RedTeamOutput> {
    this.organizationId = input.tenantId;

    const userPrompt = this.buildPrompt(input);
    const sessionId = `red-team:${input.valueCaseId}:${input.idempotencyKey}`;

    const result = await this.secureInvoke(
      sessionId,
      `${RED_TEAM_SYSTEM_PROMPT}\n\n${userPrompt}`,
      RedTeamLLMResponseSchema,
      {
        trackPrediction: true,
        confidenceThresholds: { low: 0.6, high: 0.85 },
        context: {
          tenantId: input.tenantId,
          tenant_id: input.tenantId,
          agentType: 'red-team',
          valueCaseId: input.valueCaseId,
          idempotencyKey: input.idempotencyKey,
        },
        idempotencyKey: input.idempotencyKey,
      },
    );

    return {
      objections: result.objections,
      summary: result.summary,
      hasCritical: result.hasCritical,
      confidence: result.confidence,
      hallucination_check: result.hallucination_check,
      hallucination_details: result.hallucination_details,
      timestamp: result.timestamp ?? new Date().toISOString(),
    };
  }

  /**
   * Check if any objections are critical (requiring automatic revision)
   */
  static hasCriticalObjections(objections: Objection[]): boolean {
    return objections.some((o) => o.severity === 'critical');
  }

  /**
   * Filter objections by severity
   */
  static filterBySeverity(
    objections: Objection[],
    severity: Objection['severity']
  ): Objection[] {
    return objections.filter((o) => o.severity === severity);
  }

  // ---- Private helpers ----

  private buildPrompt(input: RedTeamInput): string {
    return [
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
  }
}
