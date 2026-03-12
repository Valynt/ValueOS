/**
 * NarrativeAgent
 *
 * Sits in the NARRATIVE phase of the value lifecycle. Synthesises validated
 * integrity results, financial model outputs, and KPI targets into a
 * defensible executive narrative for the business case.
 *
 * Output includes a structured narrative draft, a defense readiness score,
 * and key talking points. Persists to narrative_drafts for frontend retrieval.
 */

import { z } from 'zod';

import { NarrativeDraftRepository } from '../../../repositories/NarrativeDraftRepository.js';
import type {
  AgentOutput,
  LifecycleContext,
} from '../../../types/agent.js';
import { logger } from '../../logger.js';
import { buildEventEnvelope, getDomainEventBus } from '../../../events/DomainEventBus.js';

import { BaseAgent } from './BaseAgent.js';
import { renderTemplate } from '../promptUtils.js';
import { resolvePromptTemplate } from '../promptRegistry.js';

// ---------------------------------------------------------------------------
// Zod schema for LLM output
// ---------------------------------------------------------------------------

const NarrativeOutputSchema = z.object({
  executive_summary: z.string().min(1),
  value_proposition: z.string().min(1),
  key_proof_points: z.array(z.string()).min(1).max(10),
  risk_mitigations: z.array(z.string()),
  call_to_action: z.string(),
  defense_readiness_score: z.number().min(0).max(1),
  talking_points: z.array(z.object({
    audience: z.enum(['executive', 'technical', 'financial', 'procurement']),
    point: z.string(),
  })),
  hallucination_check: z.boolean().optional(),
});

type NarrativeOutput = z.infer<typeof NarrativeOutputSchema>;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildNarrativePrompt(params: {
  organizationId: string;
  valueCaseId: string;
  claims: Array<Record<string, unknown>>;
  integrityScore: number;
  vetoDecision: string;
  kpis: Array<Record<string, unknown>>;
  financialSummary: string;
}): string {
  const claimLines = params.claims
    .map(c => `- ${String(c.claim_text ?? '')} (verdict: ${String(c.verdict ?? '')}, confidence: ${String(c.confidence ?? '')})`)
    .join('\n');

  const kpiLines = params.kpis
    .map(k => `- ${String(k.name ?? '')}: ${String(k.target ?? '')} ${String(k.unit ?? '')} (${String(k.timeframe ?? '')})`)
    .join('\n');

  const promptTemplate = resolvePromptTemplate('narrative_system');
  return renderTemplate(promptTemplate.template, {
    organizationId: params.organizationId,
    valueCaseId: params.valueCaseId,
    claimLines: claimLines || '(none)',
    integrityScore: String(params.integrityScore),
    vetoDecision: params.vetoDecision,
    kpiLines: kpiLines || '(none)',
    financialSummary: params.financialSummary,
  });
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class NarrativeAgent extends BaseAgent {
  public override readonly lifecycleStage = 'narrative';
  public override readonly version = '1.0.0';
  public override readonly name = 'NarrativeAgent';

  private readonly narrativeRepo = new NarrativeDraftRepository();

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();

    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    const valueCaseId = context.user_inputs?.value_case_id as string | undefined;
    const format = (context.user_inputs?.format as string | undefined) ?? 'executive_summary';

    // Step 1: Retrieve integrity results and KPI targets from prior stage outputs
    const integrityData = context.previous_stage_outputs?.integrity as Record<string, unknown> | undefined;
    const targetData = context.previous_stage_outputs?.target as Record<string, unknown> | undefined;
    const financialData = context.previous_stage_outputs?.modeling as Record<string, unknown> | undefined;

    const claims = (integrityData?.claim_validations as Array<Record<string, unknown>> | undefined) ?? [];
    const integrityScore = (integrityData?.scores as Record<string, number> | undefined)?.overall ?? 0;
    const vetoDecision = (integrityData?.veto_decision as Record<string, unknown> | undefined)?.veto ? 'VETOED' : 'PASSED';
    const kpis = (targetData?.kpi_targets as Array<Record<string, unknown>> | undefined) ?? [];
    const financialSummary = (financialData?.summary as string | undefined) ?? 'No financial model available.';

    // Step 2: Build prompt
    const promptTemplate = resolvePromptTemplate('narrative_system');
    this.setPromptVersionReferences([{ key: promptTemplate.key, version: promptTemplate.version }], [promptTemplate.approval]);
    const prompt = buildNarrativePrompt({
      organizationId: context.organization_id,
      valueCaseId: valueCaseId ?? 'unknown',
      claims,
      integrityScore,
      vetoDecision,
      kpis,
      financialSummary,
    });

    // Step 3: Invoke LLM via secureInvoke (circuit breaker + hallucination detection)
    let narrativeOutput: NarrativeOutput;
    try {
      narrativeOutput = await this.secureInvoke<NarrativeOutput>(
        context.workspace_id,
        prompt,
        NarrativeOutputSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.6, high: 0.85 },
          context: {
            agent: 'NarrativeAgent',
            organization_id: context.organization_id,
            value_case_id: valueCaseId,
          },
        },
      );
    } catch (err) {
      logger.error('NarrativeAgent: LLM invocation failed', { error: (err as Error).message });
      return this.buildOutput(
        { error: 'Narrative generation failed. Retry or provide more context.' },
        'failure', 'low', startTime,
      );
    }

    // Step 4: Store in memory for downstream agents
    await this.memorySystem.storeSemanticMemory(
      context.workspace_id,
      this.name,
      'episodic',
      JSON.stringify({ executive_summary: narrativeOutput.executive_summary, defense_readiness_score: narrativeOutput.defense_readiness_score }),
      {
        organization_id: context.organization_id,
        value_case_id: valueCaseId,
        lifecycle_stage: this.lifecycleStage,
        agent: this.name,
      },
      this.organizationId,
    );

    // Step 5: Persist to DB for frontend retrieval
    if (valueCaseId && context.organization_id) {
      try {
        const fullContent = [
          narrativeOutput.executive_summary,
          '',
          '## Value Proposition',
          narrativeOutput.value_proposition,
          '',
          '## Key Proof Points',
          ...narrativeOutput.key_proof_points.map(p => `- ${p}`),
          '',
          '## Risk Mitigations',
          ...narrativeOutput.risk_mitigations.map(r => `- ${r}`),
          '',
          '## Call to Action',
          narrativeOutput.call_to_action,
        ].join('\n');

        await this.narrativeRepo.createDraft(valueCaseId, context.organization_id, {
          session_id: context.workspace_id,
          content: fullContent,
          format: format as 'executive_summary' | 'technical' | 'board_deck' | 'customer_facing',
          defense_readiness_score: narrativeOutput.defense_readiness_score,
          hallucination_check: narrativeOutput.hallucination_check ?? false,
        });
      } catch (err) {
        logger.error('NarrativeAgent: failed to persist draft', { error: (err as Error).message });
      }
    }

    // Step 6: Publish domain event
    try {
      const traceId = (context.metadata?.trace_id as string | undefined) ?? context.workspace_id;
      await getDomainEventBus().publish('narrative.drafted', {
        ...buildEventEnvelope({
          traceId,
          tenantId: context.organization_id,
          actorId: context.user_id,
        }),
        organization_id: context.organization_id,
        value_case_id: valueCaseId,
        defense_readiness_score: narrativeOutput.defense_readiness_score,
        format,
      });
    } catch (err) {
      logger.warn('NarrativeAgent: failed to publish domain event', { error: (err as Error).message });
    }

    const result = {
      executive_summary: narrativeOutput.executive_summary,
      value_proposition: narrativeOutput.value_proposition,
      key_proof_points: narrativeOutput.key_proof_points,
      risk_mitigations: narrativeOutput.risk_mitigations,
      call_to_action: narrativeOutput.call_to_action,
      defense_readiness_score: narrativeOutput.defense_readiness_score,
      talking_points: narrativeOutput.talking_points,
      format,
    };

    const defenseScore = narrativeOutput.defense_readiness_score;
    const confidence = defenseScore >= 0.8 ? 'high' : defenseScore >= 0.6 ? 'medium' : 'low';

    return this.buildOutput(result, 'success', confidence, startTime, {
      reasoning: `Composed ${format} narrative with defense readiness score ${(defenseScore * 100).toFixed(0)}%. ` +
        `${narrativeOutput.key_proof_points.length} proof points, ${narrativeOutput.risk_mitigations.length} risk mitigations.`,
      suggested_next_actions: [
        'Review narrative with stakeholders',
        'Export business case as PDF',
        'Proceed to RealizationAgent for implementation planning',
      ],
    });
  }
}
