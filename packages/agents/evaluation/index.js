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
// Ground truth scenarios
export { GROUND_TRUTH_SCENARIOS, saassDsoReductionScenario, manufacturingYieldScenario, healthcareRevenueCycleScenario, } from './datasets/ground-truth/index.js';
// Agent evaluation datasets
export { opportunityEvalCases, financialModelingEvalCases, groundtruthEvalCases, narrativeEvalCases, redTeamEvalCases, } from './datasets/agent-evals/index.js';
// Evaluation harness
export { validateOpportunityResponse, validateFinancialModelingResponse, validateGroundtruthResponse, validateNarrativeResponse, validateRedTeamResponse, runEvalChecks, summarizeResults, } from './harness.js';
// Mock agents and infrastructure
export { createMockOpportunityAgent, createMockFinancialModelingAgent, createMockGroundTruthAgent, createMockNarrativeAgent, createMockRedTeamAgent, createMockIdempotencyStore, createMockDLQStore, createMockEventEmitter, createMockAuditLogger, createMockSagaPersistence, createMockProvenanceStore, } from './mock-agents.js';
//# sourceMappingURL=index.js.map