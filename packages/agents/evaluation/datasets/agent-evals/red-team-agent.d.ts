/**
 * Evaluation Dataset: Red Team Agent
 *
 * Golden input/output pairs for validating the RedTeamAgent.
 * Tests adversarial analysis quality, objection categorization,
 * severity assignment, and suggested revisions.
 */
import { z } from 'zod';
export declare const RedTeamEvalCaseSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    input: z.ZodObject<{
        valueCaseId: z.ZodString;
        tenantId: z.ZodString;
        valueTree: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        narrativeBlock: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        evidenceBundle: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        idempotencyKey: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        tenantId: string;
        idempotencyKey: string;
        valueCaseId: string;
        valueTree: Record<string, unknown>;
        evidenceBundle: Record<string, unknown>;
        narrativeBlock: Record<string, unknown>;
    }, {
        tenantId: string;
        idempotencyKey: string;
        valueCaseId: string;
        valueTree: Record<string, unknown>;
        evidenceBundle: Record<string, unknown>;
        narrativeBlock: Record<string, unknown>;
    }>;
    expectations: z.ZodObject<{
        minObjections: z.ZodNumber;
        maxObjections: z.ZodOptional<z.ZodNumber>;
        /** Whether this case should produce at least one critical objection */
        expectsCritical: z.ZodBoolean;
        requiredCategories: z.ZodOptional<z.ZodArray<z.ZodEnum<["assumption", "data_quality", "math_error", "missing_evidence", "logical_gap"]>, "many">>;
        /** Specific components that should be targeted */
        targetComponents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        minObjections: number;
        expectsCritical: boolean;
        requiredCategories?: ("assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap")[] | undefined;
        maxObjections?: number | undefined;
        targetComponents?: string[] | undefined;
    }, {
        minObjections: number;
        expectsCritical: boolean;
        requiredCategories?: ("assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap")[] | undefined;
        maxObjections?: number | undefined;
        targetComponents?: string[] | undefined;
    }>;
    mockResponse: z.ZodObject<{
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
    }, "strip", z.ZodTypeAny, {
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
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    input: {
        tenantId: string;
        idempotencyKey: string;
        valueCaseId: string;
        valueTree: Record<string, unknown>;
        evidenceBundle: Record<string, unknown>;
        narrativeBlock: Record<string, unknown>;
    };
    expectations: {
        minObjections: number;
        expectsCritical: boolean;
        requiredCategories?: ("assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap")[] | undefined;
        maxObjections?: number | undefined;
        targetComponents?: string[] | undefined;
    };
    mockResponse: {
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
    };
}, {
    id: string;
    name: string;
    input: {
        tenantId: string;
        idempotencyKey: string;
        valueCaseId: string;
        valueTree: Record<string, unknown>;
        evidenceBundle: Record<string, unknown>;
        narrativeBlock: Record<string, unknown>;
    };
    expectations: {
        minObjections: number;
        expectsCritical: boolean;
        requiredCategories?: ("assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap")[] | undefined;
        maxObjections?: number | undefined;
        targetComponents?: string[] | undefined;
    };
    mockResponse: {
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
    };
}>;
export type RedTeamEvalCase = z.infer<typeof RedTeamEvalCaseSchema>;
export declare const redTeamEvalCases: RedTeamEvalCase[];
//# sourceMappingURL=red-team-agent.d.ts.map