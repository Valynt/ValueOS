/**
 * API validation schemas
 */
import { z } from "zod";
export declare const APIErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    code: string;
    details?: Record<string, unknown> | undefined;
}, {
    message: string;
    code: string;
    details?: Record<string, unknown> | undefined;
}>;
export declare const APIMetaSchema: z.ZodObject<{
    requestId: z.ZodString;
    timestamp: z.ZodString;
    duration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    requestId: string;
    duration?: number | undefined;
}, {
    timestamp: string;
    requestId: string;
    duration?: number | undefined;
}>;
export declare const APIResponseSchema: <T extends z.ZodTypeAny>(dataSchema: T) => z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        code: string;
        details?: Record<string, unknown> | undefined;
    }, {
        message: string;
        code: string;
        details?: Record<string, unknown> | undefined;
    }>>;
    meta: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        timestamp: z.ZodString;
        duration: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        requestId: string;
        duration?: number | undefined;
    }, {
        timestamp: string;
        requestId: string;
        duration?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        code: string;
        details?: Record<string, unknown> | undefined;
    }, {
        message: string;
        code: string;
        details?: Record<string, unknown> | undefined;
    }>>;
    meta: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        timestamp: z.ZodString;
        duration: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        requestId: string;
        duration?: number | undefined;
    }, {
        timestamp: string;
        requestId: string;
        duration?: number | undefined;
    }>>;
}>, any> extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.baseObjectInputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        code: string;
        details?: Record<string, unknown> | undefined;
    }, {
        message: string;
        code: string;
        details?: Record<string, unknown> | undefined;
    }>>;
    meta: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        timestamp: z.ZodString;
        duration: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        requestId: string;
        duration?: number | undefined;
    }, {
        timestamp: string;
        requestId: string;
        duration?: number | undefined;
    }>>;
}> extends infer T_2 ? { [k_1 in keyof T_2]: T_2[k_1]; } : never>;
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
    total: z.ZodNumber;
    hasMore: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}, {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}>;
//# sourceMappingURL=api.d.ts.map