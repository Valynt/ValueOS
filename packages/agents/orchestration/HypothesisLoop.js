"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HypothesisLoop = exports.LoopResultSchema = exports.EvidenceReportSchema = exports.NarrativeBlockSchema = exports.NarrativeSectionSchema = exports.ValueTreeSchema = exports.ValueTreeNodeSchema = exports.ValueHypothesisSchema = void 0;
const zod_1 = require("zod");
const ValueCaseSaga_js_1 = require("../core/ValueCaseSaga.js");
const RedTeamAgent_js_1 = require("./agents/RedTeamAgent.js");
// ============================================================================
// Zod Schemas
// ============================================================================
exports.ValueHypothesisSchema = zod_1.z.object({
    id: zod_1.z.string(),
    description: zod_1.z.string(),
    confidence: zod_1.z.number().min(0).max(1).refine((n) => !Number.isNaN(n), { message: 'confidence must not be NaN' }),
    category: zod_1.z.string(),
    estimatedValue: zod_1.z.number().refine((n) => !Number.isNaN(n), { message: 'estimatedValue must not be NaN' }).optional(),
});
exports.ValueTreeNodeSchema = zod_1.z.lazy(() => zod_1.z.object({
    id: zod_1.z.string(),
    label: zod_1.z.string(),
    value: zod_1.z.number().refine((n) => !Number.isNaN(n), { message: 'node value must not be NaN' }),
    formula: zod_1.z.string().optional(),
    confidenceScore: zod_1.z.number().min(0).max(1).refine((n) => !Number.isNaN(n), { message: 'confidenceScore must not be NaN' }),
    citations: zod_1.z.array(zod_1.z.string()),
    children: zod_1.z.array(exports.ValueTreeNodeSchema).optional(),
}));
exports.ValueTreeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    valueCaseId: zod_1.z.string(),
    nodes: zod_1.z.array(exports.ValueTreeNodeSchema),
    totalValue: zod_1.z.number().refine((n) => !Number.isNaN(n), { message: 'totalValue must not be NaN' }),
    currency: zod_1.z.string(),
    timestamp: zod_1.z.string(),
}).strict();
exports.NarrativeSectionSchema = zod_1.z.object({
    heading: zod_1.z.string(),
    content: zod_1.z.string(),
    claimIds: zod_1.z.array(zod_1.z.string()),
    confidenceScore: zod_1.z.number().min(0).max(1).refine((n) => !Number.isNaN(n), { message: 'confidenceScore must not be NaN' }),
}).strict();
exports.NarrativeBlockSchema = zod_1.z.object({
    id: zod_1.z.string(),
    valueCaseId: zod_1.z.string(),
    title: zod_1.z.string(),
    executiveSummary: zod_1.z.string(),
    sections: zod_1.z.array(exports.NarrativeSectionSchema),
    timestamp: zod_1.z.string(),
}).strict();
/** Schema for the evidence bundle as constructed by the loop (not the formal EvidenceBundle domain type). */
exports.EvidenceReportSchema = zod_1.z.object({
    valueCaseId: zod_1.z.string(),
    items: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        confidence: zod_1.z.number().min(0).max(1).refine((n) => !Number.isNaN(n), { message: 'confidence must not be NaN' }),
        category: zod_1.z.string(),
        verification_type: zod_1.z.string(),
        priority: zod_1.z.string(),
    })),
    analysis: zod_1.z.string(),
    timestamp: zod_1.z.string(),
}).strict();
exports.LoopResultSchema = zod_1.z.object({
    valueCaseId: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    hypotheses: zod_1.z.array(exports.ValueHypothesisSchema),
    valueTree: exports.ValueTreeSchema.nullable(),
    evidenceBundle: exports.EvidenceReportSchema.nullable(),
    narrative: exports.NarrativeBlockSchema.nullable(),
    objections: zod_1.z.array(RedTeamAgent_js_1.ObjectionSchema),
    revisionCount: zod_1.z.number().int().min(0),
    finalState: zod_1.z.string(),
    success: zod_1.z.boolean(),
    error: zod_1.z.string().optional(),
});
// ============================================================================
// Constants
// ============================================================================
const DEFAULT_MAX_REVISION_CYCLES = 3;
// ============================================================================
// HypothesisLoop
// ============================================================================
class HypothesisLoop {
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
            await this.saga.transition(valueCaseId, ValueCaseSaga_js_1.SagaTrigger.OPPORTUNITY_INGESTED, correlationId);
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
                await this.saga.transition(valueCaseId, ValueCaseSaga_js_1.SagaTrigger.HYPOTHESIS_CONFIRMED, correlationId);
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
                await this.saga.transition(valueCaseId, ValueCaseSaga_js_1.SagaTrigger.INTEGRITY_PASSED, correlationId);
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
                    await this.saga.transition(valueCaseId, ValueCaseSaga_js_1.SagaTrigger.REDTEAM_OBJECTION, correlationId);
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
                await this.saga.transition(valueCaseId, ValueCaseSaga_js_1.SagaTrigger.FEEDBACK_RECEIVED, correlationId);
            }
            // Then FINALIZED (REFINING → FINALIZED via VE_APPROVED)
            await this.saga.transition(valueCaseId, ValueCaseSaga_js_1.SagaTrigger.VE_APPROVED, correlationId);
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
exports.HypothesisLoop = HypothesisLoop;
//# sourceMappingURL=HypothesisLoop.js.map