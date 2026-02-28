/**
 * API validation schemas
 */
import { z } from "zod";
export const APIErrorSchema = z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
});
export const APIMetaSchema = z.object({
    requestId: z.string(),
    timestamp: z.string(),
    duration: z.number().optional(),
});
export const APIResponseSchema = (dataSchema) => z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: APIErrorSchema.optional(),
    meta: APIMetaSchema.optional(),
});
export const PaginationSchema = z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
    hasMore: z.boolean(),
});
//# sourceMappingURL=api.js.map