/**
 * IntegrityAgent
 *
 * Validation gate in the VALIDATING phase of the value lifecycle.
 * Retrieves KPI targets and hypotheses from memory, uses the LLM to
 * validate each claim against its evidence, and produces a pass/veto
 * decision that controls the saga transition to COMPOSING.
 *
 * Output includes per-claim validation results, an overall integrity
 * score, a veto decision, and SDUI sections (IntegrityVetoPanel +
 * ConfidenceDisplay).
 */

import { z } from 'zod';

import { loadDomainContext } from '../../../agents/context/loadDomainContext.js';
import type { DomainContext } from '../../../agents/context/loadDomainContext.js';
import { featureFlags } from '../../../config/featureFlags.js';
import type {
  AgentOutput,
  AgentOutputMetadata,
  ConfidenceLevel,
  LifecycleContext,
} from '../../../types/agent.js';
import { logger } from '../../logger.js';
import { buildEventEnvelope, getDomainEventBus } from '../../../events/DomainEventBus.js';
import { integrityOutputRepository } from '../../../repositories/IntegrityOutputRepository.js';

import { IntegrityResultRepository } from '../../../repositories/IntegrityResultRepository.js';
import { BaseAgent } from './BaseAgent.js';

// ---------------------------------------------------------------------------
// Zod schemas for LLM output validation
// ---------------------------------------------------------------------------

const ClaimValidationSchema = z.object({
  claim_id: z.string(),
  claim_text: z.string(),
  verdict: z.enum(['supported', 'partially_supported', 'unsupported', 'insufficient_evidence']),
  confidence: z.number().min(0).max(1),
  evidence_assessment: z.string(),
  issues: z.array(z.object({
    type: z.enum(['hallucination', 'data_integrity', 'logic_error', 'unsupported_assumption', 'stale_data']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
  })),
  suggested_fix: z.string().optional(),
});

const IntegrityAnalysisSchema = z.object({
  claim_validations: z.array(ClaimValidationSchema).min(1),
  overall_assessment: z.string(),
  data_quality_score: z.number().min(0).max(1),
  logical_consistency_score: z.number().min(0).max(1),
  evidence_coverage_score: z.number().min(0).max(1),
});

type IntegrityAnalysis = z.infer<typeof IntegrityAnalysisSchema>;

// ---------------------------------------------------------------------------
// Exported types (kept compatible with existing evaluateVetoDecision contract)
// ---------------------------------------------------------------------------

export interface IntegrityIssue {
  type: 'hallucination' | 'data_integrity' | 'confidence' | 'logic_error';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface IntegrityCheck {
  isValid: boolean;
  confidence: number;
  issues: IntegrityIssue[];
}

export interface VetoDecision {
  veto: boolean;
  reRefine: boolean;
  reason: string;
  policy_traces?: PolicyTraceEntry[];
}

export interface PolicyTraceEntry {
  claim_id: string;
  rule: 'evidence_presence' | 'source_freshness' | 'range_plausibility' | 'contradiction_detection' | 'deterministic_gate';
  severity: 'low' | 'medium' | 'high';
  outcome: 'pass' | 'refine' | 'veto';
  message: string;
}

export interface DeterministicPolicyEvaluation {
  claimIssues: Record<string, IntegrityIssue[]>;
  traces: PolicyTraceEntry[];
  hasVeto: boolean;
  requiresRefine: boolean;
}

interface IntegrityClaim {
  id: string;
  text: string;
  evidence: string[];
  source: string;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class IntegrityAgent extends BaseAgent {
  private readonly integrityRepo = new IntegrityResultRepository();

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    // Step 1: Retrieve KPIs and hypotheses from memory
    const kpis = await this.retrieveKPIs(context);
    const hypotheses = await this.retrieveHypotheses(context);

    if (kpis.length === 0 && hypotheses.length === 0) {
      return this.buildOutput(
        { error: 'No KPIs or hypotheses found in memory. Run TargetAgent and OpportunityAgent first.', validated: false },
        'failure', 'low', startTime,
      );
    }

    // Step 1b: Load domain pack context for risk weights and compliance rules
    const domainContext = await this.loadDomainPackContext(context);

    // Step 2: Build claims from KPIs + hypotheses for validation
    const claims = this.buildClaims(kpis, hypotheses);

    // Step 3: Deterministic policy checks gate decisioning before LLM verdicting
    const deterministicPolicy = this.evaluateDeterministicPolicies(claims);

    // Step 4: Validate claims via LLM (with domain context) for supplemental explanation
    const analysis = await this.validateClaims(context, claims, domainContext);
    const finalAnalysis = analysis ?? this.buildFallbackAnalysisFromPolicy(claims, deterministicPolicy);

    // Step 5: Compute integrity result and veto decision (deterministic-first)
    const integrityResult = this.computeIntegrityResult(finalAnalysis, deterministicPolicy);
    const vetoDecision = IntegrityAgent.evaluateVetoDecision(integrityResult, deterministicPolicy);

    // Step 6: Store validation results in memory
    await this.storeValidationInMemory(context, finalAnalysis, vetoDecision);

    // Step 6b: Persist output to integrity_outputs table so it survives restarts
    await this.persistOutput(context, finalAnalysis, integrityResult, vetoDecision);

    // Step 7: Build SDUI sections
    const sduiSections = this.buildSDUISections(finalAnalysis, integrityResult, vetoDecision);

    const validated = !vetoDecision.veto && !vetoDecision.reRefine && integrityResult.isValid;
    const status: AgentOutput['status'] =
      vetoDecision.veto || !integrityResult.isValid
        ? 'failure'
        : validated
          ? 'success'
          : 'partial_success';

    const supported = finalAnalysis.claim_validations.filter(c => c.verdict === 'supported').length;
    const total = finalAnalysis.claim_validations.length;

    const result = {
      validated,
      claim_validations: finalAnalysis.claim_validations,
      overall_assessment: finalAnalysis.overall_assessment,
      scores: {
        data_quality: finalAnalysis.data_quality_score,
        logical_consistency: finalAnalysis.logical_consistency_score,
        evidence_coverage: finalAnalysis.evidence_coverage_score,
        overall: integrityResult.confidence,
      },
      integrity: integrityResult,
      veto_decision: vetoDecision,
      policy_traces: deterministicPolicy.traces,
      claims_checked: total,
      claims_supported: supported,
      sdui_sections: sduiSections,
    };

    // Persist integrity result to DB for frontend retrieval.
    const valueCaseId = context.user_inputs?.value_case_id as string | undefined;
    if (valueCaseId && context.organization_id) {
      try {
        await this.integrityRepo.createResult(valueCaseId, context.organization_id, {
          session_id: context.workspace_id,
          claims: finalAnalysis.claim_validations,
          veto_decision: vetoDecision.veto ? 'veto' : vetoDecision.reRefine ? 're_refine' : 'pass',
          overall_score: integrityResult.confidence,
          data_quality_score: finalAnalysis.data_quality_score,
          logic_score: finalAnalysis.logical_consistency_score,
          evidence_score: finalAnalysis.evidence_coverage_score,
          hallucination_check: !vetoDecision.veto,
        });
      } catch (err) {
        logger.error('IntegrityAgent: failed to persist result', { error: (err as Error).message });
      }
    }

    // Publish domain event so downstream services can react to validation outcomes.
    const opportunityId = (context.user_inputs?.opportunity_id as string | undefined)
      ?? context.workspace_id;
    await this.publishHypothesisValidated(context, opportunityId, finalAnalysis, integrityResult, vetoDecision, supported, total);

    return this.buildOutput(result, status, this.toConfidenceLevel(integrityResult.confidence), startTime, {
      reasoning: `Validated ${total} claims: ${supported} supported, ${total - supported} flagged. ` +
        `Integrity score: ${(integrityResult.confidence * 100).toFixed(0)}%. ` +
        (vetoDecision.veto ? `VETOED: ${vetoDecision.reason}` : vetoDecision.reRefine ? `Re-refinement requested: ${vetoDecision.reason}` : 'Passed.'),
      suggested_next_actions: vetoDecision.veto
        ? ['Address data integrity issues', 'Re-run TargetAgent with corrected inputs']
        : vetoDecision.reRefine
          ? ['Review flagged claims', 'Strengthen evidence for weak hypotheses']
          : ['Proceed to NarrativeAgent for business case composition'],
    });
  }

  private async publishHypothesisValidated(
    context: LifecycleContext,
    opportunityId: string,
    analysis: IntegrityAnalysis,
    integrityResult: { confidence: number },
    vetoDecision: { veto: boolean; reRefine: boolean },
    supportedCount: number,
    totalCount: number,
  ): Promise<void> {
    try {
      const traceId = (context.metadata?.trace_id as string | undefined) ?? context.workspace_id;
      await getDomainEventBus().publish('hypothesis.validated', {
        ...buildEventEnvelope({
          traceId,
          tenantId: context.organization_id,
          actorId: context.user_id,
        }),
        opportunityId,
        workspaceId: context.workspace_id,
        supportedClaimCount: supportedCount,
        totalClaimCount: totalCount,
        integrityScore: integrityResult.confidence,
        vetoed: vetoDecision.veto,
        reRefineRequested: vetoDecision.reRefine,
      });
    } catch (err) {
      logger.warn('IntegrityAgent: failed to publish hypothesis.validated event', {
        workspace_id: context.workspace_id,
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Domain Pack Context
  // -------------------------------------------------------------------------

  private async loadDomainPackContext(context: LifecycleContext): Promise<DomainContext> {
    const empty: DomainContext = { pack: undefined, kpis: [], assumptions: [], glossary: {}, complianceRules: [] };

    if (!featureFlags.ENABLE_DOMAIN_PACK_CONTEXT) return empty;

    const valueCaseId = context.user_inputs?.value_case_id as string | undefined;
    if (!valueCaseId || !context.organization_id) return empty;

    try {
      const supabaseClient = context.supabaseClient;
      return await loadDomainContext(context.organization_id, valueCaseId, supabaseClient);
    } catch (err) {
      logger.warn('IntegrityAgent: failed to load domain pack context', {
        value_case_id: valueCaseId,
        error: (err as Error).message,
      });
      return empty;
    }
  }

  // -------------------------------------------------------------------------
  // Memory Retrieval
  // -------------------------------------------------------------------------

  private async retrieveKPIs(context: LifecycleContext): Promise<Array<{ id: string; content: string; metadata: Record<string, unknown> }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'target',
        memory_type: 'semantic',
        limit: 20,
        organization_id: context.organization_id,
        workspace_id: context.workspace_id,
      });
      return memories
        .filter(m => m.metadata?.kpi_id)
        .map(m => ({ id: m.id, content: m.content, metadata: m.metadata || {} }));
    } catch (err) {
      logger.warn('Failed to retrieve KPIs from memory', { error: (err as Error).message });
      return [];
    }
  }

  private async retrieveHypotheses(context: LifecycleContext): Promise<Array<{ id: string; content: string; metadata: Record<string, unknown> }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'opportunity',
        memory_type: 'semantic',
        limit: 10,
        organization_id: context.organization_id,
        workspace_id: context.workspace_id,
      });
      return memories
        .filter(m => m.metadata?.verified === true && m.metadata?.category)
        .map(m => ({ id: m.id, content: m.content, metadata: m.metadata || {} }));
    } catch (err) {
      logger.warn('Failed to retrieve hypotheses from memory', { error: (err as Error).message });
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Claim Construction
  // -------------------------------------------------------------------------

  private buildClaims(
    kpis: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    hypotheses: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
  ): IntegrityClaim[] {
    const claims: IntegrityClaim[] = [];

    for (const kpi of kpis) {
      const m = kpi.metadata;
      claims.push({
        id: `kpi-${m.kpi_id || kpi.id}`,
        text: `KPI "${kpi.content}" can move from baseline ${m.baseline?.value} to target ${m.target?.value} ${m.unit || ''} within ${m.target?.timeframe_months || '?'} months.`,
        evidence: [
          `Baseline source: ${m.baseline?.source || 'unspecified'}`,
          `Measurement method: ${m.measurement_method || 'unspecified'}`,
          `Causal verification: ${m.causal_verified ? 'verified' : 'unverified'} (confidence: ${m.causal_confidence ?? 'N/A'})`,
        ],
        source: 'target',
      });
    }

    for (const hyp of hypotheses) {
      const m = hyp.metadata;
      const impact = m.estimated_impact || {};
      claims.push({
        id: `hyp-${hyp.id}`,
        text: `${hyp.content} with estimated impact ${impact.low || '?'}-${impact.high || '?'} ${impact.unit || ''} over ${impact.timeframe_months || '?'} months.`,
        evidence: m.evidence || [],
        source: 'opportunity',
      });
    }

    return claims;
  }

  // -------------------------------------------------------------------------
  // LLM Claim Validation
  // -------------------------------------------------------------------------

  private async validateClaims(
    context: LifecycleContext,
    claims: IntegrityClaim[],
    domainContext?: DomainContext,
  ): Promise<IntegrityAnalysis | null> {
    const claimsContext = claims.map((c, i) =>
      `${i + 1}. [${c.id}] ${c.text}\n   Evidence: ${c.evidence.join('; ')}`
    ).join('\n\n');

    // Build domain-specific context for the prompt
    let domainFragment = '';
    if (domainContext?.complianceRules && domainContext.complianceRules.length > 0) {
      domainFragment += `\n\nIndustry compliance requirements to validate against:\n${domainContext.complianceRules.map(r => `- ${r}`).join('\n')}`;
    }
    if (domainContext?.glossary && Object.keys(domainContext.glossary).length > 0) {
      domainFragment += `\n\nUse these domain-specific terms:\n${Object.entries(domainContext.glossary).map(([k, v]) => `- "${k}" → "${v}"`).join('\n')}`;
    }

    const systemPrompt = `You are a Value Engineering integrity validator. Your job is to assess whether value claims are supported by their evidence.

For each claim, determine:
- verdict: "supported" (evidence clearly backs the claim), "partially_supported" (some evidence, gaps remain), "unsupported" (evidence contradicts or is irrelevant), "insufficient_evidence" (not enough data)
- confidence: 0.0-1.0 reflecting how certain you are of the verdict
- issues: any problems found (hallucination, data_integrity, logic_error, unsupported_assumption, stale_data)
- suggested_fix: how to address issues (optional)

Also provide:
- overall_assessment: summary of the validation
- data_quality_score: 0.0-1.0 for data source reliability
- logical_consistency_score: 0.0-1.0 for internal logical consistency
- evidence_coverage_score: 0.0-1.0 for how well evidence covers claims

Be strict. Flag unsupported assumptions. Respond with valid JSON. No markdown fences.${domainFragment}`;

    const userPrompt = `Validate these ${claims.length} value claims:\n\n${claimsContext}`;

    try {
      return await this.secureInvoke<IntegrityAnalysis>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        IntegrityAnalysisSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.5, high: 0.8 },
          context: { agent: 'integrity', organization_id: context.organization_id, claim_count: claims.length },
        },
      );
    } catch (err) {
      logger.error('Claim validation failed', { error: (err as Error).message, workspace_id: context.workspace_id });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Integrity Scoring
  // -------------------------------------------------------------------------

  private evaluateDeterministicPolicies(claims: IntegrityClaim[]): DeterministicPolicyEvaluation {
    const traces: PolicyTraceEntry[] = [];
    const claimIssues: Record<string, IntegrityIssue[]> = {};

    const addIssue = (claimId: string, issue: IntegrityIssue, trace: PolicyTraceEntry): void => {
      claimIssues[claimId] = [...(claimIssues[claimId] ?? []), issue];
      traces.push(trace);
    };

    for (const claim of claims) {
      const stringEvidence = (claim.evidence ?? []).filter(
        (e): e is string => typeof e === 'string',
      );
      const normalizedEvidence = stringEvidence.map(e => e.toLowerCase());

      if (stringEvidence.length === 0 || stringEvidence.every(e => !e.trim())) {
        addIssue(
          claim.id,
          { type: 'data_integrity', severity: 'high', description: `[${claim.id}] Missing evidence for claim.` },
          { claim_id: claim.id, rule: 'evidence_presence', severity: 'high', outcome: 'veto', message: 'No supporting evidence provided.' },
        );
      }

      const staleEvidence = normalizedEvidence.some(e => e.includes('old') || e.includes('stale') || e.includes('2022') || e.includes('2021'));
      if (staleEvidence) {
        addIssue(
          claim.id,
          { type: 'data_integrity', severity: 'high', description: `[${claim.id}] Source freshness failed; stale evidence detected.` },
          { claim_id: claim.id, rule: 'source_freshness', severity: 'high', outcome: 'veto', message: 'Evidence indicates stale or outdated source material.' },
        );
      }

      const numericMatches = claim.text.match(/-?\d+(?:\.\d+)?/g) ?? [];
      if (numericMatches.length >= 2) {
        const first = Number(numericMatches[0]);
        const second = Number(numericMatches[1]);
        const ratio = Math.abs(second) > 0 ? Math.abs(first / second) : Number.POSITIVE_INFINITY;
        if (!Number.isNaN(ratio) && ratio > 10) {
          addIssue(
            claim.id,
            { type: 'logic_error', severity: 'medium', description: `[${claim.id}] Range plausibility check flagged an extreme ratio (${ratio.toFixed(2)}).` },
            { claim_id: claim.id, rule: 'range_plausibility', severity: 'medium', outcome: 'refine', message: `Range plausibility check flagged ratio ${ratio.toFixed(2)}.` },
          );
        }
      }

      const hasContradiction = normalizedEvidence.some(e => e.includes('unverified') || e.includes('contradict') || e.includes('disputed'));
      if (hasContradiction) {
        addIssue(
          claim.id,
          { type: 'logic_error', severity: 'high', description: `[${claim.id}] Contradiction detected between claim and evidence.` },
          { claim_id: claim.id, rule: 'contradiction_detection', severity: 'high', outcome: 'veto', message: 'Evidence contains contradiction indicators (unverified/disputed).' },
        );
      }

      if (!(claimIssues[claim.id]?.length)) {
        traces.push({
          claim_id: claim.id,
          rule: 'deterministic_gate',
          severity: 'low',
          outcome: 'pass',
          message: 'All deterministic policy checks passed.',
        });
      }
    }

    const hasVeto = traces.some(t => t.outcome === 'veto');
    const requiresRefine = !hasVeto && traces.some(t => t.outcome === 'refine');

    return { claimIssues, traces, hasVeto, requiresRefine };
  }

  private buildFallbackAnalysisFromPolicy(claims: IntegrityClaim[], policy: DeterministicPolicyEvaluation): IntegrityAnalysis {
    return {
      claim_validations: claims.map(claim => {
        const deterministicIssues = policy.claimIssues[claim.id] ?? [];
        const hasVetoIssue = deterministicIssues.some(issue => issue.severity === 'high');
        return {
          claim_id: claim.id,
          claim_text: claim.text,
          verdict: hasVetoIssue ? 'unsupported' : deterministicIssues.length > 0 ? 'partially_supported' : 'supported',
          confidence: hasVetoIssue ? 0.3 : deterministicIssues.length > 0 ? 0.6 : 0.85,
          evidence_assessment: hasVetoIssue
            ? 'Deterministic policy checks vetoed this claim before LLM analysis.'
            : deterministicIssues.length > 0
              ? 'Deterministic policy checks require evidence refinement.'
              : 'Deterministic policy checks passed.',
          issues: deterministicIssues.map(issue => ({
            type: issue.type === 'data_integrity' ? 'data_integrity' : issue.type,
            severity: issue.severity,
            description: issue.description,
          })),
          suggested_fix: deterministicIssues.length > 0
            ? 'Update evidence quality, freshness, and consistency before rerunning integrity validation.'
            : undefined,
        };
      }),
      overall_assessment: policy.hasVeto
        ? 'Deterministic policy checks vetoed one or more claims.'
        : policy.requiresRefine
          ? 'Deterministic policy checks found issues requiring refinement.'
          : 'Deterministic policy checks passed for all claims.',
      data_quality_score: policy.hasVeto ? 0.4 : policy.requiresRefine ? 0.7 : 0.9,
      logical_consistency_score: policy.hasVeto ? 0.45 : policy.requiresRefine ? 0.72 : 0.9,
      evidence_coverage_score: policy.hasVeto ? 0.4 : policy.requiresRefine ? 0.7 : 0.9,
    };
  }

  private computeIntegrityResult(analysis: IntegrityAnalysis, policy: DeterministicPolicyEvaluation): IntegrityCheck {
    const issues: IntegrityIssue[] = [];

    for (const cv of analysis.claim_validations) {
      for (const issue of cv.issues) {
        issues.push({
          type: issue.type === 'unsupported_assumption' || issue.type === 'stale_data'
            ? 'data_integrity'
            : issue.type as IntegrityIssue['type'],
          severity: issue.severity === 'critical' ? 'high' : issue.severity as IntegrityIssue['severity'],
          description: `[${cv.claim_id}] ${issue.description}`,
        });
      }
    }

    const overallConfidence = (
      analysis.data_quality_score +
      analysis.logical_consistency_score +
      analysis.evidence_coverage_score
    ) / 3;

    const hasHighSeverity = issues.some(i => i.severity === 'high');

    return {
      isValid: !hasHighSeverity && !policy.hasVeto,
      confidence: Math.max(0, Math.min(1, overallConfidence)),
      issues,
    };
  }

  // -------------------------------------------------------------------------
  // Veto Decision (static for testability)
  // -------------------------------------------------------------------------

  /**
   * Evaluate whether to veto or request re-refinement.
   * Static so it can be unit-tested without constructing a full agent.
   */
  static evaluateVetoDecision(result: IntegrityCheck, policy: DeterministicPolicyEvaluation): VetoDecision {
    if (policy.hasVeto) {
      return {
        veto: true,
        reRefine: false,
        reason: 'Deterministic policy gate vetoed one or more claims',
        policy_traces: policy.traces.filter(trace => trace.outcome === 'veto'),
      };
    }

    if (policy.requiresRefine) {
      return {
        veto: false,
        reRefine: true,
        reason: 'Deterministic policy gate requires evidence refinement',
        policy_traces: policy.traces.filter(trace => trace.outcome === 'refine'),
      };
    }

    return {
      veto: false,
      reRefine: false,
      reason: 'All deterministic integrity checks passed',
      policy_traces: policy.traces.filter(trace => trace.outcome === 'pass'),
    };
  }

  // -------------------------------------------------------------------------
  // Memory Storage
  // -------------------------------------------------------------------------

  private async storeValidationInMemory(
    context: LifecycleContext,
    analysis: IntegrityAnalysis,
    vetoDecision: VetoDecision,
  ): Promise<void> {
    try {
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'integrity',
        'semantic',
        `Integrity validation: ${analysis.claim_validations.length} claims checked. ` +
          `${analysis.claim_validations.filter(c => c.verdict === 'supported').length} supported. ` +
          (vetoDecision.veto ? 'VETOED.' : vetoDecision.reRefine ? 'Re-refinement requested.' : 'Passed.'),
        {
          type: 'integrity_validation',
          claim_count: analysis.claim_validations.length,
          supported_count: analysis.claim_validations.filter(c => c.verdict === 'supported').length,
          scores: {
            data_quality: analysis.data_quality_score,
            logical_consistency: analysis.logical_consistency_score,
            evidence_coverage: analysis.evidence_coverage_score,
          },
          veto: vetoDecision.veto,
          reRefine: vetoDecision.reRefine,
          policy_traces: vetoDecision.policy_traces ?? [],
          organization_id: context.organization_id,
          importance: 0.95,
        },
        context.organization_id,
      );
    } catch (err) {
      logger.warn('Failed to store integrity validation in memory', { error: (err as Error).message });
    }
  }

  // -------------------------------------------------------------------------
  // DB Persistence
  // -------------------------------------------------------------------------

  private async persistOutput(
    context: LifecycleContext,
    analysis: IntegrityAnalysis,
    integrityResult: IntegrityCheck,
    vetoDecision: VetoDecision,
  ): Promise<void> {
    const caseId = context.user_inputs?.value_case_id as string | undefined;
    const organizationId = context.organization_id;

    if (!caseId || !organizationId) {
      logger.warn('IntegrityAgent: skipping DB persistence — case_id or organization_id missing', {
        workspace_id: context.workspace_id,
        has_case_id: !!caseId,
        has_org_id: !!organizationId,
      });
      return;
    }

    try {
      const claims = analysis.claim_validations.map(cv => ({
        claim_id: cv.claim_id,
        text: cv.claim_text,
        confidence_score: cv.confidence,
        evidence_tier: undefined as number | undefined,
        // partially_supported is flagged so the UI surfaces evidence gaps for review,
        // not just outright failures.
        flagged: cv.verdict === 'unsupported' ||
          cv.verdict === 'insufficient_evidence' ||
          cv.verdict === 'partially_supported' ||
          cv.issues.some(i => i.severity === 'high' || i.severity === 'critical'),
        flag_reason: cv.issues.length > 0
          ? cv.issues.map(i => i.description).join('; ')
          : undefined,
      }));

      await integrityOutputRepository.upsertForCase({
        case_id: caseId,
        organization_id: organizationId,
        claims,
        overall_confidence: integrityResult.confidence,
        veto_triggered: vetoDecision.veto,
        veto_reason: vetoDecision.veto ? vetoDecision.reason : undefined,
        source_agent: 'IntegrityAgent',
      });

      logger.info('IntegrityAgent: output persisted', {
        case_id: caseId,
        organization_id: organizationId,
        claim_count: claims.length,
        veto_triggered: vetoDecision.veto,
        action: 'integrity_output_persisted',
      });
    } catch (err) {
      // Persistence failure must not break the agent response
      logger.error('IntegrityAgent: failed to persist output to DB', {
        case_id: caseId,
        organization_id: organizationId,
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // SDUI Output
  // -------------------------------------------------------------------------

  private buildSDUISections(
    analysis: IntegrityAnalysis,
    integrityResult: IntegrityCheck,
    vetoDecision: VetoDecision,
  ): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];
    const supported = analysis.claim_validations.filter(c => c.verdict === 'supported').length;
    const total = analysis.claim_validations.length;

    // Summary card
    sections.push({
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          agentId: 'integrity',
          agentName: 'Integrity Agent',
          timestamp: new Date().toISOString(),
          content: `${analysis.overall_assessment}\n\n${supported}/${total} claims supported. ${vetoDecision.veto ? 'VETOED.' : vetoDecision.reRefine ? 'Re-refinement requested.' : 'Passed.'}`,
          confidence: integrityResult.confidence,
          status: vetoDecision.veto ? 'error' : 'completed',
        },
        showReasoning: true,
        showActions: true,
        stage: 'integrity',
      },
    });

    // Confidence display
    sections.push({
      type: 'component',
      component: 'ConfidenceDisplay',
      version: 1,
      props: {
        data: {
          score: integrityResult.confidence,
          label: 'Integrity Score',
          trend: 'stable' as const,
        },
        size: 'lg',
        showTrend: false,
        showLabel: true,
      },
    });

    // IntegrityVetoPanel with issues (only if there are flagged claims)
    const panelIssues = analysis.claim_validations
      .filter(cv => cv.issues.length > 0 || cv.verdict !== 'supported')
      .map(cv => ({
        id: cv.claim_id,
        agentId: 'integrity',
        sessionId: '',
        issueType: cv.issues[0]?.type === 'hallucination' ? 'hallucination' as const
          : cv.issues[0]?.type === 'logic_error' ? 'logic_error' as const
          : cv.verdict === 'insufficient_evidence' ? 'low_confidence' as const
          : 'data_integrity' as const,
        severity: cv.issues[0]?.severity === 'critical' ? 'critical' as const
          : (cv.issues[0]?.severity || 'medium') as 'low' | 'medium' | 'high' | 'critical',
        description: `${cv.claim_text}: ${cv.evidence_assessment}`,
        originalOutput: { claim_id: cv.claim_id, verdict: cv.verdict },
        suggestedFix: cv.suggested_fix,
        confidence: cv.confidence,
        timestamp: new Date().toISOString(),
      }));

    if (panelIssues.length > 0) {
      sections.push({
        type: 'component',
        component: 'IntegrityVetoPanel',
        version: 1,
        props: { issues: panelIssues },
      });
    }

    return sections;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  // ...existing code...
}
