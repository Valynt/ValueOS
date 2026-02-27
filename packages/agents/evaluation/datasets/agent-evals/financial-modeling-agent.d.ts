/**
 * Evaluation Dataset: Financial Modeling Agent
 *
 * Golden input/output pairs for validating the FinancialModelingAgent.
 * Tests value tree construction from hypotheses, formula correctness,
 * and confidence score assignment.
 */
import { z } from 'zod';
export declare const FinancialModelingEvalCaseSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    input: z.ZodObject<{
        query: z.ZodString;
        context: z.ZodOptional<z.ZodObject<{
            organizationId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            organizationId?: string | undefined;
        }, {
            organizationId?: string | undefined;
        }>>;
        idempotencyKey: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        idempotencyKey?: string | undefined;
        context?: {
            organizationId?: string | undefined;
        } | undefined;
    }, {
        query: string;
        idempotencyKey?: string | undefined;
        context?: {
            organizationId?: string | undefined;
        } | undefined;
    }>;
    expectations: z.ZodObject<{
        minModels: z.ZodNumber;
        /** Every model must have a parseable formula or description */
        requiresFormula: z.ZodBoolean;
        minConfidence: z.ZodOptional<z.ZodNumber>;
        mustMentionKeywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Total value should be within this range */
        totalValueRange: z.ZodOptional<z.ZodObject<{
            min: z.ZodNumber;
            max: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            max: number;
            min: number;
        }, {
            max: number;
            min: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        minModels: number;
        requiresFormula: boolean;
        minConfidence?: number | undefined;
        mustMentionKeywords?: string[] | undefined;
        totalValueRange?: {
            max: number;
            min: number;
        } | undefined;
    }, {
        minModels: number;
        requiresFormula: boolean;
        minConfidence?: number | undefined;
        mustMentionKeywords?: string[] | undefined;
        totalValueRange?: {
            max: number;
            min: number;
        } | undefined;
    }>;
    mockResponse: z.ZodObject<{
        financial_models: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodString;
            confidence: z.ZodNumber;
            category: z.ZodString;
            model_type: z.ZodString;
            priority: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            model_type: string;
        }, {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            model_type: string;
        }>, "many">;
        analysis: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        analysis: string;
        financial_models: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            model_type: string;
        }[];
    }, {
        analysis: string;
        financial_models: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            model_type: string;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    input: {
        query: string;
        idempotencyKey?: string | undefined;
        context?: {
            organizationId?: string | undefined;
        } | undefined;
    };
    expectations: {
        minModels: number;
        requiresFormula: boolean;
        minConfidence?: number | undefined;
        mustMentionKeywords?: string[] | undefined;
        totalValueRange?: {
            max: number;
            min: number;
        } | undefined;
    };
    mockResponse: {
        analysis: string;
        financial_models: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            model_type: string;
        }[];
    };
}, {
    id: string;
    name: string;
    input: {
        query: string;
        idempotencyKey?: string | undefined;
        context?: {
            organizationId?: string | undefined;
        } | undefined;
    };
    expectations: {
        minModels: number;
        requiresFormula: boolean;
        minConfidence?: number | undefined;
        mustMentionKeywords?: string[] | undefined;
        totalValueRange?: {
            max: number;
            min: number;
        } | undefined;
    };
    mockResponse: {
        analysis: string;
        financial_models: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            model_type: string;
        }[];
    };
}>;
export type FinancialModelingEvalCase = z.infer<typeof FinancialModelingEvalCaseSchema>;
export declare const financialModelingEvalCases: FinancialModelingEvalCase[];
//# sourceMappingURL=financial-modeling-agent.d.ts.map