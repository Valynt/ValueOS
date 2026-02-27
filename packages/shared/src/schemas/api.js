"use strict";
/**
 * API validation schemas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationSchema = exports.APIResponseSchema = exports.APIMetaSchema = exports.APIErrorSchema = void 0;
const zod_1 = require("zod");
exports.APIErrorSchema = zod_1.z.object({
    code: zod_1.z.string(),
    message: zod_1.z.string(),
    details: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.APIMetaSchema = zod_1.z.object({
    requestId: zod_1.z.string(),
    timestamp: zod_1.z.string(),
    duration: zod_1.z.number().optional(),
});
const APIResponseSchema = (dataSchema) => zod_1.z.object({
    success: zod_1.z.boolean(),
    data: dataSchema.optional(),
    error: exports.APIErrorSchema.optional(),
    meta: exports.APIMetaSchema.optional(),
});
exports.APIResponseSchema = APIResponseSchema;
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.number().int().positive(),
    pageSize: zod_1.z.number().int().positive().max(100),
    total: zod_1.z.number().int().nonnegative(),
    hasMore: zod_1.z.boolean(),
});
//# sourceMappingURL=api.js.map