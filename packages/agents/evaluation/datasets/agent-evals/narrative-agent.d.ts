/**
 * Evaluation Dataset: Narrative Agent
 *
 * Golden input/output pairs for validating the NarrativeAgent.
 * Tests executive summary generation, section structure, and
 * claim-to-citation linkage.
 */
import { z } from 'zod';
export declare const NarrativeEvalCaseSchema: z.ZodObject<{
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
        minNarratives: z.ZodNumber;
        /** Executive summary / analysis must be at least this long */
        analysisMinLength: z.ZodNumber;
        mustMentionKeywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Each narrative should reference specific dollar amounts */
        requiresDollarAmounts: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        analysisMinLength: number;
        minNarratives: number;
        mustMentionKeywords?: string[] | undefined;
        requiresDollarAmounts?: boolean | undefined;
    }, {
        analysisMinLength: number;
        minNarratives: number;
        mustMentionKeywords?: string[] | undefined;
        requiresDollarAmounts?: boolean | undefined;
    }>;
    mockResponse: z.ZodObject<{
        narratives: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodString;
            confidence: z.ZodNumber;
            category: z.ZodString;
            narrative_type: z.ZodString;
            priority: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            narrative_type: string;
        }, {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            narrative_type: string;
        }>, "many">;
        analysis: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        analysis: string;
        narratives: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            narrative_type: string;
        }[];
    }, {
        analysis: string;
        narratives: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            narrative_type: string;
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
        analysisMinLength: number;
        minNarratives: number;
        mustMentionKeywords?: string[] | undefined;
        requiresDollarAmounts?: boolean | undefined;
    };
    mockResponse: {
        analysis: string;
        narratives: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            narrative_type: string;
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
        analysisMinLength: number;
        minNarratives: number;
        mustMentionKeywords?: string[] | undefined;
        requiresDollarAmounts?: boolean | undefined;
    };
    mockResponse: {
        analysis: string;
        narratives: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            narrative_type: string;
        }[];
    };
}>;
export type NarrativeEvalCase = z.infer<typeof NarrativeEvalCaseSchema>;
export declare const narrativeEvalCases: NarrativeEvalCase[];
//# sourceMappingURL=narrative-agent.d.ts.map