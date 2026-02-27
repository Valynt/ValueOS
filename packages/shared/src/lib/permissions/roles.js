"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_ROLE_MAP = exports.AGENT_ROLE_PERMISSIONS = exports.USER_ROLE_PERMISSIONS = exports.AGENT_ROLES = exports.USER_ROLES = void 0;
exports.getPermissionsForUserRole = getPermissionsForUserRole;
exports.getPermissionsForAgentRole = getPermissionsForAgentRole;
exports.computePermissionsFromRoles = computePermissionsFromRoles;
exports.isValidUserRole = isValidUserRole;
exports.isValidAgentRole = isValidAgentRole;
exports.normalizeRole = normalizeRole;
exports.getRolesWithPermission = getRolesWithPermission;
/**
 * Role Types and Constants
 */
const types_1 = require("./types");
exports.USER_ROLES = {
    ADMIN: "admin",
    MEMBER: "member",
    VIEWER: "viewer",
};
exports.AGENT_ROLES = {
    ORCHESTRATOR: "orchestrator",
    EXECUTOR: "executor",
    OBSERVER: "observer",
};
exports.USER_ROLE_PERMISSIONS = {
    [exports.USER_ROLES.ADMIN]: Object.values(types_1.PERMISSIONS),
    [exports.USER_ROLES.MEMBER]: [
        types_1.PERMISSIONS.DASHBOARD_VIEW,
        types_1.PERMISSIONS.PROJECTS_VIEW,
        types_1.PERMISSIONS.PROJECTS_CREATE,
        types_1.PERMISSIONS.PROJECTS_EDIT,
        types_1.PERMISSIONS.TEAM_VIEW,
        types_1.PERMISSIONS.SETTINGS_VIEW,
        types_1.PERMISSIONS.BILLING_VIEW,
        types_1.PERMISSIONS.USERS_VIEW,
        types_1.PERMISSIONS.INTEGRATIONS_VIEW,
        types_1.PERMISSIONS.VALUE_TREES_VIEW,
        types_1.PERMISSIONS.VALUE_TREES_CREATE,
        types_1.PERMISSIONS.VALUE_TREES_EDIT,
        types_1.PERMISSIONS.COMMITMENTS_VIEW,
        types_1.PERMISSIONS.COMMITMENTS_CREATE,
        types_1.PERMISSIONS.AGENTS_VIEW,
    ],
    [exports.USER_ROLES.VIEWER]: [
        types_1.PERMISSIONS.DASHBOARD_VIEW,
        types_1.PERMISSIONS.PROJECTS_VIEW,
        types_1.PERMISSIONS.TEAM_VIEW,
        types_1.PERMISSIONS.SETTINGS_VIEW,
        types_1.PERMISSIONS.INTEGRATIONS_VIEW,
        types_1.PERMISSIONS.VALUE_TREES_VIEW,
        types_1.PERMISSIONS.COMMITMENTS_VIEW,
    ],
};
exports.AGENT_ROLE_PERMISSIONS = {
    [exports.AGENT_ROLES.ORCHESTRATOR]: Object.values(types_1.PERMISSIONS),
    [exports.AGENT_ROLES.EXECUTOR]: [
        types_1.PERMISSIONS.VALUE_TREES_VIEW,
        types_1.PERMISSIONS.VALUE_TREES_EDIT,
        types_1.PERMISSIONS.COMMITMENTS_VIEW,
        types_1.PERMISSIONS.COMMITMENTS_CREATE,
        types_1.PERMISSIONS.COMMITMENTS_EDIT,
        types_1.PERMISSIONS.AGENTS_EXECUTE,
    ],
    [exports.AGENT_ROLES.OBSERVER]: [
        types_1.PERMISSIONS.VALUE_TREES_VIEW,
        types_1.PERMISSIONS.COMMITMENTS_VIEW,
        types_1.PERMISSIONS.AGENTS_VIEW,
    ],
};
exports.LEGACY_ROLE_MAP = {
    owner: exports.USER_ROLES.ADMIN,
    editor: exports.USER_ROLES.MEMBER,
    reader: exports.USER_ROLES.VIEWER,
};
function getPermissionsForUserRole(role) {
    return exports.USER_ROLE_PERMISSIONS[role] || [];
}
function getPermissionsForAgentRole(role) {
    return exports.AGENT_ROLE_PERMISSIONS[role] || [];
}
function computePermissionsFromRoles(userRoles, agentRoles = []) {
    const permissions = new Set();
    for (const role of userRoles) {
        for (const perm of getPermissionsForUserRole(role)) {
            permissions.add(perm);
        }
    }
    for (const role of agentRoles) {
        for (const perm of getPermissionsForAgentRole(role)) {
            permissions.add(perm);
        }
    }
    return Array.from(permissions);
}
function isValidUserRole(role) {
    return Object.values(exports.USER_ROLES).includes(role);
}
function isValidAgentRole(role) {
    return Object.values(exports.AGENT_ROLES).includes(role);
}
function normalizeRole(role) {
    if (isValidUserRole(role))
        return role;
    return exports.LEGACY_ROLE_MAP[role] || null;
}
function getRolesWithPermission(permission) {
    return Object.entries(exports.USER_ROLE_PERMISSIONS)
        .filter(([, perms]) => perms.includes(permission))
        .map(([role]) => role);
}
//# sourceMappingURL=roles.js.map