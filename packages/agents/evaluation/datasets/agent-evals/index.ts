/**
 * Agent Evaluation Datasets
 *
 * Golden input/output pairs for each agent in the HypothesisLoop pipeline.
 * Used for both deterministic mock testing and LLM output quality evaluation.
 */

export { opportunityEvalCases, type OpportunityEvalCase } from './opportunity-agent.js';
export { financialModelingEvalCases, type FinancialModelingEvalCase } from './financial-modeling-agent.js';
export { groundtruthEvalCases, type GroundtruthEvalCase } from './groundtruth-agent.js';
export { narrativeEvalCases, type NarrativeEvalCase } from './narrative-agent.js';
export { redTeamEvalCases, type RedTeamEvalCase } from './red-team-agent.js';
