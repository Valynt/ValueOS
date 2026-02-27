"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockProvenanceStore = exports.createMockSagaPersistence = exports.createMockAuditLogger = exports.createMockEventEmitter = exports.createMockDLQStore = exports.createMockIdempotencyStore = exports.createMockRedTeamAgent = exports.createMockNarrativeAgent = exports.createMockGroundTruthAgent = exports.createMockFinancialModelingAgent = exports.createMockOpportunityAgent = exports.summarizeResults = exports.runEvalChecks = exports.validateRedTeamResponse = exports.validateNarrativeResponse = exports.validateGroundtruthResponse = exports.validateFinancialModelingResponse = exports.validateOpportunityResponse = exports.redTeamEvalCases = exports.narrativeEvalCases = exports.groundtruthEvalCases = exports.financialModelingEvalCases = exports.opportunityEvalCases = exports.healthcareRevenueCycleScenario = exports.manufacturingYieldScenario = exports.saassDsoReductionScenario = exports.GROUND_TRUTH_SCENARIOS = void 0;
// Ground truth scenarios
var index_js_1 = require("./datasets/ground-truth/index.js");
Object.defineProperty(exports, "GROUND_TRUTH_SCENARIOS", { enumerable: true, get: function () { return index_js_1.GROUND_TRUTH_SCENARIOS; } });
Object.defineProperty(exports, "saassDsoReductionScenario", { enumerable: true, get: function () { return index_js_1.saassDsoReductionScenario; } });
Object.defineProperty(exports, "manufacturingYieldScenario", { enumerable: true, get: function () { return index_js_1.manufacturingYieldScenario; } });
Object.defineProperty(exports, "healthcareRevenueCycleScenario", { enumerable: true, get: function () { return index_js_1.healthcareRevenueCycleScenario; } });
// Agent evaluation datasets
var index_js_2 = require("./datasets/agent-evals/index.js");
Object.defineProperty(exports, "opportunityEvalCases", { enumerable: true, get: function () { return index_js_2.opportunityEvalCases; } });
Object.defineProperty(exports, "financialModelingEvalCases", { enumerable: true, get: function () { return index_js_2.financialModelingEvalCases; } });
Object.defineProperty(exports, "groundtruthEvalCases", { enumerable: true, get: function () { return index_js_2.groundtruthEvalCases; } });
Object.defineProperty(exports, "narrativeEvalCases", { enumerable: true, get: function () { return index_js_2.narrativeEvalCases; } });
Object.defineProperty(exports, "redTeamEvalCases", { enumerable: true, get: function () { return index_js_2.redTeamEvalCases; } });
// Evaluation harness
var harness_js_1 = require("./harness.js");
Object.defineProperty(exports, "validateOpportunityResponse", { enumerable: true, get: function () { return harness_js_1.validateOpportunityResponse; } });
Object.defineProperty(exports, "validateFinancialModelingResponse", { enumerable: true, get: function () { return harness_js_1.validateFinancialModelingResponse; } });
Object.defineProperty(exports, "validateGroundtruthResponse", { enumerable: true, get: function () { return harness_js_1.validateGroundtruthResponse; } });
Object.defineProperty(exports, "validateNarrativeResponse", { enumerable: true, get: function () { return harness_js_1.validateNarrativeResponse; } });
Object.defineProperty(exports, "validateRedTeamResponse", { enumerable: true, get: function () { return harness_js_1.validateRedTeamResponse; } });
Object.defineProperty(exports, "runEvalChecks", { enumerable: true, get: function () { return harness_js_1.runEvalChecks; } });
Object.defineProperty(exports, "summarizeResults", { enumerable: true, get: function () { return harness_js_1.summarizeResults; } });
// Mock agents and infrastructure
var mock_agents_js_1 = require("./mock-agents.js");
Object.defineProperty(exports, "createMockOpportunityAgent", { enumerable: true, get: function () { return mock_agents_js_1.createMockOpportunityAgent; } });
Object.defineProperty(exports, "createMockFinancialModelingAgent", { enumerable: true, get: function () { return mock_agents_js_1.createMockFinancialModelingAgent; } });
Object.defineProperty(exports, "createMockGroundTruthAgent", { enumerable: true, get: function () { return mock_agents_js_1.createMockGroundTruthAgent; } });
Object.defineProperty(exports, "createMockNarrativeAgent", { enumerable: true, get: function () { return mock_agents_js_1.createMockNarrativeAgent; } });
Object.defineProperty(exports, "createMockRedTeamAgent", { enumerable: true, get: function () { return mock_agents_js_1.createMockRedTeamAgent; } });
Object.defineProperty(exports, "createMockIdempotencyStore", { enumerable: true, get: function () { return mock_agents_js_1.createMockIdempotencyStore; } });
Object.defineProperty(exports, "createMockDLQStore", { enumerable: true, get: function () { return mock_agents_js_1.createMockDLQStore; } });
Object.defineProperty(exports, "createMockEventEmitter", { enumerable: true, get: function () { return mock_agents_js_1.createMockEventEmitter; } });
Object.defineProperty(exports, "createMockAuditLogger", { enumerable: true, get: function () { return mock_agents_js_1.createMockAuditLogger; } });
Object.defineProperty(exports, "createMockSagaPersistence", { enumerable: true, get: function () { return mock_agents_js_1.createMockSagaPersistence; } });
Object.defineProperty(exports, "createMockProvenanceStore", { enumerable: true, get: function () { return mock_agents_js_1.createMockProvenanceStore; } });
//# sourceMappingURL=index.js.map