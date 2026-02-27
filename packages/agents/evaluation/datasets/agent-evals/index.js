"use strict";
/**
 * Agent Evaluation Datasets
 *
 * Golden input/output pairs for each agent in the HypothesisLoop pipeline.
 * Used for both deterministic mock testing and LLM output quality evaluation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.redTeamEvalCases = exports.narrativeEvalCases = exports.groundtruthEvalCases = exports.financialModelingEvalCases = exports.opportunityEvalCases = void 0;
var opportunity_agent_js_1 = require("./opportunity-agent.js");
Object.defineProperty(exports, "opportunityEvalCases", { enumerable: true, get: function () { return opportunity_agent_js_1.opportunityEvalCases; } });
var financial_modeling_agent_js_1 = require("./financial-modeling-agent.js");
Object.defineProperty(exports, "financialModelingEvalCases", { enumerable: true, get: function () { return financial_modeling_agent_js_1.financialModelingEvalCases; } });
var groundtruth_agent_js_1 = require("./groundtruth-agent.js");
Object.defineProperty(exports, "groundtruthEvalCases", { enumerable: true, get: function () { return groundtruth_agent_js_1.groundtruthEvalCases; } });
var narrative_agent_js_1 = require("./narrative-agent.js");
Object.defineProperty(exports, "narrativeEvalCases", { enumerable: true, get: function () { return narrative_agent_js_1.narrativeEvalCases; } });
var red_team_agent_js_1 = require("./red-team-agent.js");
Object.defineProperty(exports, "redTeamEvalCases", { enumerable: true, get: function () { return red_team_agent_js_1.redTeamEvalCases; } });
//# sourceMappingURL=index.js.map