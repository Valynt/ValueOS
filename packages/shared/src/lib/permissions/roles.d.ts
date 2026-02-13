/**
 * Role Types and Constants
 */
import { Permission } from "./types";
export declare const USER_ROLES: {
    readonly ADMIN: "admin";
    readonly MEMBER: "member";
    readonly VIEWER: "viewer";
};
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export declare const AGENT_ROLES: {
    readonly ORCHESTRATOR: "orchestrator";
    readonly EXECUTOR: "executor";
    readonly OBSERVER: "observer";
};
export type AgentRole = (typeof AGENT_ROLES)[keyof typeof AGENT_ROLES];
export declare const USER_ROLE_PERMISSIONS: Record<UserRole, Permission[]>;
export declare const AGENT_ROLE_PERMISSIONS: Record<AgentRole, Permission[]>;
export declare const LEGACY_ROLE_MAP: Record<string, UserRole>;
export declare function getPermissionsForUserRole(role: string): Permission[];
export declare function getPermissionsForAgentRole(role: string): Permission[];
export declare function computePermissionsFromRoles(userRoles: string[], agentRoles?: string[]): Permission[];
export declare function isValidUserRole(role: string): role is UserRole;
export declare function isValidAgentRole(role: string): role is AgentRole;
export declare function normalizeRole(role: string): UserRole | null;
export declare function getRolesWithPermission(permission: Permission): UserRole[];
//# sourceMappingURL=roles.d.ts.map