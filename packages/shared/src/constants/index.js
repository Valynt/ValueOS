"use strict";
/**
 * Shared constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTP_STATUS = exports.USER_ROLES = exports.PLAN_TIERS = exports.API_VERSION = void 0;
exports.API_VERSION = "v1";
exports.PLAN_TIERS = ["free", "standard", "enterprise"];
exports.USER_ROLES = ["admin", "member", "viewer"];
exports.HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
};
//# sourceMappingURL=index.js.map