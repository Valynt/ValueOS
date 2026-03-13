/**
 * Red Team Agent
 *
 * Stress-tests value claims by simulating CFO pushback.
 * Challenges assumptions, questions data sources, probes for math hallucinations.
 * Produces structured Objection[] with severity and category.
 */

import { z } from 'zod';

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
  timestamp: z.string(),
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
  "hasCritical": <true if any critical objections>
}

Be thorough but fair. Only mark objections as "critical" if they would materially change the business case conclusion.`;

// ============================================================================
// RedTeamAgent
// ============================================================================

/**
 * Minimal interface consumed by HypothesisLoop. Satisfied by RedTeamAgent
 * and any test double.
 */
export interface RedTeamAnalyzer {
  analyze(input: RedTeamInput): Promise<RedTeamOutput>;
}

export class RedTeamAgent implements RedTeamAnalyzer {
  private llmGateway: RedTeamLLMGateway;

  constructor(llmGateway: RedTeamLLMGateway) {
    this.llmGateway = llmGateway;
  }

  /**
   * Execute red team analysis on a value case
   */
  async analyze(input: RedTeamInput): Promise<RedTeamOutput> {
    const userPrompt = this.buildPrompt(input);

    // RedTeamAgent uses constructor-injected RedTeamLLMGateway. In production the
    // injected implementation is RedTeamLLMAdapter (AgentAdapters.ts), which delegates
    // to secureLLMComplete — satisfying the guardrail requirement. Full BaseAgent
    // migration (secureInvoke + AgentFactory wiring) is tracked in debt.md.
    const response = await this.llmGateway.complete({
      messages: [
        { role: 'system', content: RED_TEAM_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      metadata: {
        tenantId: input.tenantId,
        agentType: 'red-team',
        valueCaseId: input.valueCaseId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    const parsed = this.parseResponse(response.content);

    return {
      ...parsed,
      timestamp: new Date().toISOString(),
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

  private parseResponse(content: string): RedTeamOutput {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1]!;
    }

    const raw = JSON.parse(jsonStr);
    const validated = RedTeamOutputSchema.parse({
      ...raw,
      timestamp: raw.timestamp ?? new Date().toISOString(),
    });

    return validated;
  }
}
