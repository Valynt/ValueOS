/**
 * Agent Evaluation Harness
 *
 * Runs agent evaluation cases and produces structured results.
 * Supports two modes:
 * - Mock mode: uses deterministic mock responses for unit testing
 * - Live mode: calls actual agents and validates output structure/constraints
 */
import type { FinancialModelingEvalCase } from './datasets/agent-evals/financial-modeling-agent.js';
import type { GroundtruthEvalCase } from './datasets/agent-evals/groundtruth-agent.js';
import type { NarrativeEvalCase } from './datasets/agent-evals/narrative-agent.js';
import type { OpportunityEvalCase } from './datasets/agent-evals/opportunity-agent.js';
import type { RedTeamEvalCase } from './datasets/agent-evals/red-team-agent.js';
export interface EvalResult {
    caseId: string;
    caseName: string;
    agentType: string;
    passed: boolean;
    checks: EvalCheck[];
    durationMs: number;
    error?: string;
}
export interface EvalCheck {
    name: string;
    passed: boolean;
    expected: string;
    actual: string;
    message?: string;
}
export interface EvalSummary {
    totalCases: number;
    passed: number;
    failed: number;
    passRate: number;
    results: EvalResult[];
    timestamp: string;
}
export declare function validateOpportunityResponse(evalCase: OpportunityEvalCase, response: OpportunityEvalCase['mockResponse'] & {
    timestamp?: string;
}): EvalCheck[];
export declare function validateFinancialModelingResponse(evalCase: FinancialModelingEvalCase, response: FinancialModelingEvalCase['mockResponse'] & {
    timestamp?: string;
}): EvalCheck[];
export declare function validateGroundtruthResponse(evalCase: GroundtruthEvalCase, response: GroundtruthEvalCase['mockResponse'] & {
    timestamp?: string;
}): EvalCheck[];
export declare function validateNarrativeResponse(evalCase: NarrativeEvalCase, response: NarrativeEvalCase['mockResponse'] & {
    timestamp?: string;
}): EvalCheck[];
export declare function validateRedTeamResponse(evalCase: RedTeamEvalCase, response: RedTeamEvalCase['mockResponse'] & {
    timestamp?: string;
}): EvalCheck[];
export declare function runEvalChecks(caseId: string, caseName: string, agentType: string, checks: EvalCheck[], startTime: number): EvalResult;
export declare function summarizeResults(results: EvalResult[]): EvalSummary;
//# sourceMappingURL=harness.d.ts.map