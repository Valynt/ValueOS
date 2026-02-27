/**
 * Red Team Agent
 *
 * Stress-tests value claims by simulating CFO pushback.
 * Challenges assumptions, questions data sources, probes for math hallucinations.
 * Produces structured Objection[] with severity and category.
 */
import { z } from 'zod';
export interface Objection {
    id: string;
    targetComponent: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'assumption' | 'data_quality' | 'math_error' | 'missing_evidence' | 'logical_gap';
    description: string;
    suggestedRevision?: string;
}
export interface RedTeamInput {
    valueCaseId: string;
    tenantId: string;
    valueTree: Record<string, unknown>;
    narrativeBlock: Record<string, unknown>;
    evidenceBundle: Record<string, unknown>;
    idempotencyKey: string;
}
export interface RedTeamOutput {
    objections: Objection[];
    summary: string;
    hasCritical: boolean;
    timestamp: string;
}
export declare const ObjectionSchema: z.ZodObject<{
    id: z.ZodString;
    targetComponent: z.ZodString;
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    category: z.ZodEnum<["assumption", "data_quality", "math_error", "missing_evidence", "logical_gap"]>;
    description: z.ZodString;
    suggestedRevision: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    severity: "critical" | "low" | "medium" | "high";
    category: "assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap";
    targetComponent: string;
    suggestedRevision?: string | undefined;
}, {
    id: string;
    description: string;
    severity: "critical" | "low" | "medium" | "high";
    category: "assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap";
    targetComponent: string;
    suggestedRevision?: string | undefined;
}>;
export declare const RedTeamOutputSchema: z.ZodObject<{
    objections: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        targetComponent: z.ZodString;
        severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
        category: z.ZodEnum<["assumption", "data_quality", "math_error", "missing_evidence", "logical_gap"]>;
        description: z.ZodString;
        suggestedRevision: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        description: string;
        severity: "critical" | "low" | "medium" | "high";
        category: "assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap";
        targetComponent: string;
        suggestedRevision?: string | undefined;
    }, {
        id: string;
        description: string;
        severity: "critical" | "low" | "medium" | "high";
        category: "assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap";
        targetComponent: string;
        suggestedRevision?: string | undefined;
    }>, "many">;
    summary: z.ZodString;
    hasCritical: z.ZodBoolean;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    objections: {
        id: string;
        description: string;
        severity: "critical" | "low" | "medium" | "high";
        category: "assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap";
        targetComponent: string;
        suggestedRevision?: string | undefined;
    }[];
    summary: string;
    hasCritical: boolean;
}, {
    timestamp: string;
    objections: {
        id: string;
        description: string;
        severity: "critical" | "low" | "medium" | "high";
        category: "assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap";
        targetComponent: string;
        suggestedRevision?: string | undefined;
    }[];
    summary: string;
    hasCritical: boolean;
}>;
export interface RedTeamLLMGateway {
    complete(request: {
        messages: Array<{
            role: 'system' | 'user' | 'assistant';
            content: string;
        }>;
        metadata: {
            tenantId: string;
            [key: string]: unknown;
        };
    }): Promise<{
        content: string;
        usage?: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
        };
    }>;
}
export declare class RedTeamAgent {
    private llmGateway;
    constructor(llmGateway: RedTeamLLMGateway);
    /**
     * Execute red team analysis on a value case
     */
    analyze(input: RedTeamInput): Promise<RedTeamOutput>;
    /**
     * Check if any objections are critical (requiring automatic revision)
     */
    static hasCriticalObjections(objections: Objection[]): boolean;
    /**
     * Filter objections by severity
     */
    static filterBySeverity(objections: Objection[], severity: Objection['severity']): Objection[];
    private buildPrompt;
    private parseResponse;
}
//# sourceMappingURL=RedTeamAgent.d.ts.map