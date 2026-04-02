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
import { buildEventEnvelope, getDomainEventBus } from '../../../events/DomainEventBus.js';
import { integrityOutputRepository } from '../../../repositories/IntegrityOutputRepository.js';
import { IntegrityResultRepository } from '../../../repositories/IntegrityResultRepository.js';
import type {
  AgentOutput,
  AgentOutputMetadata,
  ConfidenceLevel,
  LifecycleContext,
} from '../../../types/agent.js';
import {
  computeConfidence,
  type ConfidenceInput,
} from '../../agents/core/ConfidenceScorer.js';
import {
  classifyEvidence,
  type EvidenceItem,
} from '../../agents/core/EvidenceTiering.js';
import { logger } from '../../logger.js';
import {
  claimVerificationService,
  type VerificationResult,
  type Claim,
} from '../../../services/ground-truth/ClaimVerificationService.js';
import { ReadinessScorer } from '../../../services/integrity/ReadinessScorer.js';

import { BaseAgent } from './BaseAgent.js';
import type { GraphIntegrityGap } from '@valueos/shared';

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

interface IntegrityClaim {
  id: string;
  text: string;
  evidence: string[];
  source: 'target' | 'opportunity';
  baselineValue?: number;
  targetValue?: number;
  timeframeMonths?: number;
  sourceAsOfDate?: string;
  impactLow?: number;
  impactHigh?: number;
}

interface PolicyTrace {
  claim_id: string;
  rule: 'evidence_presence' | 'source_freshness' | 'range_plausibility' | 'contradiction_detection';
  status: 'pass' | 'refine' | 'veto';
  message: string;
}

interface DeterministicPolicyOutput {
  claimValidations: IntegrityAnalysis['claim_validations'];
  policyTrace: PolicyTrace[];
  overallAssessment: string;
  dataQualityScore: number;
  logicalConsistencyScore: number;
  evidenceCoverageScore: number;
}

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
  policy_trace?: PolicyTrace[];
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class IntegrityAgent extends BaseAgent {
  public override readonly version = "1.0.0";

  private readonly integrityRepo = new IntegrityResultRepository();
  private readonly readinessScorer = new ReadinessScorer();

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

    // Step 3: Deterministic rules execute before any LLM reasoning.
    const deterministicPolicy = this.evaluateDeterministicPolicy(claims);

    // Step 4: LLM is supplemental explanation only (decisioning stays deterministic).
    const llmAnalysis = await this.validateClaims(context, claims, domainContext);
    const analysis = this.composeFinalAnalysis(deterministicPolicy, llmAnalysis);

    // Step 5: Compute integrity result and veto decision from deterministic policy output
    const integrityResult = this.computeIntegrityResult(analysis);
    const vetoDecision = IntegrityAgent.evaluateVetoDecision(integrityResult, deterministicPolicy.policyTrace);

    // Step 5: Store validation results in memory
    await this.storeValidationInMemory(context, analysis, vetoDecision);

    // Step 5b: Persist output to integrity_outputs table so it survives restarts
    await this.persistOutput(context, analysis, integrityResult, vetoDecision);

    // Step 5c: Calculate readiness score for the case
    let readiness: Awaited<ReturnType<ReadinessScorer['calculateReadiness']>> | undefined;
    const valueCaseId = context.user_inputs?.value_case_id as string | undefined;
    if (valueCaseId && context.organization_id) {
      try {
        readiness = await this.readinessScorer.calculateReadiness(valueCaseId, context.organization_id);
      } catch (err) {
        logger.warn('IntegrityAgent: failed to calculate readiness score', {
          case_id: valueCaseId,
          error: (err as Error).message,
        });
      }
    }

    // Step 6: Build SDUI sections
    const sduiSections = this.buildSDUISections(analysis, integrityResult, vetoDecision);

    const validated = integrityResult.isValid && !vetoDecision.veto && !vetoDecision.reRefine;
    const status: AgentOutput['status'] = vetoDecision.veto
      ? 'failure'
      : validated ? 'success' : 'partial_success';

    const supported = analysis.claim_validations.filter(c => c.verdict === 'supported').length;
    const total = analysis.claim_validations.length;

    const result = {
      validated,
      claim_validations: analysis.claim_validations,
      overall_assessment: analysis.overall_assessment,
      scores: {
        data_quality: analysis.data_quality_score,
        logical_consistency: analysis.logical_consistency_score,
        evidence_coverage: analysis.evidence_coverage_score,
        overall: integrityResult.confidence,
      },
      integrity: integrityResult,
      veto_decision: vetoDecision,
      policy_trace: deterministicPolicy.policyTrace,
      claims_checked: total,
      claims_supported: supported,
      readiness,
      sdui_sections: sduiSections,
    };

    // Persist integrity result to DB for frontend retrieval.
    if (valueCaseId && context.organization_id) {
      try {
        await this.integrityRepo.createResult(valueCaseId, context.organization_id, {
          session_id: context.workspace_id,
          claims: analysis.claim_validations,
          veto_decision: vetoDecision.veto ? 'veto' : vetoDecision.reRefine ? 're_refine' : 'pass',
          overall_score: integrityResult.confidence,
          data_quality_score: analysis.data_quality_score,
          logic_score: analysis.logical_consistency_score,
          evidence_score: analysis.evidence_coverage_score,
          hallucination_check: !vetoDecision.veto,
        });
      } catch (err) {
        logger.error('IntegrityAgent: failed to persist result', { error: (err as Error).message });
      }
    }

    // Publish domain event so downstream services can react to validation outcomes.
    const opportunityId = (context.user_inputs?.opportunity_id as string | undefined)
      ?? context.workspace_id;
    await this.publishHypothesisValidated(context, opportunityId, analysis, integrityResult, vetoDecision, supported, total);

    // Step 7: Check Value Graph for structural integrity gaps (fire-and-forget)
    const graphIntegrityGaps = await this.checkGraphIntegrityGaps(context);

    return this.buildOutput(
      { ...result, graph_integrity_gaps: graphIntegrityGaps },
      status,
      this.toConfidenceLevel(integrityResult.confidence),
      startTime,
      {
        reasoning: `Validated ${total} claims: ${supported} supported, ${total - supported} flagged. ` +
          `Integrity score: ${(integrityResult.confidence * 100).toFixed(0)}%. ` +
          (vetoDecision.veto ? `VETOED: ${vetoDecision.reason}` : vetoDecision.reRefine ? `Re-refinement requested: ${vetoDecision.reason}` : 'Passed.'),
        suggested_next_actions: vetoDecision.veto
          ? ['Address data integrity issues', 'Re-run TargetAgent with corrected inputs']
          : vetoDecision.reRefine
            ? ['Review flagged claims', 'Strengthen evidence for weak hypotheses']
            : ['Proceed to NarrativeAgent for business case composition'],
      },
    );
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
      if (!supabaseClient) {
        logger.warn('IntegrityAgent: supabaseClient not available in context');
        return empty;
      }
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
      const m = kpi.metadata as Record<string, Record<string, unknown> | unknown>;
      const baseline = m["baseline"] as Record<string, unknown> | undefined;
      const target = m["target"] as Record<string, unknown> | undefined;
      claims.push({
        id: `kpi-${m["kpi_id"] || kpi.id}`,
        text: `KPI "${kpi.content}" can move from baseline ${baseline?.["value"]} to target ${target?.["value"]} ${m["unit"] || ''} within ${target?.["timeframe_months"] || '?'} months.`,
        evidence: [
          `Baseline source: ${baseline?.["source"] || 'unspecified'}`,
          `Measurement method: ${m["measurement_method"] || 'unspecified'}`,
          `Causal verification: ${m["causal_verified"] ? 'verified' : 'unverified'} (confidence: ${m["causal_confidence"] ?? 'N/A'})`,
        ],
        source: 'target',
        baselineValue: typeof baseline?.["value"] === 'number' ? baseline["value"] as number : undefined,
        targetValue: typeof target?.["value"] === 'number' ? target["value"] as number : undefined,
        timeframeMonths: typeof target?.["timeframe_months"] === 'number' ? target["timeframe_months"] as number : undefined,
        sourceAsOfDate: typeof baseline?.["as_of_date"] === 'string' ? baseline["as_of_date"] as string : undefined,
      });
    }

    for (const hyp of hypotheses) {
      const m = hyp.metadata as Record<string, unknown>;
      const impact = (m["estimated_impact"] ?? {}) as Record<string, unknown>;
      const evidence = Array.isArray(m["evidence"]) ? m["evidence"] as unknown[] : [];
      claims.push({
        id: `hyp-${hyp.id}`,
        text: `${hyp.content} with estimated impact ${impact["low"] || '?'}-${impact["high"] || '?'} ${impact["unit"] || ''} over ${impact["timeframe_months"] || '?'} months.`,
        evidence,
        source: 'opportunity',
        timeframeMonths: typeof impact["timeframe_months"] === 'number' ? impact["timeframe_months"] : undefined,
        impactLow: typeof impact["low"] === 'number' ? impact["low"] : undefined,
        impactHigh: typeof impact["high"] === 'number' ? impact["high"] : undefined,
        sourceAsOfDate: typeof m["evidence_as_of_date"] === 'string' ? m["evidence_as_of_date"] : undefined,
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
- issues: list of problems found (hallucination, data_integrity, logic_error, unsupported_assumption, stale_data)
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
          userId: context.user_id,
          context: { agent: 'integrity', organization_id: context.organization_id, claim_count: claims.length },
        },
      );
    } catch (err) {
      logger.error('Claim validation failed', { error: (err as Error).message, workspace_id: context.workspace_id });
      return null;
    }
  }

  private composeFinalAnalysis(
    deterministic: DeterministicPolicyOutput,
    llmAnalysis: IntegrityAnalysis | null,
  ): IntegrityAnalysis {
    if (!llmAnalysis) {
      return {
        claim_validations: deterministic.claimValidations,
        overall_assessment: `${deterministic.overallAssessment} LLM explanation unavailable; deterministic policy used.`,
        data_quality_score: deterministic.dataQualityScore,
        logical_consistency_score: deterministic.logicalConsistencyScore,
        evidence_coverage_score: deterministic.evidenceCoverageScore,
      };
    }

    const llmByClaim = new Map(llmAnalysis.claim_validations.map(cv => [cv.claim_id, cv]));
    const claimValidations = deterministic.claimValidations.map((cv) => {
      const llmCv = llmByClaim.get(cv.claim_id);
      return {
        ...cv,
        evidence_assessment: llmCv?.evidence_assessment
          ? `${cv.evidence_assessment} Supplemental LLM review: ${llmCv.evidence_assessment}`
          : cv.evidence_assessment,
        suggested_fix: cv.suggested_fix ?? llmCv?.suggested_fix,
      };
    });

    return {
      claim_validations: claimValidations,
      overall_assessment: `${deterministic.overallAssessment} Supplemental LLM summary: ${llmAnalysis.overall_assessment}`,
      data_quality_score: deterministic.dataQualityScore,
      logical_consistency_score: deterministic.logicalConsistencyScore,
      evidence_coverage_score: deterministic.evidenceCoverageScore,
    };
  }

  private evaluateDeterministicPolicy(claims: IntegrityClaim[]): DeterministicPolicyOutput {
    const claimValidations: IntegrityAnalysis['claim_validations'] = [];
    const policyTrace: PolicyTrace[] = [];

    const rangeFingerprint = new Map<string, string>();

    for (const claim of claims) {
      const issues: z.infer<typeof ClaimValidationSchema>['issues'] = [];
      let verdict: z.infer<typeof ClaimValidationSchema>['verdict'] = 'supported';
      let confidence = 0.9;

      const hasEvidence = claim.evidence.some(e => e.trim().length > 0);
      if (!hasEvidence) {
        verdict = 'insufficient_evidence';
        confidence = Math.min(confidence, 0.4);
        issues.push({ type: 'data_integrity', severity: 'high', description: 'Missing evidence for claim' });
        policyTrace.push({ claim_id: claim.id, rule: 'evidence_presence', status: 'veto', message: 'No evidence entries were provided.' });
      } else {
        policyTrace.push({ claim_id: claim.id, rule: 'evidence_presence', status: 'pass', message: `Evidence entries found: ${claim.evidence.length}` });
      }

      const freshnessDays = this.calculateAgeInDays(claim.sourceAsOfDate);
      if (freshnessDays !== null && freshnessDays > 365) {
        verdict = verdict === 'supported' ? 'partially_supported' : verdict;
        confidence = Math.min(confidence, 0.6);
        issues.push({ type: 'stale_data', severity: freshnessDays > 540 ? 'high' : 'medium', description: `Evidence source is ${freshnessDays} days old.` });
        policyTrace.push({ claim_id: claim.id, rule: 'source_freshness', status: freshnessDays > 540 ? 'veto' : 'refine', message: `Source freshness exceeded policy (${freshnessDays} days old).` });
      } else {
        policyTrace.push({ claim_id: claim.id, rule: 'source_freshness', status: 'pass', message: freshnessDays === null ? 'No source date supplied; no freshness veto triggered.' : `Source age ${freshnessDays} days is within policy.` });
      }

      const rangeIssue = this.detectRangePlausibilityIssue(claim);
      if (rangeIssue) {
        verdict = verdict === 'supported' ? 'unsupported' : verdict;
        confidence = Math.min(confidence, rangeIssue.severity === 'high' ? 0.35 : 0.55);
        issues.push({ type: 'logic_error', severity: rangeIssue.severity, description: rangeIssue.message });
        policyTrace.push({ claim_id: claim.id, rule: 'range_plausibility', status: rangeIssue.severity === 'high' ? 'veto' : 'refine', message: rangeIssue.message });
      } else {
        policyTrace.push({ claim_id: claim.id, rule: 'range_plausibility', status: 'pass', message: 'Claim numeric ranges are plausible.' });
      }

      const contradictionKey = claim.source === 'target' && claim.baselineValue !== undefined
        ? claim.id.replace(/^kpi-/, '')
        : claim.text.toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
      const currentFingerprint = [claim.baselineValue, claim.targetValue, claim.impactLow, claim.impactHigh, claim.timeframeMonths].filter(v => v !== undefined).join('|');
      const hasExistingFingerprint = rangeFingerprint.has(contradictionKey);
      const existingFingerprint = hasExistingFingerprint ? rangeFingerprint.get(contradictionKey) : undefined;
      if (hasExistingFingerprint && existingFingerprint !== currentFingerprint) {
        verdict = verdict === 'supported' ? 'unsupported' : verdict;
        confidence = Math.min(confidence, 0.45);
        issues.push({ type: 'logic_error', severity: 'high', description: 'Contradictory claim ranges detected for similar claim key.' });
        policyTrace.push({ claim_id: claim.id, rule: 'contradiction_detection', status: 'veto', message: 'Conflicting deterministic ranges detected across claims.' });
      } else {
        rangeFingerprint.set(contradictionKey, currentFingerprint);
        policyTrace.push({ claim_id: claim.id, rule: 'contradiction_detection', status: 'pass', message: 'No contradictions detected for claim.' });
      }

      claimValidations.push({
        claim_id: claim.id,
        claim_text: claim.text,
        verdict,
        confidence,
        evidence_assessment: issues.length === 0
          ? 'Deterministic policy checks passed.'
          : issues.map(issue => issue.description).join(' '),
        issues,
        suggested_fix: issues.length > 0 ? 'Address policy trace violations and refresh supporting evidence.' : undefined,
      });
    }

    const supported = claimValidations.filter(cv => cv.verdict === 'supported').length;

    const vetoCount = policyTrace.filter(trace => trace.status === 'veto').length;
    const refineCount = policyTrace.filter(trace => trace.status === 'refine').length;
    const passCount = policyTrace.filter(trace =>
      trace.status !== 'veto' && trace.status !== 'refine',
    ).length;

    const dataQualityScore = this.roundScore(this.scoreByTrace(policyTrace, 'source_freshness'));
    const logicalConsistencyScore = this.roundScore(
      this.scoreByTrace(policyTrace, 'range_plausibility', 'contradiction_detection'),
    );
    const evidenceCoverageScore = this.roundScore(
      this.scoreByTrace(policyTrace, 'evidence_presence'),
    );

    let overallAssessment: string;
    if (vetoCount === 0 && refineCount === 0) {
      overallAssessment =
        `Deterministic integrity policy validated ${supported}/${claimValidations.length} ` +
        'claims without violations requiring veto.';
    } else {
      overallAssessment =
        `Deterministic integrity policy evaluated ${supported}/${claimValidations.length} claims. ` +
        `Policy trace summary: ${passCount} pass, ${refineCount} refine, ${vetoCount} veto.`;
    }

    return {
      claimValidations,
      policyTrace,
      overallAssessment,
      dataQualityScore,
      logicalConsistencyScore,
      evidenceCoverageScore,
    };
  }

  private scoreByTrace(policyTrace: PolicyTrace[], ...rules: PolicyTrace['rule'][]): number {
    const scoped = policyTrace.filter(trace => rules.includes(trace.rule));
    if (scoped.length === 0) {
      return 1;
    }

    const penalty = scoped.reduce((sum, trace) => {
      if (trace.status === 'veto') return sum + 0.5;
      if (trace.status === 'refine') return sum + 0.2;
      return sum;
    }, 0);

    return Math.max(0, 1 - penalty / scoped.length);
  }

  private calculateAgeInDays(asOfDate?: string): number | null {
    if (!asOfDate) {
      return null;
    }
    const parsed = Date.parse(asOfDate);
    if (Number.isNaN(parsed)) {
      return null;
    }
    const diffMs = Date.now() - parsed;
    if (diffMs < 0) {
      logger.warn('IntegrityAgent.calculateAgeInDays encountered future asOfDate', {
        asOfDate,
      });
      return null;
    }
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  private detectRangePlausibilityIssue(claim: IntegrityClaim): { severity: 'medium' | 'high'; message: string } | null {
    if (claim.source === 'target') {
      if (claim.baselineValue !== undefined && claim.targetValue !== undefined && claim.baselineValue <= 0) {
        return { severity: 'high', message: 'Baseline must be greater than zero for KPI movement checks.' };
      }

      if (claim.baselineValue !== undefined && claim.targetValue !== undefined && claim.baselineValue > 0) {
        const ratio = claim.targetValue / claim.baselineValue;
        if (ratio <= 0 || ratio > 10 || ratio < 0.1) {
          return { severity: 'high', message: `Target/baseline ratio ${ratio.toFixed(2)} violates plausibility bounds [0.10, 10.00].` };
        }
      }
    }

    if (claim.source === 'opportunity' && claim.impactLow !== undefined && claim.impactHigh !== undefined) {
      if (claim.impactLow > claim.impactHigh) {
        return { severity: 'high', message: 'Impact low bound is greater than impact high bound.' };
      }
      if (claim.impactLow < 0) {
        return { severity: 'medium', message: 'Impact low bound is negative; verify expected value direction.' };
      }
    }

    if (claim.timeframeMonths !== undefined && (claim.timeframeMonths <= 0 || claim.timeframeMonths > 60)) {
      return { severity: 'medium', message: `Timeframe ${claim.timeframeMonths} months is outside accepted bounds (1-60).` };
    }

    return null;
  }

  private roundScore(value: number): number {
    return Number(value.toFixed(3));
  }

  // -------------------------------------------------------------------------
  // Integrity Scoring
  // -------------------------------------------------------------------------

  private computeIntegrityResult(analysis: IntegrityAnalysis): IntegrityCheck {
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
      isValid: !hasHighSeverity,
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
  static evaluateVetoDecision(result: IntegrityCheck, policyTrace: PolicyTrace[] = []): VetoDecision {
    const hasVetoTrace = policyTrace.find(trace => trace.status === 'veto');
    if (hasVetoTrace) {
      return {
        veto: true,
        reRefine: false,
        reason: `Deterministic policy veto: ${hasVetoTrace.rule} — ${hasVetoTrace.message}`,
        policy_trace: policyTrace,
      };
    }

    const hasRefineTrace = policyTrace.find(trace => trace.status === 'refine');
    if (hasRefineTrace) {
      return {
        veto: false,
        reRefine: true,
        reason: `Deterministic policy refine: ${hasRefineTrace.rule} — ${hasRefineTrace.message}`,
        policy_trace: policyTrace,
      };
    }

    const hasHighSeverityDataIssue = result.issues.some(
      i => i.type === 'data_integrity' && i.severity === 'high',
    );

    if (hasHighSeverityDataIssue) {
      return { veto: true, reRefine: false, reason: 'High severity data integrity issue detected', policy_trace: policyTrace };
    }

    if (result.confidence < 0.85) {
      return { veto: false, reRefine: true, reason: `Confidence ${result.confidence.toFixed(2)} below threshold 0.85`, policy_trace: policyTrace };
    }

    return { veto: false, reRefine: false, reason: 'All integrity checks passed', policy_trace: policyTrace };
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
      // Map each claim validation to a typed EvidenceItem so EvidenceTiering
      // and ConfidenceScorer can produce evidence_tier and confidence_score.
      // claim_id prefix ('kpi-' vs 'hyp-') determines the source type.
      const claims = analysis.claim_validations.map(cv => {
        const sourceType: EvidenceItem['sourceType'] = cv.claim_id.startsWith('kpi-')
          ? 'internal_system'
          : 'internal_analysis';

        const evidenceItem: EvidenceItem = {
          id: cv.claim_id,
          sourceType,
          sourceName: cv.claim_id.startsWith('kpi-') ? 'KPI target' : 'Opportunity hypothesis',
          content: cv.claim_text,
          // Default retrievedAt to now — freshness decay starts from the current run.
          retrievedAt: new Date().toISOString(),
        };

        const classified = classifyEvidence(evidenceItem);

        const confidenceInput: ConfidenceInput = {
          evidence: classified,
          transparency: cv.verdict === 'supported' ? 'full'
            : cv.verdict === 'partially_supported' ? 'partial'
            : 'opaque',
        };
        const scored = computeConfidence(confidenceInput);

        return {
          claim_id: cv.claim_id,
          text: cv.claim_text,
          confidence_score: scored.overall,
          evidence_tier: classified.tier,
          // partially_supported is flagged so the UI surfaces evidence gaps for review,
          // not just outright failures.
          flagged: cv.verdict === 'unsupported' ||
            cv.verdict === 'insufficient_evidence' ||
            cv.verdict === 'partially_supported' ||
            cv.issues.some(i => i.severity === 'high' || i.severity === 'critical'),
          flag_reason: cv.issues.length > 0
            ? cv.issues.map(i => i.description).join('; ')
            : undefined,
        };
      });

      await integrityOutputRepository.upsertForCase({
        case_id: caseId,
        organization_id: organizationId,
        claims,
        overall_confidence: integrityResult.confidence,
        veto_triggered: vetoDecision.veto,
        veto_reason: vetoDecision.veto ? vetoDecision.reason : undefined,
        source_agent: this.name,
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
  // Ground Truth Verification
  // -------------------------------------------------------------------------

  /**
   * Verify claims against authoritative ground truth sources (SEC, benchmarks).
   * Wires ClaimVerificationService into the validation pipeline.
   */
  private async verifyClaimsWithGroundTruth(
    claims: IntegrityClaim[],
    context: LifecycleContext,
  ): Promise<Map<string, VerificationResult>> {
    const verificationResults = new Map<string, VerificationResult>();

    // Extract CIK and industry from context if available
    const cik = context.user_inputs?.cik as string | undefined;
    const industry = context.user_inputs?.industry as string | undefined;
    const companySize = context.user_inputs?.company_size as Claim['companySize'] | undefined;

    for (const claim of claims) {
      // Only verify claims with numeric values
      const claimValue = claim.baselineValue ?? claim.targetValue ?? claim.impactHigh;
      if (claimValue === undefined) continue;

      // Build claim for verification
      const verificationClaim: Claim = {
        metric: claim.text.split('"')[1] || 'unknown', // Extract KPI name from claim text
        value: claimValue,
        cik,
        industry,
        companySize,
      };

      try {
        const result = await claimVerificationService.verifyClaim(verificationClaim);
        verificationResults.set(claim.id, result);

        logger.debug('Ground truth verification completed', {
          claim_id: claim.id,
          status: result.status,
          confidence: result.confidence,
          tier: result.sources[0]?.tier,
        });
      } catch (err) {
        logger.warn('Ground truth verification failed for claim', {
          claim_id: claim.id,
          error: (err as Error).message,
        });
      }
    }

    return verificationResults;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  // ...existing code...

  // -------------------------------------------------------------------------
  // Value Graph integration
  // -------------------------------------------------------------------------

  /**
   * Reads the Value Graph and returns gaps where a hypothesis_claims_value_driver
   * edge has no corresponding evidence_supports_metric edge on the same
   * target entity.
   *
   * Fire-and-forget: returns [] on any error so the primary output is
   * never affected.
   */
  private async checkGraphIntegrityGaps(
    context: LifecycleContext,
  ): Promise<GraphIntegrityGap[]> {
    const opportunityId = (context.user_inputs?.value_case_id as string | undefined)
      ?? context.workspace_id;
    const organizationId = context.organization_id;

    if (!opportunityId || !organizationId) {
      return [];
    }

    try {
      const graph = await this.valueGraphService.getGraphForOpportunity(opportunityId, organizationId);

      const claimsEdges = graph.edges.filter(e => e.edge_type === 'hypothesis_claims_value_driver');
      const evidenceEdges = graph.edges.filter(e => e.edge_type === 'evidence_supports_metric');
      const metricMapEdges = graph.edges.filter(e => e.edge_type === 'metric_maps_to_value_driver');

      // Build a set of metric IDs that have at least one evidence_supports_metric edge
      const metricsWithEvidence = new Set(evidenceEdges.map(e => e.to_entity_id));

      // From those metrics, find all value drivers they map to via metric_maps_to_value_driver
      const valueDriversWithEvidence = new Set(
        metricMapEdges
          .filter(edge => metricsWithEvidence.has(edge.from_entity_id))
          .map(edge => edge.to_entity_id),
      );

      const gaps: GraphIntegrityGap[] = [];

      for (const claimEdge of claimsEdges) {
        if (!valueDriversWithEvidence.has(claimEdge.to_entity_id)) {
          gaps.push({
            hypothesis_claims_edge_id: claimEdge.id,
            from_entity_id: claimEdge.from_entity_id,
            to_entity_id: claimEdge.to_entity_id,
            gap_type: 'missing_evidence_support',
          });

          logger.warn('IntegrityAgent: Value Graph gap — hypothesis claim has no evidence support', {
            opportunityId,
            organizationId,
            claimEdgeId: claimEdge.id,
            fromEntityId: claimEdge.from_entity_id,
            toEntityId: claimEdge.to_entity_id,
          });
        }
      }

      return gaps;
    } catch (err) {
      logger.warn('IntegrityAgent: failed to check Value Graph integrity gaps', {
        opportunityId,
        organizationId,
        error: (err as Error).message,
      });
      return [];
    }
  }
}

