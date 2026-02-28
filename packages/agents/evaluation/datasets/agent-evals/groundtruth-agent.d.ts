/**
 * Evaluation Dataset: Ground Truth Agent
 *
 * Golden input/output pairs for validating the GroundTruthAgent.
 * Tests evidence retrieval, source classification, and citation quality.
 */
import { z } from 'zod';
export declare const GroundtruthEvalCaseSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    input: z.ZodObject<{
        query: z.ZodString;
        context: z.ZodOptional<z.ZodObject<{
            organizationId: z.ZodOptional<z.ZodString>;
            userId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            userId?: string | undefined;
            organizationId?: string | undefined;
        }, {
            userId?: string | undefined;
            organizationId?: string | undefined;
        }>>;
        idempotencyKey: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        idempotencyKey?: string | undefined;
        context?: {
            userId?: string | undefined;
            organizationId?: string | undefined;
        } | undefined;
    }, {
        query: string;
        idempotencyKey?: string | undefined;
        context?: {
            userId?: string | undefined;
            organizationId?: string | undefined;
        } | undefined;
    }>;
    expectations: z.ZodObject<{
        minGroundtruths: z.ZodNumber;
        requiredCategories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** At least one item should have confidence >= this threshold */
        minTopConfidence: z.ZodOptional<z.ZodNumber>;
        mustMentionKeywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        minGroundtruths: number;
        requiredCategories?: string[] | undefined;
        mustMentionKeywords?: string[] | undefined;
        minTopConfidence?: number | undefined;
    }, {
        minGroundtruths: number;
        requiredCategories?: string[] | undefined;
        mustMentionKeywords?: string[] | undefined;
        minTopConfidence?: number | undefined;
    }>;
    mockResponse: z.ZodObject<{
        groundtruths: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodString;
            confidence: z.ZodNumber;
            category: z.ZodString;
            verification_type: z.ZodString;
            priority: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            verification_type: string;
        }, {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            verification_type: string;
        }>, "many">;
        analysis: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        analysis: string;
        groundtruths: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            verification_type: string;
        }[];
    }, {
        analysis: string;
        groundtruths: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            verification_type: string;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    input: {
        query: string;
        idempotencyKey?: string | undefined;
        context?: {
            userId?: string | undefined;
            organizationId?: string | undefined;
        } | undefined;
    };
    expectations: {
        minGroundtruths: number;
        requiredCategories?: string[] | undefined;
        mustMentionKeywords?: string[] | undefined;
        minTopConfidence?: number | undefined;
    };
    mockResponse: {
        analysis: string;
        groundtruths: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            verification_type: string;
        }[];
    };
}, {
    id: string;
    name: string;
    input: {
        query: string;
        idempotencyKey?: string | undefined;
        context?: {
            userId?: string | undefined;
            organizationId?: string | undefined;
        } | undefined;
    };
    expectations: {
        minGroundtruths: number;
        requiredCategories?: string[] | undefined;
        mustMentionKeywords?: string[] | undefined;
        minTopConfidence?: number | undefined;
    };
    mockResponse: {
        analysis: string;
        groundtruths: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            verification_type: string;
        }[];
    };
}>;
export type GroundtruthEvalCase = z.infer<typeof GroundtruthEvalCaseSchema>;
export declare const groundtruthEvalCases: GroundtruthEvalCase[];
//# sourceMappingURL=groundtruth-agent.d.ts.map