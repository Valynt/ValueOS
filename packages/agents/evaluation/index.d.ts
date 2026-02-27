/**
 * @valueos/agents/evaluation
 *
 * Agent evaluation harness, ground truth datasets, and mock infrastructure.
 *
 * - Ground truth datasets: complete value case scenarios for end-to-end validation
 * - Agent eval datasets: golden I/O pairs for per-agent testing
 * - Harness: structured validation and result reporting
 * - Mock agents: deterministic agent implementations for integration testing
 */
export { GROUND_TRUTH_SCENARIOS, saassDsoReductionScenario, manufacturingYieldScenario, healthcareRevenueCycleScenario, type GroundTruthScenarioId, } from './datasets/ground-truth/index.js';
export { opportunityEvalCases, financialModelingEvalCases, groundtruthEvalCases, narrativeEvalCases, redTeamEvalCases, type OpportunityEvalCase, type FinancialModelingEvalCase, type GroundtruthEvalCase, type NarrativeEvalCase, type RedTeamEvalCase, } from './datasets/agent-evals/index.js';
export { validateOpportunityResponse, validateFinancialModelingResponse, validateGroundtruthResponse, validateNarrativeResponse, validateRedTeamResponse, runEvalChecks, summarizeResults, type EvalResult, type EvalCheck, type EvalSummary, } from './harness.js';
export { createMockOpportunityAgent, createMockFinancialModelingAgent, createMockGroundTruthAgent, createMockNarrativeAgent, createMockRedTeamAgent, createMockIdempotencyStore, createMockDLQStore, createMockEventEmitter, createMockAuditLogger, createMockSagaPersistence, createMockProvenanceStore, } from './mock-agents.js';
//# sourceMappingURL=index.d.ts.map