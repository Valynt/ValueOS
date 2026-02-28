/**
 * Evaluation Dataset: Opportunity Agent
 *
 * Golden input/output pairs for validating the OpportunityAgent.
 * Each case defines a query, context, and the expected shape/constraints
 * of the response. Used for both deterministic mock testing and
 * LLM output quality evaluation.
 */
import { z } from 'zod';
export declare const OpportunityEvalCaseSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    input: z.ZodObject<{
        query: z.ZodString;
        context: z.ZodOptional<z.ZodObject<{
            organizationId: z.ZodOptional<z.ZodString>;
            userId: z.ZodOptional<z.ZodString>;
            sessionId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            userId?: string | undefined;
            sessionId?: string | undefined;
            organizationId?: string | undefined;
        }, {
            userId?: string | undefined;
            sessionId?: string | undefined;
            organizationId?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        context?: {
            userId?: string | undefined;
            sessionId?: string | undefined;
            organizationId?: string | undefined;
        } | undefined;
    }, {
        query: string;
        context?: {
            userId?: string | undefined;
            sessionId?: string | undefined;
            organizationId?: string | undefined;
        } | undefined;
    }>;
    /** Expected output constraints — not exact match, but structural/semantic validation */
    expectations: z.ZodObject<{
        minOpportunities: z.ZodNumber;
        maxOpportunities: z.ZodOptional<z.ZodNumber>;
        requiredCategories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        minConfidence: z.ZodOptional<z.ZodNumber>;
        mustMentionKeywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        analysisMinLength: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        minOpportunities: number;
        minConfidence?: number | undefined;
        maxOpportunities?: number | undefined;
        requiredCategories?: string[] | undefined;
        mustMentionKeywords?: string[] | undefined;
        analysisMinLength?: number | undefined;
    }, {
        minOpportunities: number;
        minConfidence?: number | undefined;
        maxOpportunities?: number | undefined;
        requiredCategories?: string[] | undefined;
        mustMentionKeywords?: string[] | undefined;
        analysisMinLength?: number | undefined;
    }>;
    /** Deterministic mock response for unit testing */
    mockResponse: z.ZodObject<{
        opportunities: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodString;
            confidence: z.ZodNumber;
            category: z.ZodString;
            estimatedValue: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            description: string;
            title: string;
            confidence: number;
            category: string;
            estimatedValue?: number | undefined;
        }, {
            description: string;
            title: string;
            confidence: number;
            category: string;
            estimatedValue?: number | undefined;
        }>, "many">;
        analysis: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        opportunities: {
            description: string;
            title: string;
            confidence: number;
            category: string;
            estimatedValue?: number | undefined;
        }[];
        analysis: string;
    }, {
        opportunities: {
            description: string;
            title: string;
            confidence: number;
            category: string;
            estimatedValue?: number | undefined;
        }[];
        analysis: string;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    input: {
        query: string;
        context?: {
            userId?: string | undefined;
            sessionId?: string | undefined;
            organizationId?: string | undefined;
        } | undefined;
    };
    expectations: {
        minOpportunities: number;
        minConfidence?: number | undefined;
        maxOpportunities?: number | undefined;
        requiredCategories?: string[] | undefined;
        mustMentionKeywords?: string[] | undefined;
        analysisMinLength?: number | undefined;
    };
    mockResponse: {
        opportunities: {
            description: string;
            title: string;
            confidence: number;
            category: string;
            estimatedValue?: number | undefined;
        }[];
        analysis: string;
    };
}, {
    id: string;
    name: string;
    input: {
        query: string;
        context?: {
            userId?: string | undefined;
            sessionId?: string | undefined;
            organizationId?: string | undefined;
        } | undefined;
    };
    expectations: {
        minOpportunities: number;
        minConfidence?: number | undefined;
        maxOpportunities?: number | undefined;
        requiredCategories?: string[] | undefined;
        mustMentionKeywords?: string[] | undefined;
        analysisMinLength?: number | undefined;
    };
    mockResponse: {
        opportunities: {
            description: string;
            title: string;
            confidence: number;
            category: string;
            estimatedValue?: number | undefined;
        }[];
        analysis: string;
    };
}>;
export type OpportunityEvalCase = z.infer<typeof OpportunityEvalCaseSchema>;
export declare const opportunityEvalCases: OpportunityEvalCase[];
//# sourceMappingURL=opportunity-agent.d.ts.map