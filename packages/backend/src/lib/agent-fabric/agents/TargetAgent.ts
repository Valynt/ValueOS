/**
 * TargetAgent
 *
 * Sits in the DRAFTING phase of the value lifecycle. Retrieves hypotheses
 * stored by OpportunityAgent, uses the LLM to generate measurable KPI
 * targets for each hypothesis, validates causal links via the causal engine,
 * and produces financial model inputs for the downstream FinancialModeling
 * agent.
 *
 * Output includes KPI definitions, a value driver tree, causal traces,
 * and SDUI sections (KPIForm + ValueTreeCard).
 */

import { z } from 'zod';

import { getAdvancedCausalEngine } from '../../../services/reasoning/AdvancedCausalEngine.js';
import type {
  AgentOutput,
  AgentOutputMetadata,
  ConfidenceLevel,
  LifecycleContext,
  PromptVersionReference,
} from '../../../types/agent.js';
import { logger } from '../../logger.js';
import { ValueTreeRepository } from '../../../repositories/ValueTreeRepository.js';
import type { ValueTreeNodeWrite } from '../../../repositories/ValueTreeRepository.js';
import { ProvenanceTracker, type ProvenanceStore } from '@memory/provenance/index.js';
import { SupabaseProvenanceStore } from '../../../services/workflows/SagaAdapters.js';
import { createServerSupabaseClient } from '../../supabase.js';

import { BaseAgent } from './BaseAgent.js';
import { renderTemplate } from '../promptUtils.js';
import { resolvePromptTemplate } from '../prompts/PromptRegistry.js';

// ---------------------------------------------------------------------------
// Zod schemas for LLM output validation
// ---------------------------------------------------------------------------

const KPIDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  unit: z.enum(['currency', 'percentage', 'number', 'hours', 'headcount', 'ratio']),
  measurement_method: z.string(),
  baseline: z.object({
    value: z.number(),
    source: z.string(),
    as_of_date: z.string(),
  }),
  target: z.object({
    value: z.number(),
    timeframe_months: z.number().int().positive(),
    confidence: z.number().min(0).max(1),
  }),
  category: z.enum(['revenue', 'cost', 'efficiency', 'risk']),
  hypothesis_id: z.string(),
});

const ValueDriverSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().optional(),
  type: z.enum(['root', 'branch', 'leaf']),
  status: z.enum(['active', 'at_risk', 'achieved']).default('active'),
  children: z.array(z.lazy((): z.ZodTypeAny => ValueDriverSchema)).default([]),
});

const FinancialModelInputSchema = z.object({
  hypothesis_id: z.string(),
  hypothesis_title: z.string(),
  category: z.enum(['revenue', 'cost', 'efficiency', 'risk']),
  baseline_value: z.number(),
  target_value: z.number(),
  unit: z.string(),
  timeframe_months: z.number().int().positive(),
  assumptions: z.array(z.string()),
  sensitivity_variables: z.array(z.string()),
});

const TargetAnalysisSchema = z.object({
  kpi_definitions: z.array(KPIDefinitionSchema).min(1),
  value_driver_tree: z.array(ValueDriverSchema).min(1),
  financial_model_inputs: z.array(FinancialModelInputSchema).min(1),
  measurement_plan: z.string(),
  risks: z.array(z.object({
    description: z.string(),
    likelihood: z.enum(['low', 'medium', 'high']),
    mitigation: z.string(),
  })),
});

type TargetAnalysis = z.infer<typeof TargetAnalysisSchema>;
type KPIDefinition = z.infer<typeof KPIDefinitionSchema>;

// ---------------------------------------------------------------------------
// Causal trace types
// ---------------------------------------------------------------------------

interface CausalTrace {
  impactCascade: Array<{
    action: string;
    targetKpi: string;
    effect: { direction: string; magnitude: number; confidence: number };
    linkedOpportunity?: string;
  }>;
  verified: boolean;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

// Module-level singleton — avoids constructing a new Supabase client per agent run.
// Per ADR-0011: use module-level singletons for infrastructure dependencies that
// cannot be injected via LifecycleContext without a type-breaking change.
let _provenanceTracker: ProvenanceTracker | null = null;
function getProvenanceTracker(): ProvenanceTracker {
  if (!_provenanceTracker) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = createServerSupabaseClient() as any;
    // SupabaseProvenanceStore from SagaAdapters uses a local ProvenanceRecord type
    // that is structurally compatible with the packages/memory ProvenanceStore interface.
    // The cast is safe: both types share the same DB table and field names.
    const store = new SupabaseProvenanceStore(client) as unknown as ProvenanceStore;
    _provenanceTracker = new ProvenanceTracker(store);
  }
  return _provenanceTracker;
}

export class TargetAgent extends BaseAgent {
  private causalEngine = getAdvancedCausalEngine();

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    // Step 1: Retrieve hypotheses from OpportunityAgent via memory
    const hypotheses = await this.retrieveHypotheses(context);
    if (hypotheses.length === 0) {
      return this.buildOutput(
        {
          error: 'No opportunity hypotheses found in memory. Run OpportunityAgent first.',
          validated: false,
        },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 2: Generate KPI targets and model inputs via LLM
    const query = context.user_inputs?.query as string | undefined;
    const generation = await this.generateTargets(context, hypotheses, query);
    if (!generation) {
      return this.buildOutput(
        { error: 'KPI target generation failed. Retry or provide more context.' },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 3: Validate causal traces for each KPI against linked hypotheses
    const { analysis, promptRefs } = generation;
    const causalResults = await this.validateAllCausalTraces(analysis.kpi_definitions, hypotheses);
    const verifiedCount = causalResults.filter(c => c.verified).length;
    const allVerified = verifiedCount === causalResults.length;

    // Step 4: Store KPI targets and model inputs in memory for downstream agents
    await this.storeTargetsInMemory(context, analysis, causalResults);

    // Step 4b: Persist value driver tree to DB for frontend reads
    const valueCaseId = context.user_inputs?.value_case_id as string | undefined;
    if (valueCaseId) {
      await this.persistValueTree(valueCaseId, context.organization_id, analysis.value_driver_tree);
    }

    // Step 5: Build SDUI sections
    const sduiSections = this.buildSDUISections(analysis, causalResults);

    // Step 6: Determine confidence
    const avgConfidence = causalResults.length > 0
      ? causalResults.reduce((sum, c) => sum + c.confidence, 0) / causalResults.length
      : 0.5;
    const confidenceLevel = this.toConfidenceLevel(avgConfidence);

    const result = {
      validated: allVerified,
      kpi_definitions: analysis.kpi_definitions,
      value_driver_tree: analysis.value_driver_tree,
      financial_model_inputs: analysis.financial_model_inputs,
      measurement_plan: analysis.measurement_plan,
      risks: analysis.risks,
      causal_traces: causalResults,
      hypotheses_linked: hypotheses.length,
      kpis_verified: verifiedCount,
      kpis_total: analysis.kpi_definitions.length,
      sdui_sections: sduiSections,
    };

    const warnings: string[] = [];
    if (!allVerified) {
      warnings.push(
        `${causalResults.length - verifiedCount} of ${causalResults.length} KPIs lack verified causal links to opportunity hypotheses.`,
      );
    }

    return this.buildOutput(result, allVerified ? 'success' : 'partial_success', confidenceLevel, startTime, {
      reasoning: `Generated ${analysis.kpi_definitions.length} KPI targets from ${hypotheses.length} hypotheses. ` +
        `${verifiedCount}/${causalResults.length} causal traces verified.`,
      suggested_next_actions: [
        'Review KPI baselines and targets with stakeholders',
        'Run FinancialModeling agent to build ROI model',
        'Validate measurement methods with data team',
      ],
      warnings,
      prompt_version_refs: promptRefs,
    });
  }

  // -------------------------------------------------------------------------
  // Hypothesis Retrieval
  // -------------------------------------------------------------------------

  /**
   * Retrieve verified hypotheses stored by OpportunityAgent.
   */
  private async retrieveHypotheses(context: LifecycleContext): Promise<Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
  }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'opportunity',
        memory_type: 'semantic',
        limit: 10,
        organization_id: context.organization_id,
      });

      // Filter to verified hypotheses with required metadata
      return memories.filter(m => {
        const meta = m.metadata || {};
        return meta.verified === true && meta.category && meta.estimated_impact;
      }).map(m => ({
        id: m.id,
        content: m.content,
        metadata: m.metadata || {},
      }));
    } catch (err) {
      logger.warn('Failed to retrieve hypotheses from memory', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // LLM KPI Generation
  // -------------------------------------------------------------------------

  /**
   * Build the system prompt with hypothesis context.
   */
  private buildSystemPrompt(hypotheses: Array<{ content: string; metadata: Record<string, unknown> }>): {
    prompt: string;
    ref: PromptVersionReference;
  } {
    const hypothesisContext = hypotheses.map((h, i) => {
      const m = h.metadata;
      const impact = m.estimated_impact || {};
      return `${i + 1}. ${h.content}
   Category: ${m.category}
   Impact: ${impact.low}–${impact.high} ${impact.unit} over ${impact.timeframe_months} months
   KPI targets: ${(m.kpi_targets || []).join(', ')}
   Evidence: ${(m.evidence || []).join('; ')}`;
    }).join('\n\n');

    const template = resolvePromptTemplate({ promptKey: 'target.system.kpi-generation' });
    return {
      prompt: renderTemplate(template.template, { hypothesisContext }),
      ref: template.reference,
    };
  }

  /**
   * Call the LLM to generate KPI targets and model inputs.
   */
  private async generateTargets(
    context: LifecycleContext,
    hypotheses: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    query?: string,
  ): Promise<{ analysis: TargetAnalysis; promptRefs: PromptVersionReference[] } | null> {
    const systemPrompt = this.buildSystemPrompt(hypotheses);
    const userTemplate = resolvePromptTemplate({ promptKey: 'target.user.generate-targets' });
    const promptRefs: PromptVersionReference[] = [systemPrompt.ref, userTemplate.reference];

    const hypothesisIds = hypotheses.map((h, i) => `"hyp-${i + 1}" (${h.metadata.category})`).join(', ');
    const userPrompt = renderTemplate(userTemplate.template, {
      hypothesisIds,
      additionalContext: query ? `Additional context: ${query}` : '',
    });

    try {
      const result = await this.secureInvoke<TargetAnalysis>(
        context.workspace_id,
        `${systemPrompt.prompt}\n\n${userPrompt}`,
        TargetAnalysisSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.5, high: 0.8 },
          context: {
            agent: 'target',
            organization_id: context.organization_id,
            hypothesis_count: hypotheses.length,
          },
        },
      );

      return { analysis: result, promptRefs };
    } catch (err) {
      logger.error('KPI target generation failed', {
        error: (err as Error).message,
        workspace_id: context.workspace_id,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Causal Trace Validation
  // -------------------------------------------------------------------------

  /**
   * Validate causal links between each KPI and its source hypothesis.
   */
  private async validateAllCausalTraces(
    kpis: KPIDefinition[],
    hypotheses: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
  ): Promise<CausalTrace[]> {
    const results: CausalTrace[] = [];

    for (const kpi of kpis) {
      const trace = await this.validateCausalTrace(kpi, hypotheses);
      results.push(trace);
    }

    return results;
  }

  /**
   * Validate a single KPI's causal link to its hypothesis.
   */
  private async validateCausalTrace(
    kpi: KPIDefinition,
    hypotheses: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
  ): Promise<CausalTrace> {
    try {
      const action = this.categoryToAction(kpi.category);

      const causalInference = await this.causalEngine.inferCausalRelationship(
        action,
        kpi.name,
        {
          category: kpi.category,
          baseline: kpi.baseline.value,
          target: kpi.target.value,
          timeframe_months: kpi.target.timeframe_months,
        },
      );

      // Find the linked hypothesis
      const linked = hypotheses.find(h => {
        const meta = h.metadata || {};
        const relatedActions = meta.relatedActions || [];
        const targetKpis = meta.targetKpis || meta.kpi_targets || [];
        return (
          meta.verified === true &&
          (relatedActions.includes(action) || targetKpis.some((k: string) => kpi.name.toLowerCase().includes(k.toLowerCase())))
        );
      });

      return {
        impactCascade: [{
          action,
          targetKpi: kpi.name,
          effect: {
            direction: causalInference.effect.direction,
            magnitude: causalInference.effect.magnitude,
            confidence: causalInference.confidence,
          },
          linkedOpportunity: linked?.id,
        }],
        verified: !!linked,
        confidence: causalInference.confidence,
      };
    } catch (err) {
      logger.warn('Causal trace validation failed for KPI', {
        kpi: kpi.name,
        error: (err as Error).message,
      });
      return { impactCascade: [], verified: false, confidence: 0 };
    }
  }

  private categoryToAction(category: string): string {
    const mapping: Record<string, string> = {
      revenue: 'increase_revenue',
      cost: 'reduce_costs',
      efficiency: 'improve_efficiency',
      risk: 'mitigate_risk',
    };
    return mapping[category] || 'business_improvement';
  }

  // -------------------------------------------------------------------------
  // Memory Storage
  // -------------------------------------------------------------------------

  /**
   * Store KPI targets and financial model inputs in memory for downstream agents.
   */
  private async storeTargetsInMemory(
    context: LifecycleContext,
    analysis: TargetAnalysis,
    causalResults: CausalTrace[],
  ): Promise<void> {
    // Store each KPI definition
    for (let i = 0; i < analysis.kpi_definitions.length; i++) {
      const kpi = analysis.kpi_definitions[i];
      const causal = causalResults[i];
      try {
        await this.memorySystem.storeSemanticMemory(
          context.workspace_id,
          'target',
          'semantic',
          `KPI: ${kpi.name} — baseline: ${kpi.baseline.value} ${kpi.unit}, target: ${kpi.target.value} in ${kpi.target.timeframe_months}mo`,
          {
            kpi_id: kpi.id,
            category: kpi.category,
            unit: kpi.unit,
            baseline: kpi.baseline,
            target: kpi.target,
            measurement_method: kpi.measurement_method,
            hypothesis_id: kpi.hypothesis_id,
            causal_verified: causal?.verified ?? false,
            causal_confidence: causal?.confidence ?? 0,
            organization_id: context.organization_id,
            importance: kpi.target.confidence,
          },
          context.organization_id,
        );
      } catch (err) {
        logger.warn('Failed to store KPI in memory', {
          kpi: kpi.name,
          error: (err as Error).message,
        });
      }
    }

    // Store financial model inputs as a single memory entry
    try {
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'target',
        'semantic',
        `Financial model inputs: ${analysis.financial_model_inputs.length} drivers across ${[...new Set(analysis.financial_model_inputs.map(f => f.category))].join(', ')}`,
        {
          type: 'financial_model_inputs',
          inputs: analysis.financial_model_inputs,
          measurement_plan: analysis.measurement_plan,
          risks: analysis.risks,
          organization_id: context.organization_id,
          importance: 0.9,
        },
        context.organization_id,
      );
    } catch (err) {
      logger.warn('Failed to store financial model inputs in memory', {
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // SDUI Output
  // -------------------------------------------------------------------------

  /**
   * Build SDUI page sections from the analysis results.
   */
  private buildSDUISections(
    analysis: TargetAnalysis,
    causalResults: CausalTrace[],
  ): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];
    const verifiedCount = causalResults.filter(c => c.verified).length;

    // Summary card
    sections.push({
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          agentId: 'target',
          agentName: 'Target Agent',
          timestamp: new Date().toISOString(),
          content: `${analysis.kpi_definitions.length} KPI targets defined. ${verifiedCount}/${causalResults.length} causally verified.\n\n${analysis.measurement_plan}`,
          confidence: causalResults.length > 0
            ? causalResults.reduce((s, c) => s + c.confidence, 0) / causalResults.length
            : 0.5,
          status: 'completed',
        },
        showReasoning: false,
        showActions: true,
        stage: 'target',
      },
    });

    // KPI form with all definitions
    const kpiFormData: Array<Record<string, unknown>> = analysis.kpi_definitions.map(kpi => ({
      id: kpi.id,
      label: kpi.name,
      unit: kpi.unit === 'currency' ? '$' : kpi.unit === 'percentage' ? '%' : kpi.unit,
      type: kpi.unit === 'currency' ? 'currency' as const
        : kpi.unit === 'percentage' ? 'percentage' as const
        : 'number' as const,
      target: kpi.target.value,
      min: kpi.baseline.value < kpi.target.value ? kpi.baseline.value : undefined,
      max: kpi.baseline.value > kpi.target.value ? kpi.baseline.value : undefined,
    }));

    const kpiValues: Record<string, number> = {};
    for (const kpi of analysis.kpi_definitions) {
      kpiValues[kpi.id] = kpi.baseline.value;
    }

    sections.push({
      type: 'component',
      component: 'KPIForm',
      version: 1,
      props: {
        kpis: kpiFormData,
        values: kpiValues,
        readOnly: false,
      },
    });

    // Value driver tree
    sections.push({
      type: 'component',
      component: 'ValueTreeCard',
      version: 1,
      props: {
        nodes: analysis.value_driver_tree,
        title: 'Value Driver Tree',
      },
    });

    return sections;
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Flatten the nested value driver tree and replace all nodes for the case.
   * Parent/child relationships are preserved via node_key / parent_node_key.
   */
  private async persistValueTree(
    caseId: string,
    organizationId: string,
    tree: Array<z.infer<typeof ValueDriverSchema>>,
  ): Promise<void> {
    const nodes: ValueTreeNodeWrite[] = [];

    const flatten = (
      items: Array<z.infer<typeof ValueDriverSchema>>,
      parentKey: string | undefined,
      depth: number,
    ): void => {
      items.forEach((node, idx) => {
        nodes.push({
          node_key: node.id,
          label: node.label,
          description: node.value,
          driver_type: undefined, // TargetAgent tree nodes don't carry a category
          parent_node_key: parentKey,
          sort_order: depth * 100 + idx,
          source_agent: 'target',
          metadata: { type: node.type, status: node.status },
        });
        if (node.children?.length) {
          flatten(node.children, node.id, depth + 1);
        }
      });
    };

    flatten(tree, undefined, 0);

    try {
      const repo = new ValueTreeRepository();
      await repo.replaceNodesForCase(caseId, organizationId, nodes);
      logger.info('TargetAgent: persisted value tree', {
        case_id: caseId,
        organization_id: organizationId,
        node_count: nodes.length,
      });

      // Record provenance for each node so downstream agents and the UI can
      // trace every value tree entry back to the TargetAgent run that produced it.
      const tracker = getProvenanceTracker();
      const provenanceResults = await Promise.allSettled(
        nodes.map((node) =>
          tracker.record({
            valueCaseId: caseId,
            claimId: node.node_key,
            dataSource: 'TargetAgent:value_driver_tree',
            evidenceTier: 2, // Internal analysis — Tier 2 per EvidenceTiering classification
            agentId: this.name,
            agentVersion: this.version,
            confidenceScore: 0.7, // Default; overridden by ConfidenceScorer in IntegrityAgent
          }),
        ),
      );

      const failedProvenance = provenanceResults.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );

      if (failedProvenance.length > 0) {
        logger.warn('TargetAgent: failed to record provenance for some value tree nodes', {
          case_id: caseId,
          organization_id: organizationId,
          node_count: nodes.length,
          failed_count: failedProvenance.length,
          sample_errors: failedProvenance.slice(0, 3).map((r) =>
            r.reason instanceof Error ? r.reason.message : String(r.reason),
          ),
        });
      }
    } catch (err) {
      // Non-fatal: memory store succeeded; log and continue.
      logger.error('TargetAgent: failed to persist value tree', {
        case_id: caseId,
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  // ...existing code...
}
