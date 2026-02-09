/**
 * Role Types and Constants
 */
import { PERMISSIONS } from "./types";
export const USER_ROLES = {
    ADMIN: "admin",
    MEMBER: "member",
    VIEWER: "viewer",
};
export const AGENT_ROLES = {
    ORCHESTRATOR: "orchestrator",
    EXECUTOR: "executor",
    OBSERVER: "observer",
};
export const USER_ROLE_PERMISSIONS = {
    [USER_ROLES.ADMIN]: Object.values(PERMISSIONS),
    [USER_ROLES.MEMBER]: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.PROJECTS_VIEW,
        PERMISSIONS.PROJECTS_CREATE,
        PERMISSIONS.PROJECTS_EDIT,
        PERMISSIONS.TEAM_VIEW,
        PERMISSIONS.SETTINGS_VIEW,
        PERMISSIONS.BILLING_VIEW,
        PERMISSIONS.USERS_VIEW,
        PERMISSIONS.INTEGRATIONS_VIEW,
        PERMISSIONS.VALUE_TREES_VIEW,
        PERMISSIONS.VALUE_TREES_CREATE,
        PERMISSIONS.VALUE_TREES_EDIT,
        PERMISSIONS.COMMITMENTS_VIEW,
        PERMISSIONS.COMMITMENTS_CREATE,
        PERMISSIONS.AGENTS_VIEW,
    ],
    [USER_ROLES.VIEWER]: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.PROJECTS_VIEW,
        PERMISSIONS.TEAM_VIEW,
        PERMISSIONS.SETTINGS_VIEW,
        PERMISSIONS.INTEGRATIONS_VIEW,
        PERMISSIONS.VALUE_TREES_VIEW,
        PERMISSIONS.COMMITMENTS_VIEW,
    ],
};
export const AGENT_ROLE_PERMISSIONS = {
    [AGENT_ROLES.ORCHESTRATOR]: Object.values(PERMISSIONS),
    [AGENT_ROLES.EXECUTOR]: [
        PERMISSIONS.VALUE_TREES_VIEW,
        PERMISSIONS.VALUE_TREES_EDIT,
        PERMISSIONS.COMMITMENTS_VIEW,
        PERMISSIONS.COMMITMENTS_CREATE,
        PERMISSIONS.COMMITMENTS_EDIT,
        PERMISSIONS.AGENTS_EXECUTE,
    ],
    [AGENT_ROLES.OBSERVER]: [
        PERMISSIONS.VALUE_TREES_VIEW,
        PERMISSIONS.COMMITMENTS_VIEW,
        PERMISSIONS.AGENTS_VIEW,
    ],
};
export const LEGACY_ROLE_MAP = {
    owner: USER_ROLES.ADMIN,
    editor: USER_ROLES.MEMBER,
    reader: USER_ROLES.VIEWER,
};
export function getPermissionsForUserRole(role) {
    return USER_ROLE_PERMISSIONS[role] || [];
}
export function getPermissionsForAgentRole(role) {
    return AGENT_ROLE_PERMISSIONS[role] || [];
}
export function computePermissionsFromRoles(userRoles, agentRoles = []) {
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
export function isValidUserRole(role) {
    return Object.values(USER_ROLES).includes(role);
}
export function isValidAgentRole(role) {
    return Object.values(AGENT_ROLES).includes(role);
}
export function normalizeRole(role) {
    if (isValidUserRole(role))
        return role;
    return LEGACY_ROLE_MAP[role] || null;
}
export function getRolesWithPermission(permission) {
    return Object.entries(USER_ROLE_PERMISSIONS)
        .filter(([, perms]) => perms.includes(permission))
        .map(([role]) => role);
}
//# sourceMappingURL=roles.js.map