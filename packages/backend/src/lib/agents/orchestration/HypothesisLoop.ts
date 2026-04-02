/**
 * Hypothesis-First Core Loop Orchestrator
 *
 * Drives the 7-step value engineering loop:
 * 1. Hypothesis — OpportunityAgent proposes value drivers
 * 2. Model — FinancialModelingAgent builds Value Trees
 * 3. Evidence — GroundTruthAgent fetches grounding data
 * 4. Narrative — NarrativeAgent translates math into story
 * 5. Objection — RedTeamAgent stress-tests claims
 * 6. Revision — Re-enter at DRAFTING if critical objections (max 3 cycles)
 * 7. Approval — VE approves, transition to FINALIZED
 *
 * Each step carries an idempotency key, streams progress via SSE,
 * records token usage, and routes failures to the DLQ.
 */

import { z } from 'zod';

import type { DeadLetterQueue, DLQEntry } from '../core/DeadLetterQueue.js';
import type { IdempotencyGuard } from '../core/IdempotencyGuard.js';
import type {
  ValueCaseSaga,
} from '../core/ValueCaseSaga.js';
import { SagaTrigger } from '../core/ValueCaseSaga.js';

import { ObjectionSchema } from './agents/RedTeamAgent.js';
import type { Objection, RedTeamAnalyzer, RedTeamOutput } from './agents/RedTeamAgent.js';

// ============================================================================
// Types
// ============================================================================

export interface ValueHypothesis {
  id: string;
  description: string;
  confidence: number;
  category: string;
  estimatedValue?: number;
}

export interface ValueTree {
  id: string;
  valueCaseId: string;
  nodes: ValueTreeNode[];
  totalValue: number;
  currency: string;
  timestamp: string;
}

export interface ValueRange {
  low: number;
  high: number;
}

export interface ValueDriver {
  metric: string;
  value: number;
  unit: string;
  timeBasis?: 'monthly' | 'quarterly' | 'annual' | 'one-time';
  assumptions?: string[];
  citations?: string[];
}

export interface ValueTreeNode {
  id: string;
  label: string;
  value: number;
  currency?: string;
  timeBasis?: 'monthly' | 'quarterly' | 'annual' | 'one-time';
  range?: ValueRange;
  formula?: string;
  confidenceScore: number;
  assumptions: string[];
  dependencies: string[];
  citations: string[];
  drivers: ValueDriver[];
  children?: ValueTreeNode[];
}

export interface NarrativeBlock {
  id: string;
  valueCaseId: string;
  title: string;
  executiveSummary: string;
  sections: NarrativeSection[];
  timestamp: string;
}

export interface NarrativeSection {
  heading: string;
  content: string;
  claimIds: string[];
  confidenceScore: number;
}

export interface LoopProgress {
  step: number;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  timestamp: string;
  /** Total steps in the pipeline (always 7). */
  totalSteps: number;
  /** Agent responsible for this step. */
  agentName?: string;
  /** Current revision cycle (0 = first pass). */
  revisionCycle?: number;
  /** Max revision cycles allowed. */
  maxRevisionCycles?: number;
  /** Aggregate confidence score from the agent output (0–1). */
  confidence?: number;
  /** Elapsed wall-clock time for this step in milliseconds. */
  durationMs?: number;
  /** Lightweight summary of the step's partial result. */
  partialResult?: {
    itemCount?: number;
    totalValue?: number;
    highlights?: string[];
  };
}

export interface EvidenceReportItem {
  title: string;
  description: string;
  confidence: number;
  category: string;
  verification_type: string;
  priority: string;
}

export interface EvidenceReport {
  valueCaseId: string;
  items: EvidenceReportItem[];
  analysis: string;
  timestamp: string;
}

export interface LoopResult {
  valueCaseId: string;
  tenantId: string;
  hypotheses: ValueHypothesis[];
  valueTree: ValueTree | null;
  evidenceBundle: EvidenceReport | null;
  narrative: NarrativeBlock | null;
  objections: Objection[];
  revisionCount: number;
  finalState: string;
  success: boolean;
  error?: string;
}

export interface LoopConfig {
  maxRevisionCycles: number;
}

// ============================================================================
// Agent Interfaces (dependency injection)
// ============================================================================

export interface OpportunityAgentInterface {
  analyzeOpportunities(
    query: string,
    context?: { organizationId?: string; userId?: string; sessionId?: string }
  ): Promise<{
    opportunities: Array<{
      title: string;
      description: string;
      confidence: number;
      category: string;
      estimatedValue?: number;
    }>;
    analysis: string;
    vetoDecision?: {
      veto: boolean;
      reason?: string;
    };
  }>;
}

export interface FinancialModelOutput {
  title: string;
  description: string;
  confidence: number;
  category: string;
  model_type: string;
  priority: string;
  value?: number;
  currency?: string;
  timeBasis?: 'monthly' | 'quarterly' | 'annual' | 'one-time';
  range?: { low: number; high: number };
  assumptions?: string[];
  dependencies?: string[];
  citations?: string[];
  drivers?: Array<{
    metric: string;
    value: number;
    unit: string;
    timeBasis?: 'monthly' | 'quarterly' | 'annual' | 'one-time';
    assumptions?: string[];
    citations?: string[];
  }>;
}

export interface FinancialModelingAgentInterface {
  analyzeFinancialModels(
    query: string,
    context?: { organizationId?: string; userId?: string; sessionId?: string },
    idempotencyKey?: string
  ): Promise<{
    financial_models: FinancialModelOutput[];
    analysis: string;
  }>;
}

export interface GroundTruthAgentInterface {
  analyzeGroundtruth(
    query: string,
    context?: { organizationId?: string; userId?: string; sessionId?: string },
    idempotencyKey?: string
  ): Promise<{
    groundtruths: Array<{
      title: string;
      description: string;
      confidence: number;
      category: string;
      verification_type: string;
      priority: string;
    }>;
    analysis: string;
  }>;
}

export interface NarrativeAgentInterface {
  analyzeNarrative(
    query: string,
    context?: { organizationId?: string; userId?: string; sessionId?: string },
    idempotencyKey?: string
  ): Promise<{
    narratives: Array<{
      title: string;
      description: string;
      confidence: number;
      category: string;
      narrative_type: string;
      priority: string;
    }>;
    analysis: string;
  }>;
}

export interface SSEEmitter {
  send(data: LoopProgress): void;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const ValueHypothesisSchema = z.object({
  id: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1).refine((n) => !Number.isNaN(n), { message: 'confidence must not be NaN' }),
  category: z.string(),
  estimatedValue: z.number().refine((n) => !Number.isNaN(n), { message: 'estimatedValue must not be NaN' }).optional(),
});

export const ValueDriverSchema = z.object({
  metric: z.string(),
  value: z.number().refine((n) => !Number.isNaN(n), { message: 'driver value must not be NaN' }),
  unit: z.string(),
  timeBasis: z.enum(['monthly', 'quarterly', 'annual', 'one-time']).optional(),
  assumptions: z.array(z.string()).optional(),
  citations: z.array(z.string()).optional(),
});

export const ValueRangeSchema = z.object({
  low: z.number(),
  high: z.number(),
});

export const ValueTreeNodeSchema: z.ZodType<ValueTreeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    value: z.number().refine((n) => !Number.isNaN(n), { message: 'node value must not be NaN' }),
    currency: z.string().optional(),
    timeBasis: z.enum(['monthly', 'quarterly', 'annual', 'one-time']).optional(),
    range: ValueRangeSchema.optional(),
    formula: z.string().optional(),
    confidenceScore: z.number().min(0).max(1).refine((n) => !Number.isNaN(n), { message: 'confidenceScore must not be NaN' }),
    assumptions: z.array(z.string()),
    dependencies: z.array(z.string()),
    citations: z.array(z.string()),
    drivers: z.array(ValueDriverSchema),
    children: z.array(ValueTreeNodeSchema).optional(),
  })
);

export const ValueTreeSchema = z.object({
  id: z.string(),
  valueCaseId: z.string(),
  nodes: z.array(ValueTreeNodeSchema),
  totalValue: z.number().refine((n) => !Number.isNaN(n), { message: 'totalValue must not be NaN' }),
  currency: z.string(),
  timestamp: z.string(),
}).strict();

export const NarrativeSectionSchema = z.object({
  heading: z.string(),
  content: z.string(),
  claimIds: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1).refine((n) => !Number.isNaN(n), { message: 'confidenceScore must not be NaN' }),
}).strict();

export const NarrativeBlockSchema = z.object({
  id: z.string(),
  valueCaseId: z.string(),
  title: z.string(),
  executiveSummary: z.string(),
  sections: z.array(NarrativeSectionSchema),
  timestamp: z.string(),
}).strict();

/** Schema for the evidence bundle as constructed by the loop (not the formal EvidenceBundle domain type). */
export const EvidenceReportSchema = z.object({
  valueCaseId: z.string(),
  items: z.array(z.object({
    title: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1).refine((n) => !Number.isNaN(n), { message: 'confidence must not be NaN' }),
    category: z.string(),
    verification_type: z.string(),
    priority: z.string(),
  })),
  analysis: z.string(),
  timestamp: z.string(),
}).strict();

export const LoopResultSchema = z.object({
  valueCaseId: z.string(),
  tenantId: z.string(),
  hypotheses: z.array(ValueHypothesisSchema),
  valueTree: ValueTreeSchema.nullable(),
  evidenceBundle: EvidenceReportSchema.nullable(),
  narrative: NarrativeBlockSchema.nullable(),
  objections: z.array(ObjectionSchema),
  revisionCount: z.number().int().min(0),
  finalState: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_REVISION_CYCLES = 3;

// ============================================================================
// HypothesisLoop
// ============================================================================

export class HypothesisLoop {
  private saga: ValueCaseSaga;
  private idempotencyGuard: IdempotencyGuard;
  private dlq: DeadLetterQueue;
  private opportunityAgent: OpportunityAgentInterface;
  private financialModelingAgent: FinancialModelingAgentInterface;
  private groundTruthAgent: GroundTruthAgentInterface;
  private narrativeAgent: NarrativeAgentInterface;
  private redTeamAgent: RedTeamAnalyzer;
  private config: LoopConfig;

  constructor(deps: {
    saga: ValueCaseSaga;
    idempotencyGuard: IdempotencyGuard;
    dlq: DeadLetterQueue;
    opportunityAgent: OpportunityAgentInterface;
    financialModelingAgent: FinancialModelingAgentInterface;
    groundTruthAgent: GroundTruthAgentInterface;
    narrativeAgent: NarrativeAgentInterface;
    redTeamAgent: RedTeamAnalyzer;
    config?: Partial<LoopConfig>;
  }) {
    this.saga = deps.saga;
    this.idempotencyGuard = deps.idempotencyGuard;
    this.dlq = deps.dlq;
    this.opportunityAgent = deps.opportunityAgent;
    this.financialModelingAgent = deps.financialModelingAgent;
    this.groundTruthAgent = deps.groundTruthAgent;
    this.narrativeAgent = deps.narrativeAgent;
    this.redTeamAgent = deps.redTeamAgent;
    this.config = {
      maxRevisionCycles: deps.config?.maxRevisionCycles ?? DEFAULT_MAX_REVISION_CYCLES,
    };
  }

  /**
   * Run the full hypothesis-first core loop.
   *
   * @param domainPackContext - Optional KPI vocabulary from a domain pack,
   *   prepended to agent queries so they prefer industry-specific terminology.
   */
  async run(
    valueCaseId: string,
    tenantId: string,
    correlationId: string,
    sse?: SSEEmitter,
    domainPackContext?: string
  ): Promise<LoopResult> {
    const context = { organizationId: tenantId };
    const packPrefix = domainPackContext ? `${domainPackContext}\n\n` : '';
    let revisionCount = 0;
    let hypotheses: ValueHypothesis[] = [];
    let valueTree: ValueTree | null = null;
    let evidenceBundle: EvidenceReport | null = null;
    let narrative: NarrativeBlock | null = null;
    let allObjections: Objection[] = [];

    try {
      // Step 1: Hypothesis
      this.currentRevisionCycle = 0;
      this.emitProgress(sse, 1, 'Hypothesis', 'running', 'Identifying value drivers...', { agentName: 'OpportunityAgent' });
      hypotheses = await this.executeWithGuard(
        `${valueCaseId}:hypothesis`,
        async () => {
          const result = await this.opportunityAgent.analyzeOpportunities(
            `${packPrefix}Identify value drivers for case ${valueCaseId}`,
            context
          );
          return result.opportunities.map((o, i) => ({
            id: `hyp_${valueCaseId}_${i}`,
            description: o.description,
            confidence: o.confidence,
            category: o.category,
            estimatedValue: o.estimatedValue,
          }));
        },
        valueCaseId,
        tenantId,
        correlationId,
        'opportunity'
      );
      const avgHypConfidence = hypotheses.length > 0
        ? hypotheses.reduce((s, h) => s + h.confidence, 0) / hypotheses.length
        : 0;
      this.emitProgress(sse, 1, 'Hypothesis', 'completed', `Found ${hypotheses.length} hypotheses`, {
        agentName: 'OpportunityAgent',
        confidence: avgHypConfidence,
        partialResult: {
          itemCount: hypotheses.length,
          highlights: hypotheses.slice(0, 3).map((h) => h.description.slice(0, 80)),
        },
      });

      // Transition to DRAFTING
      await this.saga.transition(valueCaseId, SagaTrigger.OPPORTUNITY_INGESTED, correlationId);

      // Revision loop (steps 2-6)
      let needsRevision = true;
      while (needsRevision && revisionCount <= this.config.maxRevisionCycles) {
        // Step 2: Model
        this.currentRevisionCycle = revisionCount;
        this.emitProgress(sse, 2, 'Model', 'running', 'Building financial value tree...', { agentName: 'FinancialModelingAgent' });
        const modelResult = await this.executeWithGuard(
          `${valueCaseId}:model:${revisionCount}`,
          async () => {
            const hypothesisContext = hypotheses.map((h) => h.description).join('; ');
            const objectionContext = allObjections.length > 0
              ? `\nPrevious objections to address: ${allObjections.map((o) => o.description).join('; ')}`
              : '';
            return this.financialModelingAgent.analyzeFinancialModels(
              `${packPrefix}Build value tree for hypotheses: ${hypothesisContext}${objectionContext}`,
              context
            );
          },
          valueCaseId,
          tenantId,
          correlationId,
          'financial-modeling'
        );

        valueTree = this.buildValueTree(
          valueCaseId,
          revisionCount,
          modelResult.financial_models,
          hypotheses
        );
        this.emitProgress(sse, 2, 'Model', 'completed', `Value tree: ${valueTree.nodes.length} nodes, $${Math.round(valueTree.totalValue).toLocaleString()}`, {
          agentName: 'FinancialModelingAgent',
          confidence: valueTree.nodes.length > 0
            ? valueTree.nodes.reduce((s, n) => s + n.confidenceScore, 0) / valueTree.nodes.length
            : 0,
          partialResult: {
            itemCount: valueTree.nodes.length,
            totalValue: valueTree.totalValue,
            highlights: valueTree.nodes.slice(0, 3).map((n) => n.label),
          },
        });

        // Transition to VALIDATING
        await this.saga.transition(valueCaseId, SagaTrigger.HYPOTHESIS_CONFIRMED, correlationId);

        // Step 3: Evidence
        this.emitProgress(sse, 3, 'Evidence', 'running', 'Gathering grounding evidence...', { agentName: 'GroundTruthAgent' });
        const evidenceResult = await this.executeWithGuard(
          `${valueCaseId}:evidence:${revisionCount}`,
          async () => {
            return this.groundTruthAgent.analyzeGroundtruth(
              `${packPrefix}Retrieve evidence for value tree: ${JSON.stringify(valueTree)}`,
              context
            );
          },
          valueCaseId,
          tenantId,
          correlationId,
          'groundtruth'
        );
        evidenceBundle = {
          valueCaseId,
          items: evidenceResult.groundtruths,
          analysis: evidenceResult.analysis,
          timestamp: new Date().toISOString(),
        };
        const avgEvidenceConf = evidenceBundle.items.length > 0
          ? evidenceBundle.items.reduce((s, e) => s + e.confidence, 0) / evidenceBundle.items.length
          : 0;
        this.emitProgress(sse, 3, 'Evidence', 'completed', `${evidenceBundle.items.length} evidence items collected`, {
          agentName: 'GroundTruthAgent',
          confidence: avgEvidenceConf,
          partialResult: {
            itemCount: evidenceBundle.items.length,
            highlights: evidenceBundle.items.slice(0, 3).map((e) => e.title),
          },
        });

        if (evidenceResult.vetoDecision?.veto) {
          const vetoReason = evidenceResult.vetoDecision.reason ?? 'Integrity veto without reason';
          this.emitProgress(sse, 3, 'Evidence', 'failed', `Integrity vetoed: ${vetoReason}`, {
            agentName: 'GroundTruthAgent',
          });
          await this.saga.transition(valueCaseId, SagaTrigger.INTEGRITY_VETOED, correlationId);
          throw new Error(`Integrity vetoed value case: ${vetoReason}`);
        }

        // Transition to COMPOSING
        await this.saga.transition(valueCaseId, SagaTrigger.INTEGRITY_PASSED, correlationId);

        // Step 4: Narrative
        this.emitProgress(sse, 4, 'Narrative', 'running', 'Composing executive narrative...', { agentName: 'NarrativeAgent' });
        const narrativeResult = await this.executeWithGuard(
          `${valueCaseId}:narrative:${revisionCount}`,
          async () => {
            return this.narrativeAgent.analyzeNarrative(
              `${packPrefix}Create executive narrative for value tree: ${JSON.stringify(valueTree)} with evidence: ${JSON.stringify(evidenceBundle)}`,
              context
            );
          },
          valueCaseId,
          tenantId,
          correlationId,
          'narrative'
        );
        narrative = {
          id: `narr_${valueCaseId}_${revisionCount}`,
          valueCaseId,
          title: narrativeResult.narratives[0]?.title ?? 'Value Case Narrative',
          executiveSummary: narrativeResult.analysis,
          sections: narrativeResult.narratives.map((n) => ({
            heading: n.title,
            content: n.description,
            claimIds: [],
            confidenceScore: n.confidence,
          })),
          timestamp: new Date().toISOString(),
        };
        const avgNarrConf = narrative.sections.length > 0
          ? narrative.sections.reduce((s, sec) => s + sec.confidenceScore, 0) / narrative.sections.length
          : 0;
        this.emitProgress(sse, 4, 'Narrative', 'completed', `"${narrative.title}" — ${narrative.sections.length} sections`, {
          agentName: 'NarrativeAgent',
          confidence: avgNarrConf,
          partialResult: {
            itemCount: narrative.sections.length,
            highlights: [narrative.title, narrative.executiveSummary.slice(0, 120)],
          },
        });

        // Step 5: Objection (Red Team)
        this.emitProgress(sse, 5, 'Objection', 'running', 'Red team stress-testing claims...', { agentName: 'RedTeamAgent' });
        const redTeamResult = await this.executeWithGuard<RedTeamOutput>(
          `${valueCaseId}:redteam:${revisionCount}`,
          async () => {
            return this.redTeamAgent.analyze({
              valueCaseId,
              tenantId,
              valueTree: valueTree as unknown as Record<string, unknown>,
              narrativeBlock: narrative as unknown as Record<string, unknown>,
              evidenceBundle: evidenceBundle as unknown as Record<string, unknown>,
              idempotencyKey: crypto.randomUUID(),
            });
          },
          valueCaseId,
          tenantId,
          correlationId,
          'red-team'
        );
        allObjections = redTeamResult.objections;
        const criticalCount = allObjections.filter((o) => o.severity === 'critical').length;
        this.emitProgress(sse, 5, 'Objection', 'completed',
          `${allObjections.length} objections (${criticalCount} critical)`, {
          agentName: 'RedTeamAgent',
          partialResult: {
            itemCount: allObjections.length,
            highlights: allObjections.slice(0, 3).map((o) => o.description.slice(0, 80)),
          },
        });

        // Step 6: Revision check
        const hasCritical = allObjections.some((o) => o.severity === 'critical');
        if (hasCritical && revisionCount < this.config.maxRevisionCycles) {
          this.emitProgress(sse, 6, 'Revision', 'running',
            `Revision cycle ${revisionCount + 1} — addressing ${criticalCount} critical objections`, {
            agentName: 'RedTeamAgent',
            partialResult: { itemCount: criticalCount },
          });
          revisionCount++;

          // Direct transition COMPOSING → DRAFTING via REDTEAM_OBJECTION
          await this.saga.transition(valueCaseId, SagaTrigger.REDTEAM_OBJECTION, correlationId);

          this.emitProgress(sse, 6, 'Revision', 'completed', `Re-entering at DRAFTING (cycle ${revisionCount}/${this.config.maxRevisionCycles})`, {
            partialResult: { itemCount: revisionCount },
          });
          // Loop continues
        } else {
          needsRevision = false;
        }
      }

      // Step 7: Approval — transition to REFINING then FINALIZED
      this.emitProgress(sse, 7, 'Approval', 'running', 'Finalizing value case...', {});
      // Move to REFINING first (COMPOSING → REFINING via FEEDBACK_RECEIVED)
      const currentState = await this.saga.getState(valueCaseId);
      if (currentState?.state === 'COMPOSING') {
        await this.saga.transition(valueCaseId, SagaTrigger.FEEDBACK_RECEIVED, correlationId);
      }
      // Then FINALIZED (REFINING → FINALIZED via VE_APPROVED)
      await this.saga.transition(valueCaseId, SagaTrigger.VE_APPROVED, correlationId);
      this.emitProgress(sse, 7, 'Approval', 'completed', 'Value case finalized', {
        partialResult: {
          itemCount: hypotheses.length,
          totalValue: valueTree?.totalValue,
          highlights: narrative ? [narrative.title] : [],
        },
      });

      return {
        valueCaseId,
        tenantId,
        hypotheses,
        valueTree,
        evidenceBundle,
        narrative,
        objections: allObjections,
        revisionCount,
        finalState: 'FINALIZED',
        success: true,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Attempt compensation
      try {
        await this.saga.compensate(valueCaseId, correlationId);
      } catch {
        // Compensation failure is logged by the saga
      }

      return {
        valueCaseId,
        tenantId,
        hypotheses,
        valueTree,
        evidenceBundle,
        narrative,
        objections: allObjections,
        revisionCount,
        finalState: 'FAILED',
        success: false,
        error: errorMsg,
      };
    }
  }

  // ---- Private helpers ----

  private async executeWithGuard<T>(
    stepKey: string,
    fn: () => Promise<T>,
    valueCaseId: string,
    tenantId: string,
    correlationId: string,
    agentType: string
  ): Promise<T> {
    // Deterministic key: same step retried produces the same key, hitting the cache.
    const idempotencyKey = stepKey;

    try {
      const result = await this.idempotencyGuard.execute(idempotencyKey, fn);
      return result.result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Route to DLQ
      const dlqEntry: DLQEntry = {
        taskId: `${stepKey}:${correlationId}`,
        agentType,
        input: { valueCaseId, stepKey },
        error: errorMsg,
        timestamp: new Date().toISOString(),
        correlationId,
        tenantId,
        retryCount: 0,
      };
      await this.dlq.enqueue(dlqEntry);

      throw error;
    }
  }

  /**
   * Build a ValueTree from the modeling agent's structured output.
   * Falls back to hypothesis estimatedValue when the model doesn't provide a value.
   */
  private buildValueTree(
    valueCaseId: string,
    revisionCount: number,
    models: FinancialModelOutput[],
    hypotheses: ValueHypothesis[]
  ): ValueTree {
    // Index hypotheses by description for fallback value lookup.
    // The modeling agent's title often derives from the hypothesis description.
    const hypothesisValues: Array<{ description: string; value: number }> = [];
    for (const h of hypotheses) {
      if (typeof h.estimatedValue === 'number' && h.estimatedValue !== 0) {
        hypothesisValues.push({ description: h.description.toLowerCase(), value: h.estimatedValue });
      }
    }

    const nodes: ValueTreeNode[] = models.map((m, i) => {
      // Resolve value: model output > hypothesis fallback > 0
      const modelValue = typeof m.value === 'number' ? m.value : 0;
      // Fuzzy match: find hypothesis whose description appears in the model title or vice versa
      const titleLower = m.title.toLowerCase();
      const matchedHypothesis = hypothesisValues.find(
        (h) => titleLower.includes(h.description.substring(0, 30)) || h.description.includes(titleLower.substring(0, 30))
      );
      const hypothesisValue = matchedHypothesis?.value ?? 0;
      const resolvedValue = modelValue !== 0 ? modelValue : hypothesisValue;

      // Build driver sub-nodes
      const drivers: ValueDriver[] = (m.drivers ?? []).map((d) => ({
        metric: d.metric,
        value: d.value,
        unit: d.unit,
        timeBasis: d.timeBasis,
        assumptions: d.assumptions ?? [],
        citations: d.citations ?? [],
      }));

      // Build citations: model citations > provenance pointers
      const citations: string[] = m.citations && m.citations.length > 0
        ? m.citations
        : [`model:${valueCaseId}:${i}`];

      return {
        id: `node_${i}`,
        label: m.title,
        value: resolvedValue,
        currency: m.currency ?? 'USD',
        timeBasis: m.timeBasis,
        range: m.range,
        formula: m.description,
        confidenceScore: m.confidence,
        assumptions: m.assumptions ?? [],
        dependencies: m.dependencies ?? [],
        citations,
        drivers,
      };
    });

    const totalValue = nodes.reduce((sum, n) => sum + n.value, 0);

    return {
      id: `vt_${valueCaseId}_${revisionCount}`,
      valueCaseId,
      nodes,
      totalValue,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    };
  }

  private stepTimers: Map<number, number> = new Map();
  private currentRevisionCycle = 0;

  private emitProgress(
    sse: SSEEmitter | undefined,
    step: number,
    stepName: string,
    status: LoopProgress['status'],
    message?: string,
    extra?: Partial<Pick<LoopProgress, 'agentName' | 'confidence' | 'partialResult'>>
  ): void {
    if (!sse) return;

    if (status === 'running') {
      this.stepTimers.set(step, Date.now());
    }

    const startTime = this.stepTimers.get(step);
    const durationMs = startTime && status !== 'running'
      ? Date.now() - startTime
      : undefined;

    sse.send({
      step,
      stepName,
      status,
      message,
      timestamp: new Date().toISOString(),
      totalSteps: 7,
      agentName: extra?.agentName,
      revisionCycle: this.currentRevisionCycle,
      maxRevisionCycles: this.config.maxRevisionCycles,
      confidence: extra?.confidence,
      durationMs,
      partialResult: extra?.partialResult,
    });
  }
}
