"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisKey = void 0;
exports.ns = ns;
/**
 * Small helper to enforce tenant namespaced redis keys.
 * Always call `ns(organizationId, key)` to avoid accidental cross-tenant keys.
 */
function ns(organizationId, key) {
    const org = (organizationId || 'public').toString();
    // Prevent unsafe keys
    const sanitized = key.replace(/^:+|:+$/g, '');
    return `${org}:${sanitized}`;
}
// Backwards-compatible helper name used by backend
exports.getRedisKey = ns;
exports.default = ns;
//# sourceMappingURL=redisKeys.js.map