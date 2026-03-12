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
import { renderTemplate } from '../promptUtils.js';
import { resolvePromptTemplate } from '../promptRegistry.js';

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

    // Step 3: Validate claims via LLM (with domain context)
    const analysis = await this.validateClaims(context, claims, domainContext);
    if (!analysis) {
      return this.buildOutput(
        { error: 'Claim validation failed. Retry or provide more context.' },
        'failure', 'low', startTime,
      );
    }

    // Step 4: Compute integrity result and veto decision
    const integrityResult = this.computeIntegrityResult(analysis);
    const vetoDecision = IntegrityAgent.evaluateVetoDecision(integrityResult);

    // Step 5: Store validation results in memory
    await this.storeValidationInMemory(context, analysis, vetoDecision);

    // Step 5b: Persist output to integrity_outputs table so it survives restarts
    await this.persistOutput(context, analysis, integrityResult, vetoDecision);

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
  ): Array<{ id: string; text: string; evidence: string[]; source: string }> {
    const claims: Array<{ id: string; text: string; evidence: string[]; source: string }> = [];

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
    claims: Array<{ id: string; text: string; evidence: string[]; source: string }>,
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

    const systemPromptTemplate = resolvePromptTemplate('integrity_system');
    const userPromptTemplate = resolvePromptTemplate('integrity_user');
    this.setPromptVersionReferences(
      [
        { key: systemPromptTemplate.key, version: systemPromptTemplate.version },
        { key: userPromptTemplate.key, version: userPromptTemplate.version },
      ],
      [systemPromptTemplate.approval, userPromptTemplate.approval],
    );

    const systemPrompt = renderTemplate(systemPromptTemplate.template, { domainFragment });
    const userPrompt = renderTemplate(userPromptTemplate.template, {
      claimCount: String(claims.length),
      claimsContext,
    });

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
  static evaluateVetoDecision(result: IntegrityCheck): VetoDecision {
    const hasHighSeverityDataIssue = result.issues.some(
      i => i.type === 'data_integrity' && i.severity === 'high',
    );

    if (hasHighSeverityDataIssue) {
      return { veto: true, reRefine: false, reason: 'High severity data integrity issue detected' };
    }

    if (result.confidence < 0.85) {
      return { veto: false, reRefine: true, reason: `Confidence ${result.confidence.toFixed(2)} below threshold 0.85` };
    }

    return { veto: false, reRefine: false, reason: 'All integrity checks passed' };
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
