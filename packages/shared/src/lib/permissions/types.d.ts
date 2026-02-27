/**
 * Permission Types and Constants
 */
export declare const RESOURCES: {
    readonly DASHBOARD: "dashboard";
    readonly PROJECTS: "projects";
    readonly TEAM: "team";
    readonly SETTINGS: "settings";
    readonly BILLING: "billing";
    readonly ADMIN: "admin";
    readonly USERS: "users";
    readonly API_KEYS: "api_keys";
    readonly INTEGRATIONS: "integrations";
    readonly VALUE_TREES: "value_trees";
    readonly COMMITMENTS: "commitments";
    readonly AGENTS: "agents";
};
export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];
export declare const ACTIONS: {
    readonly VIEW: "view";
    readonly CREATE: "create";
    readonly EDIT: "edit";
    readonly DELETE: "delete";
    readonly MANAGE: "manage";
    readonly INVITE: "invite";
    readonly EXECUTE: "execute";
    readonly ALL: "*";
};
export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];
export type Permission = `${Resource}:${Action}` | `${string}:${string}` | `${string}.${string}`;
export declare const PERMISSIONS: {
    readonly DASHBOARD_VIEW: Permission;
    readonly PROJECTS_VIEW: Permission;
    readonly PROJECTS_CREATE: Permission;
    readonly PROJECTS_EDIT: Permission;
    readonly PROJECTS_DELETE: Permission;
    readonly TEAM_VIEW: Permission;
    readonly TEAM_INVITE: Permission;
    readonly TEAM_MANAGE: Permission;
    readonly SETTINGS_VIEW: Permission;
    readonly SETTINGS_EDIT: Permission;
    readonly BILLING_VIEW: Permission;
    readonly BILLING_MANAGE: Permission;
    readonly USERS_VIEW: Permission;
    readonly USERS_CREATE: Permission;
    readonly USERS_EDIT: Permission;
    readonly USERS_DELETE: Permission;
    readonly API_KEYS_VIEW: Permission;
    readonly API_KEYS_CREATE: Permission;
    readonly API_KEYS_DELETE: Permission;
    readonly INTEGRATIONS_VIEW: Permission;
    readonly INTEGRATIONS_MANAGE: Permission;
    readonly ADMIN_ACCESS: Permission;
    readonly ADMIN_MANAGE: Permission;
    readonly VALUE_TREES_VIEW: Permission;
    readonly VALUE_TREES_CREATE: Permission;
    readonly VALUE_TREES_EDIT: Permission;
    readonly VALUE_TREES_DELETE: Permission;
    readonly COMMITMENTS_VIEW: Permission;
    readonly COMMITMENTS_CREATE: Permission;
    readonly COMMITMENTS_EDIT: Permission;
    readonly AGENTS_VIEW: Permission;
    readonly AGENTS_CREATE: Permission;
    readonly AGENTS_EXECUTE: Permission;
};
export declare function parsePermission(permission: string): {
    resource: string;
    action: string;
} | null;
export declare function createPermission(resource: string, action: string): Permission;
export declare function matchesPermission(granted: string, required: string): boolean;
export declare function expandWildcard(permission: Permission): Permission[];
export declare function isValidPermission(permission: string): permission is Permission;
export declare function hasPermission(userPermissions: string[] | undefined, required: Permission): boolean;
export declare function hasAllPermissions(userPermissions: string[] | undefined, required: Permission[]): boolean;
export declare function hasAnyPermission(userPermissions: string[] | undefined, required: Permission[]): boolean;
//# sourceMappingURL=types.d.ts.map