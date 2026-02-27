"use strict";
/**
 * Permission Types and Constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSIONS = exports.ACTIONS = exports.RESOURCES = void 0;
exports.parsePermission = parsePermission;
exports.createPermission = createPermission;
exports.matchesPermission = matchesPermission;
exports.expandWildcard = expandWildcard;
exports.isValidPermission = isValidPermission;
exports.hasPermission = hasPermission;
exports.hasAllPermissions = hasAllPermissions;
exports.hasAnyPermission = hasAnyPermission;
exports.RESOURCES = {
    DASHBOARD: "dashboard",
    PROJECTS: "projects",
    TEAM: "team",
    SETTINGS: "settings",
    BILLING: "billing",
    ADMIN: "admin",
    USERS: "users",
    API_KEYS: "api_keys",
    INTEGRATIONS: "integrations",
    VALUE_TREES: "value_trees",
    COMMITMENTS: "commitments",
    AGENTS: "agents",
};
exports.ACTIONS = {
    VIEW: "view",
    CREATE: "create",
    EDIT: "edit",
    DELETE: "delete",
    MANAGE: "manage",
    INVITE: "invite",
    EXECUTE: "execute",
    ALL: "*",
};
exports.PERMISSIONS = {
    DASHBOARD_VIEW: "dashboard:view",
    PROJECTS_VIEW: "projects:view",
    PROJECTS_CREATE: "projects:create",
    PROJECTS_EDIT: "projects:edit",
    PROJECTS_DELETE: "projects:delete",
    TEAM_VIEW: "team:view",
    TEAM_INVITE: "team:invite",
    TEAM_MANAGE: "team:manage",
    SETTINGS_VIEW: "settings:view",
    SETTINGS_EDIT: "settings:edit",
    BILLING_VIEW: "billing:view",
    BILLING_MANAGE: "billing:manage",
    USERS_VIEW: "users:view",
    USERS_CREATE: "users:create",
    USERS_EDIT: "users:edit",
    USERS_DELETE: "users:delete",
    API_KEYS_VIEW: "api_keys:view",
    API_KEYS_CREATE: "api_keys:create",
    API_KEYS_DELETE: "api_keys:delete",
    INTEGRATIONS_VIEW: "integrations:view",
    INTEGRATIONS_MANAGE: "integrations:manage",
    ADMIN_ACCESS: "admin:view",
    ADMIN_MANAGE: "admin:manage",
    VALUE_TREES_VIEW: "value_trees:view",
    VALUE_TREES_CREATE: "value_trees:create",
    VALUE_TREES_EDIT: "value_trees:edit",
    VALUE_TREES_DELETE: "value_trees:delete",
    COMMITMENTS_VIEW: "commitments:view",
    COMMITMENTS_CREATE: "commitments:create",
    COMMITMENTS_EDIT: "commitments:edit",
    AGENTS_VIEW: "agents:view",
    AGENTS_CREATE: "agents:create",
    AGENTS_EXECUTE: "agents:execute",
};
function parsePermission(permission) {
    const parts = permission.split(":");
    if (parts.length !== 2 || !parts[0] || !parts[1])
        return null;
    return { resource: parts[0], action: parts[1] };
}
function createPermission(resource, action) {
    return `${resource}:${action}`;
}
function matchesPermission(granted, required) {
    if (granted === required)
        return true;
    const grantedParts = parsePermission(granted);
    const requiredParts = parsePermission(required);
    if (!grantedParts || !requiredParts)
        return false;
    if (grantedParts.resource !== requiredParts.resource && grantedParts.resource !== "*") {
        return false;
    }
    if (grantedParts.action === "*")
        return true;
    return grantedParts.action === requiredParts.action;
}
function expandWildcard(permission) {
    const parsed = parsePermission(permission);
    if (!parsed)
        return [permission];
    if (parsed.action === "*") {
        return Object.values(exports.ACTIONS)
            .filter(a => a !== "*")
            .map(a => createPermission(parsed.resource, a));
    }
    return [permission];
}
function isValidPermission(permission) {
    const parsed = parsePermission(permission);
    if (!parsed)
        return false;
    return true;
}
function hasPermission(userPermissions, required) {
    if (!userPermissions?.length)
        return false;
    return userPermissions.some((granted) => matchesPermission(granted, required));
}
function hasAllPermissions(userPermissions, required) {
    if (!userPermissions?.length)
        return false;
    if (!required.length)
        return true;
    return required.every((r) => hasPermission(userPermissions, r));
}
function hasAnyPermission(userPermissions, required) {
    if (!userPermissions?.length)
        return false;
    if (!required.length)
        return true;
    return required.some((r) => hasPermission(userPermissions, r));
}
//# sourceMappingURL=types.js.map