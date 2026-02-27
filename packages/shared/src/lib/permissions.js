"use strict";
/**
 * Permission Constants and Utilities
 *
 * Re-exports from the permissions/ directory for convenience.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRolesWithPermission = exports.normalizeRole = exports.isValidAgentRole = exports.isValidUserRole = exports.computePermissionsFromRoles = exports.getPermissionsForAgentRole = exports.getPermissionsForUserRole = exports.LEGACY_ROLE_MAP = exports.AGENT_ROLE_PERMISSIONS = exports.USER_ROLE_PERMISSIONS = exports.AGENT_ROLES = exports.isValidPermission = exports.expandWildcard = exports.matchesPermission = exports.createPermission = exports.parsePermission = exports.hasAnyPermission = exports.hasAllPermissions = exports.hasPermission = exports.ACTIONS = exports.RESOURCES = exports.PERMISSIONS = void 0;
// Re-export everything from the unified permissions module
var index_1 = require("./permissions/index");
// Constants
Object.defineProperty(exports, "PERMISSIONS", { enumerable: true, get: function () { return index_1.PERMISSIONS; } });
Object.defineProperty(exports, "RESOURCES", { enumerable: true, get: function () { return index_1.RESOURCES; } });
Object.defineProperty(exports, "ACTIONS", { enumerable: true, get: function () { return index_1.ACTIONS; } });
// Permission utilities
Object.defineProperty(exports, "hasPermission", { enumerable: true, get: function () { return index_1.hasPermission; } });
Object.defineProperty(exports, "hasAllPermissions", { enumerable: true, get: function () { return index_1.hasAllPermissions; } });
Object.defineProperty(exports, "hasAnyPermission", { enumerable: true, get: function () { return index_1.hasAnyPermission; } });
Object.defineProperty(exports, "parsePermission", { enumerable: true, get: function () { return index_1.parsePermission; } });
Object.defineProperty(exports, "createPermission", { enumerable: true, get: function () { return index_1.createPermission; } });
Object.defineProperty(exports, "matchesPermission", { enumerable: true, get: function () { return index_1.matchesPermission; } });
Object.defineProperty(exports, "expandWildcard", { enumerable: true, get: function () { return index_1.expandWildcard; } });
Object.defineProperty(exports, "isValidPermission", { enumerable: true, get: function () { return index_1.isValidPermission; } });
Object.defineProperty(exports, "AGENT_ROLES", { enumerable: true, get: function () { return index_1.AGENT_ROLES; } });
Object.defineProperty(exports, "USER_ROLE_PERMISSIONS", { enumerable: true, get: function () { return index_1.USER_ROLE_PERMISSIONS; } });
Object.defineProperty(exports, "AGENT_ROLE_PERMISSIONS", { enumerable: true, get: function () { return index_1.AGENT_ROLE_PERMISSIONS; } });
Object.defineProperty(exports, "LEGACY_ROLE_MAP", { enumerable: true, get: function () { return index_1.LEGACY_ROLE_MAP; } });
// Role utilities
Object.defineProperty(exports, "getPermissionsForUserRole", { enumerable: true, get: function () { return index_1.getPermissionsForUserRole; } });
Object.defineProperty(exports, "getPermissionsForAgentRole", { enumerable: true, get: function () { return index_1.getPermissionsForAgentRole; } });
Object.defineProperty(exports, "computePermissionsFromRoles", { enumerable: true, get: function () { return index_1.computePermissionsFromRoles; } });
Object.defineProperty(exports, "isValidUserRole", { enumerable: true, get: function () { return index_1.isValidUserRole; } });
Object.defineProperty(exports, "isValidAgentRole", { enumerable: true, get: function () { return index_1.isValidAgentRole; } });
Object.defineProperty(exports, "normalizeRole", { enumerable: true, get: function () { return index_1.normalizeRole; } });
Object.defineProperty(exports, "getRolesWithPermission", { enumerable: true, get: function () { return index_1.getRolesWithPermission; } });
//# sourceMappingURL=permissions.js.map