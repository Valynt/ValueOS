/**
 * RealizationAgent
 *
 * Sits in the REALIZATION phase of the value lifecycle. Retrieves
 * validated hypotheses and KPI targets from upstream agents (Integrity,
 * Target, Opportunity) via memory, then uses the LLM to generate
 * concrete realization plans — implementation roadmaps, resource
 * requirements, milestones, and risk mitigations.
 *
 * Output includes per-hypothesis realization plans, tracking metrics,
 * and SDUI sections (AgentResponseCard + milestone timeline).
 */

import { BaseAgent } from './BaseAgent.js';
import { z } from 'zod';
import { logger } from '../../logger.js';
import type {
  AgentOutput,
  AgentOutputMetadata,
  ConfidenceLevel,
  LifecycleContext,
} from '../../../types/agent.js';
import { featureFlags } from '../../../config/featureFlags.js';
import { loadDomainContext } from '../../../agents/context/loadDomainContext.js';
import type { DomainContext } from '../../../agents/context/loadDomainContext.js';

// ---------------------------------------------------------------------------
// Zod schemas for LLM output validation
// ---------------------------------------------------------------------------

const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  target_date_months: z.number().int().positive(),
  dependencies: z.array(z.string()),
  success_criteria: z.string(),
  status: z.enum(['planned', 'in_progress', 'completed', 'at_risk']),
});

const ResourceRequirementSchema = z.object({
  type: z.enum(['personnel', 'technology', 'budget', 'training', 'external']),
  description: z.string(),
  estimated_cost: z.number().min(0).optional(),
  currency: z.string().default('USD'),
  priority: z.enum(['required', 'recommended', 'optional']),
});

const RealizationPlanSchema = z.object({
  hypothesis_id: z.string(),
  hypothesis_title: z.string(),
  implementation_approach: z.string(),
  milestones: z.array(MilestoneSchema).min(1),
  resources: z.array(ResourceRequirementSchema),
  risks: z.array(z.object({
    description: z.string(),
    likelihood: z.enum(['low', 'medium', 'high']),
    impact: z.enum(['low', 'medium', 'high']),
    mitigation: z.string(),
  })),
  expected_timeline_months: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
});

const RealizationAnalysisSchema = z.object({
  plans: z.array(RealizationPlanSchema).min(1),
  overall_strategy: z.string(),
  total_estimated_investment: z.number().min(0),
  expected_roi_timeline_months: z.number().int().positive(),
  tracking_metrics: z.array(z.object({
    name: z.string(),
    description: z.string(),
    measurement_frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
    target_value: z.string(),
    unit: z.string(),
  })),
  critical_success_factors: z.array(z.string()),
});

type RealizationAnalysis = z.infer<typeof RealizationAnalysisSchema>;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class RealizationAgent extends BaseAgent {
  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    // Step 1: Retrieve validated hypotheses and KPIs from upstream agents
    const validatedHypotheses = await this.retrieveValidatedHypotheses(context);
    const kpiTargets = await this.retrieveKPITargets(context);
    const integrityResults = await this.retrieveIntegrityResults(context);

    if (validatedHypotheses.length === 0 && kpiTargets.length === 0) {
      return this.buildOutput(
        { error: 'No validated hypotheses or KPI targets found. Run upstream agents (Opportunity, Target, Integrity) first.' },
        'failure', 'low', startTime,
      );
    }

    // Step 1b: Load domain pack context
    const domainContext = await this.loadDomainPackContext(context);

    // Step 2: Generate realization plans via LLM
    const analysis = await this.generateRealizationPlans(
      context, validatedHypotheses, kpiTargets, integrityResults, domainContext,
    );
    if (!analysis) {
      return this.buildOutput(
        { error: 'Realization plan generation failed. Retry or provide more context.' },
        'failure', 'low', startTime,
      );
    }

    // Step 3: Store realization plans in memory
    await this.storeRealizationInMemory(context, analysis);

    // Step 4: Build SDUI sections
    const sduiSections = this.buildSDUISections(analysis);

    // Step 5: Determine confidence
    const avgConfidence = analysis.plans.reduce((sum, p) => sum + p.confidence, 0)
      / analysis.plans.length;
    const confidenceLevel = this.toConfidenceLevel(avgConfidence);

    const result = {
      plans: analysis.plans,
      overall_strategy: analysis.overall_strategy,
      total_estimated_investment: analysis.total_estimated_investment,
      expected_roi_timeline_months: analysis.expected_roi_timeline_months,
      tracking_metrics: analysis.tracking_metrics,
      critical_success_factors: analysis.critical_success_factors,
      plans_count: analysis.plans.length,
      total_milestones: analysis.plans.reduce((sum, p) => sum + p.milestones.length, 0),
      sdui_sections: sduiSections,
    };

    return this.buildOutput(result, 'success', confidenceLevel, startTime, {
      reasoning: `Generated ${analysis.plans.length} realization plans with ` +
        `${result.total_milestones} milestones. ` +
        `Estimated investment: $${analysis.total_estimated_investment.toLocaleString()}. ` +
        `Expected ROI timeline: ${analysis.expected_roi_timeline_months} months.`,
      suggested_next_actions: [
        'Review implementation milestones and resource requirements',
        'Assign owners to each realization plan',
        'Proceed to ExpansionAgent for growth opportunity analysis',
      ],
    });
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
      const supabaseClient = (context as Record<string, unknown>).supabaseClient as
        import('@supabase/supabase-js').SupabaseClient | undefined;
      return await loadDomainContext(context.organization_id, valueCaseId, supabaseClient);
    } catch (err) {
      logger.warn('RealizationAgent: failed to load domain pack context', {
        value_case_id: valueCaseId,
        error: (err as Error).message,
      });
      return empty;
    }
  }

  // -------------------------------------------------------------------------
  // Memory Retrieval
  // -------------------------------------------------------------------------

  private async retrieveValidatedHypotheses(
    context: LifecycleContext,
  ): Promise<Array<{ id: string; content: string; metadata: Record<string, unknown> }>> {
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
      logger.warn('Failed to retrieve validated hypotheses from memory', { error: (err as Error).message });
      return [];
    }
  }

  private async retrieveKPITargets(
    context: LifecycleContext,
  ): Promise<Array<{ id: string; content: string; metadata: Record<string, unknown> }>> {
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
      logger.warn('Failed to retrieve KPI targets from memory', { error: (err as Error).message });
      return [];
    }
  }

  private async retrieveIntegrityResults(
    context: LifecycleContext,
  ): Promise<Array<{ id: string; content: string; metadata: Record<string, unknown> }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'integrity',
        memory_type: 'semantic',
        limit: 5,
        organization_id: context.organization_id,
      });
      return memories
        .filter(m => m.metadata?.type === 'integrity_validation')
        .map(m => ({ id: m.id, content: m.content, metadata: m.metadata || {} }));
    } catch (err) {
      logger.warn('Failed to retrieve integrity results from memory', { error: (err as Error).message });
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // LLM Realization Plan Generation
  // -------------------------------------------------------------------------

  private async generateRealizationPlans(
    context: LifecycleContext,
    hypotheses: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    kpis: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    integrityResults: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    domainContext?: DomainContext,
  ): Promise<RealizationAnalysis | null> {
    const hypothesesContext = hypotheses.map((h, i) => {
      const m = h.metadata;
      const impact = m.estimated_impact as Record<string, unknown> | undefined;
      return `${i + 1}. ${h.content}\n   Category: ${m.category || 'unknown'}\n   ` +
        `Estimated impact: ${impact?.low || '?'}-${impact?.high || '?'} ${impact?.unit || ''} over ${impact?.timeframe_months || '?'} months\n   ` +
        `Confidence: ${m.confidence || 'unknown'}`;
    }).join('\n\n');

    const kpiContext = kpis.map((k, i) => {
      const m = k.metadata;
      const baseline = m.baseline as Record<string, unknown> | undefined;
      const target = m.target as Record<string, unknown> | undefined;
      return `${i + 1}. ${k.content}\n   Baseline: ${baseline?.value || '?'} → Target: ${target?.value || '?'}\n   ` +
        `Timeframe: ${target?.timeframe_months || '?'} months`;
    }).join('\n\n');

    const integrityContext = integrityResults.length > 0
      ? `\n\nIntegrity validation summary:\n${integrityResults.map(r => r.content).join('\n')}`
      : '';

    let domainFragment = '';
    if (domainContext?.assumptions && domainContext.assumptions.length > 0) {
      domainFragment += `\n\nDomain assumptions to incorporate:\n${domainContext.assumptions.map(a => `- ${a.label}: ${a.defaultValue} ${a.unit || ''}`).join('\n')}`;
    }
    if (domainContext?.complianceRules && domainContext.complianceRules.length > 0) {
      domainFragment += `\n\nCompliance requirements:\n${domainContext.complianceRules.map(r => `- ${r}`).join('\n')}`;
    }

    const systemPrompt = `You are a Value Engineering realization planner. Your job is to create concrete implementation plans for validated value hypotheses.

For each hypothesis, generate:
- implementation_approach: How to execute this value driver
- milestones: Specific, time-bound milestones with success criteria and dependencies
- resources: Personnel, technology, budget, and training requirements
- risks: Implementation risks with likelihood, impact, and mitigation strategies
- expected_timeline_months: Total implementation timeline
- confidence: 0.0-1.0 reflecting plan feasibility

Also provide:
- overall_strategy: Executive summary of the realization approach
- total_estimated_investment: Sum of all resource costs
- expected_roi_timeline_months: When ROI is expected
- tracking_metrics: KPIs to monitor implementation progress
- critical_success_factors: What must go right for success

Be specific and actionable. Reference the KPI targets and integrity validation results. Respond with valid JSON. No markdown fences.${domainFragment}`;

    const userPrompt = `Create realization plans for these validated hypotheses:

${hypothesesContext}

KPI Targets:
${kpiContext || 'No KPI targets available.'}${integrityContext}

${context.user_inputs?.additional_context ? `Additional context: ${context.user_inputs.additional_context}` : ''}`;

    try {
      return await this.secureInvoke<RealizationAnalysis>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        RealizationAnalysisSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.6, high: 0.85 },
          context: {
            agent: 'realization',
            organization_id: context.organization_id,
            hypothesis_count: hypotheses.length,
            kpi_count: kpis.length,
          },
        },
      );
    } catch (err) {
      logger.error('Realization plan generation failed', {
        error: (err as Error).message,
        workspace_id: context.workspace_id,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Memory Storage
  // -------------------------------------------------------------------------

  private async storeRealizationInMemory(
    context: LifecycleContext,
    analysis: RealizationAnalysis,
  ): Promise<void> {
    // Store overall realization summary
    try {
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'realization',
        'semantic',
        `Realization plans: ${analysis.plans.length} plans generated. ` +
          `Total investment: $${analysis.total_estimated_investment.toLocaleString()}. ` +
          `Expected ROI in ${analysis.expected_roi_timeline_months} months.`,
        {
          type: 'realization_summary',
          plans_count: analysis.plans.length,
          total_investment: analysis.total_estimated_investment,
          roi_timeline_months: analysis.expected_roi_timeline_months,
          tracking_metrics_count: analysis.tracking_metrics.length,
          critical_success_factors: analysis.critical_success_factors,
          organization_id: context.organization_id,
          importance: 0.9,
        },
        context.organization_id,
      );
    } catch (err) {
      logger.warn('Failed to store realization summary in memory', { error: (err as Error).message });
    }

    // Store each plan individually for downstream retrieval
    for (const plan of analysis.plans) {
      try {
        await this.memorySystem.storeSemanticMemory(
          context.workspace_id,
          'realization',
          'semantic',
          `Realization plan for "${plan.hypothesis_title}": ${plan.implementation_approach}`,
          {
            type: 'realization_plan',
            hypothesis_id: plan.hypothesis_id,
            hypothesis_title: plan.hypothesis_title,
            milestone_count: plan.milestones.length,
            resource_count: plan.resources.length,
            risk_count: plan.risks.length,
            timeline_months: plan.expected_timeline_months,
            confidence: plan.confidence,
            organization_id: context.organization_id,
            importance: plan.confidence,
          },
          context.organization_id,
        );
      } catch (err) {
        logger.warn('Failed to store realization plan in memory', {
          hypothesis_id: plan.hypothesis_id,
          error: (err as Error).message,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // SDUI Output
  // -------------------------------------------------------------------------

  private buildSDUISections(analysis: RealizationAnalysis): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];

    const avgConfidence = analysis.plans.reduce((sum, p) => sum + p.confidence, 0)
      / analysis.plans.length;

    // Summary card
    sections.push({
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          agentId: 'realization',
          agentName: 'Realization Agent',
          timestamp: new Date().toISOString(),
          content: `${analysis.overall_strategy}\n\n` +
            `${analysis.plans.length} implementation plans generated. ` +
            `Total investment: $${analysis.total_estimated_investment.toLocaleString()}. ` +
            `Expected ROI: ${analysis.expected_roi_timeline_months} months.`,
          confidence: avgConfidence,
          status: 'completed',
        },
        showReasoning: true,
        showActions: true,
        stage: 'realization',
      },
    });

    // Confidence display
    sections.push({
      type: 'component',
      component: 'ConfidenceDisplay',
      version: 1,
      props: {
        data: {
          score: avgConfidence,
          label: 'Realization Confidence',
          trend: 'stable' as const,
        },
        size: 'lg',
        showTrend: false,
        showLabel: true,
      },
    });

    // Milestone timeline per plan
    for (const plan of analysis.plans) {
      sections.push({
        type: 'component',
        component: 'MilestoneTimeline',
        version: 1,
        props: {
          title: plan.hypothesis_title,
          milestones: plan.milestones.map(m => ({
            id: m.id,
            title: m.title,
            description: m.description,
            targetMonth: m.target_date_months,
            status: m.status,
            successCriteria: m.success_criteria,
          })),
          totalMonths: plan.expected_timeline_months,
          confidence: plan.confidence,
        },
      });
    }

    return sections;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private toConfidenceLevel(score: number): ConfidenceLevel {
    if (score >= 0.85) return 'very_high';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very_low';
  }

  private buildOutput(
    result: Record<string, unknown>,
    status: AgentOutput['status'],
    confidence: ConfidenceLevel,
    startTime: number,
    extra?: { reasoning?: string; suggested_next_actions?: string[] },
  ): AgentOutput {
    const metadata: AgentOutputMetadata = {
      execution_time_ms: Date.now() - startTime,
      model_version: this.version,
      timestamp: new Date().toISOString(),
    };
    return {
      agent_id: this.name,
      agent_type: 'realization',
      lifecycle_stage: 'realization',
      status,
      result,
      confidence,
      reasoning: extra?.reasoning,
      suggested_next_actions: extra?.suggested_next_actions,
      metadata,
    };
  }
}
