"use strict";
/**
 * Unified Permissions Module
 *
 * All permission types, constants, and utilities are exported from here.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRolesWithPermission = exports.normalizeRole = exports.isValidAgentRole = exports.isValidUserRole = exports.computePermissionsFromRoles = exports.getPermissionsForAgentRole = exports.getPermissionsForUserRole = exports.LEGACY_ROLE_MAP = exports.AGENT_ROLE_PERMISSIONS = exports.USER_ROLE_PERMISSIONS = exports.AGENT_ROLES = exports.isValidPermission = exports.expandWildcard = exports.matchesPermission = exports.createPermission = exports.parsePermission = exports.hasAnyPermission = exports.hasAllPermissions = exports.hasPermission = exports.ACTIONS = exports.RESOURCES = exports.PERMISSIONS = void 0;
var types_1 = require("./types");
// Constants
Object.defineProperty(exports, "PERMISSIONS", { enumerable: true, get: function () { return types_1.PERMISSIONS; } });
Object.defineProperty(exports, "RESOURCES", { enumerable: true, get: function () { return types_1.RESOURCES; } });
Object.defineProperty(exports, "ACTIONS", { enumerable: true, get: function () { return types_1.ACTIONS; } });
// Permission utilities
Object.defineProperty(exports, "hasPermission", { enumerable: true, get: function () { return types_1.hasPermission; } });
Object.defineProperty(exports, "hasAllPermissions", { enumerable: true, get: function () { return types_1.hasAllPermissions; } });
Object.defineProperty(exports, "hasAnyPermission", { enumerable: true, get: function () { return types_1.hasAnyPermission; } });
Object.defineProperty(exports, "parsePermission", { enumerable: true, get: function () { return types_1.parsePermission; } });
Object.defineProperty(exports, "createPermission", { enumerable: true, get: function () { return types_1.createPermission; } });
Object.defineProperty(exports, "matchesPermission", { enumerable: true, get: function () { return types_1.matchesPermission; } });
Object.defineProperty(exports, "expandWildcard", { enumerable: true, get: function () { return types_1.expandWildcard; } });
Object.defineProperty(exports, "isValidPermission", { enumerable: true, get: function () { return types_1.isValidPermission; } });
var roles_1 = require("./roles");
// Role constants (USER_ROLES is exported from constants/index.ts to avoid duplication)
Object.defineProperty(exports, "AGENT_ROLES", { enumerable: true, get: function () { return roles_1.AGENT_ROLES; } });
Object.defineProperty(exports, "USER_ROLE_PERMISSIONS", { enumerable: true, get: function () { return roles_1.USER_ROLE_PERMISSIONS; } });
Object.defineProperty(exports, "AGENT_ROLE_PERMISSIONS", { enumerable: true, get: function () { return roles_1.AGENT_ROLE_PERMISSIONS; } });
Object.defineProperty(exports, "LEGACY_ROLE_MAP", { enumerable: true, get: function () { return roles_1.LEGACY_ROLE_MAP; } });
// Role utilities
Object.defineProperty(exports, "getPermissionsForUserRole", { enumerable: true, get: function () { return roles_1.getPermissionsForUserRole; } });
Object.defineProperty(exports, "getPermissionsForAgentRole", { enumerable: true, get: function () { return roles_1.getPermissionsForAgentRole; } });
Object.defineProperty(exports, "computePermissionsFromRoles", { enumerable: true, get: function () { return roles_1.computePermissionsFromRoles; } });
Object.defineProperty(exports, "isValidUserRole", { enumerable: true, get: function () { return roles_1.isValidUserRole; } });
Object.defineProperty(exports, "isValidAgentRole", { enumerable: true, get: function () { return roles_1.isValidAgentRole; } });
Object.defineProperty(exports, "normalizeRole", { enumerable: true, get: function () { return roles_1.normalizeRole; } });
Object.defineProperty(exports, "getRolesWithPermission", { enumerable: true, get: function () { return roles_1.getRolesWithPermission; } });
//# sourceMappingURL=index.js.map