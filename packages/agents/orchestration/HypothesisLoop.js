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
import { SagaTrigger } from '../core/ValueCaseSaga.js';
import { ObjectionSchema } from './agents/RedTeamAgent.js';
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
export const ValueTreeNodeSchema = z.lazy(() => z.object({
    id: z.string(),
    label: z.string(),
    value: z.number().refine((n) => !Number.isNaN(n), { message: 'node value must not be NaN' }),
    formula: z.string().optional(),
    confidenceScore: z.number().min(0).max(1).refine((n) => !Number.isNaN(n), { message: 'confidenceScore must not be NaN' }),
    citations: z.array(z.string()),
    children: z.array(ValueTreeNodeSchema).optional(),
}));
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
    saga;
    idempotencyGuard;
    dlq;
    opportunityAgent;
    financialModelingAgent;
    groundTruthAgent;
    narrativeAgent;
    redTeamAgent;
    config;
    constructor(deps) {
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
    async run(valueCaseId, tenantId, correlationId, sse, domainPackContext) {
        const context = { organizationId: tenantId };
        const packPrefix = domainPackContext ? `${domainPackContext}\n\n` : '';
        let revisionCount = 0;
        let hypotheses = [];
        let valueTree = null;
        let evidenceBundle = null;
        let narrative = null;
        let allObjections = [];
        try {
            // Step 1: Hypothesis
            this.emitProgress(sse, 1, 'Hypothesis', 'running');
            hypotheses = await this.executeWithGuard(`${valueCaseId}:hypothesis`, async () => {
                const result = await this.opportunityAgent.analyzeOpportunities(`${packPrefix}Identify value drivers for case ${valueCaseId}`, context);
                return result.opportunities.map((o, i) => ({
                    id: `hyp_${valueCaseId}_${i}`,
                    description: o.description,
                    confidence: o.confidence,
                    category: o.category,
                    estimatedValue: o.estimatedValue,
                }));
            }, valueCaseId, tenantId, correlationId, 'opportunity');
            this.emitProgress(sse, 1, 'Hypothesis', 'completed', `Found ${hypotheses.length} hypotheses`);
            // Transition to DRAFTING
            await this.saga.transition(valueCaseId, SagaTrigger.OPPORTUNITY_INGESTED, correlationId);
            // Revision loop (steps 2-6)
            let needsRevision = true;
            while (needsRevision && revisionCount <= this.config.maxRevisionCycles) {
                // Step 2: Model
                this.emitProgress(sse, 2, 'Model', 'running');
                const modelResult = await this.executeWithGuard(`${valueCaseId}:model:${revisionCount}`, async () => {
                    const hypothesisContext = hypotheses.map((h) => h.description).join('; ');
                    const objectionContext = allObjections.length > 0
                        ? `\nPrevious objections to address: ${allObjections.map((o) => o.description).join('; ')}`
                        : '';
                    return this.financialModelingAgent.analyzeFinancialModels(`${packPrefix}Build value tree for hypotheses: ${hypothesisContext}${objectionContext}`, context);
                }, valueCaseId, tenantId, correlationId, 'financial-modeling');
                valueTree = this.buildValueTree(valueCaseId, revisionCount, modelResult.financial_models, hypotheses);
                this.emitProgress(sse, 2, 'Model', 'completed');
                // Transition to VALIDATING
                await this.saga.transition(valueCaseId, SagaTrigger.HYPOTHESIS_CONFIRMED, correlationId);
                // Step 3: Evidence
                this.emitProgress(sse, 3, 'Evidence', 'running');
                const evidenceResult = await this.executeWithGuard(`${valueCaseId}:evidence:${revisionCount}`, async () => {
                    return this.groundTruthAgent.analyzeGroundtruth(`${packPrefix}Retrieve evidence for value tree: ${JSON.stringify(valueTree)}`, context);
                }, valueCaseId, tenantId, correlationId, 'groundtruth');
                evidenceBundle = {
                    valueCaseId,
                    items: evidenceResult.groundtruths,
                    analysis: evidenceResult.analysis,
                    timestamp: new Date().toISOString(),
                };
                this.emitProgress(sse, 3, 'Evidence', 'completed');
                // Transition to COMPOSING
                await this.saga.transition(valueCaseId, SagaTrigger.INTEGRITY_PASSED, correlationId);
                // Step 4: Narrative
                this.emitProgress(sse, 4, 'Narrative', 'running');
                const narrativeResult = await this.executeWithGuard(`${valueCaseId}:narrative:${revisionCount}`, async () => {
                    return this.narrativeAgent.analyzeNarrative(`${packPrefix}Create executive narrative for value tree: ${JSON.stringify(valueTree)} with evidence: ${JSON.stringify(evidenceBundle)}`, context);
                }, valueCaseId, tenantId, correlationId, 'narrative');
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
                this.emitProgress(sse, 4, 'Narrative', 'completed');
                // Step 5: Objection (Red Team)
                this.emitProgress(sse, 5, 'Objection', 'running');
                const redTeamResult = await this.executeWithGuard(`${valueCaseId}:redteam:${revisionCount}`, async () => {
                    return this.redTeamAgent.analyze({
                        valueCaseId,
                        tenantId,
                        valueTree: valueTree,
                        narrativeBlock: narrative,
                        evidenceBundle: evidenceBundle,
                        idempotencyKey: crypto.randomUUID(),
                    });
                }, valueCaseId, tenantId, correlationId, 'red-team');
                allObjections = redTeamResult.objections;
                this.emitProgress(sse, 5, 'Objection', 'completed', `${allObjections.length} objections found`);
                // Step 6: Revision check
                const hasCritical = allObjections.some((o) => o.severity === 'critical');
                if (hasCritical && revisionCount < this.config.maxRevisionCycles) {
                    this.emitProgress(sse, 6, 'Revision', 'running', `Revision cycle ${revisionCount + 1}`);
                    revisionCount++;
                    // Direct transition COMPOSING → DRAFTING via REDTEAM_OBJECTION
                    await this.saga.transition(valueCaseId, SagaTrigger.REDTEAM_OBJECTION, correlationId);
                    this.emitProgress(sse, 6, 'Revision', 'completed', `Re-entering at DRAFTING`);
                    // Loop continues
                }
                else {
                    needsRevision = false;
                }
            }
            // Step 7: Approval — transition to REFINING then FINALIZED
            this.emitProgress(sse, 7, 'Approval', 'running');
            // Move to REFINING first (COMPOSING → REFINING via FEEDBACK_RECEIVED)
            const currentState = await this.saga.getState(valueCaseId);
            if (currentState?.state === 'COMPOSING') {
                await this.saga.transition(valueCaseId, SagaTrigger.FEEDBACK_RECEIVED, correlationId);
            }
            // Then FINALIZED (REFINING → FINALIZED via VE_APPROVED)
            await this.saga.transition(valueCaseId, SagaTrigger.VE_APPROVED, correlationId);
            this.emitProgress(sse, 7, 'Approval', 'completed', 'Value case finalized');
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
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            // Attempt compensation
            try {
                await this.saga.compensate(valueCaseId, correlationId);
            }
            catch {
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
    async executeWithGuard(stepKey, fn, valueCaseId, tenantId, correlationId, agentType) {
        // Deterministic key: same step retried produces the same key, hitting the cache.
        const idempotencyKey = stepKey;
        try {
            const result = await this.idempotencyGuard.execute(idempotencyKey, fn);
            return result.result;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            // Route to DLQ
            const dlqEntry = {
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
    buildValueTree(valueCaseId, revisionCount, models, hypotheses) {
        // Index hypotheses by description for fallback value lookup.
        // The modeling agent's title often derives from the hypothesis description.
        const hypothesisValues = [];
        for (const h of hypotheses) {
            if (typeof h.estimatedValue === 'number' && h.estimatedValue !== 0) {
                hypothesisValues.push({ description: h.description.toLowerCase(), value: h.estimatedValue });
            }
        }
        const nodes = models.map((m, i) => {
            // Resolve value: model output > hypothesis fallback > 0
            const modelValue = typeof m.value === 'number' ? m.value : 0;
            // Fuzzy match: find hypothesis whose description appears in the model title or vice versa
            const titleLower = m.title.toLowerCase();
            const matchedHypothesis = hypothesisValues.find((h) => titleLower.includes(h.description.substring(0, 30)) || h.description.includes(titleLower.substring(0, 30)));
            const hypothesisValue = matchedHypothesis?.value ?? 0;
            const resolvedValue = modelValue !== 0 ? modelValue : hypothesisValue;
            // Build driver sub-nodes
            const drivers = (m.drivers ?? []).map((d) => ({
                metric: d.metric,
                value: d.value,
                unit: d.unit,
                timeBasis: d.timeBasis,
                assumptions: d.assumptions ?? [],
                citations: d.citations ?? [],
            }));
            // Build citations: model citations > provenance pointers
            const citations = m.citations && m.citations.length > 0
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
    emitProgress(sse, step, stepName, status, message) {
        if (!sse)
            return;
        sse.send({
            step,
            stepName,
            status,
            message,
            timestamp: new Date().toISOString(),
        });
    }
}
//# sourceMappingURL=HypothesisLoop.js.map