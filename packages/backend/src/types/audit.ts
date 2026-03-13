/**
 * Audit log types matching the audit_logs table schema.
 * Column names are snake_case to match Supabase row returns.
 */

export const AUDIT_ACTION = {
  AUTH_LOGOUT: "auth.logout",
  DATA_CREATE: "data.create",
  DATA_READ: "data.read",
  DATA_UPDATE: "data.update",
  DATA_DELETE: "data.delete",
  RBAC_PERMISSION_GRANT: "rbac.permission_grant",
  RBAC_PERMISSION_REVOKE: "rbac.permission_revoke",
  RBAC_ROLE_ASSIGN: "rbac.role_assign",
  RBAC_ROLE_REMOVE: "rbac.role_remove",
  ADMIN_PROVISION: "admin.provision",
  ADMIN_DEPROVISION: "admin.deprovision",
  ADMIN_SUSPEND: "admin.suspend",
  ADMIN_REACTIVATE: "admin.reactivate",
  ADMIN_SETTINGS_UPDATE: "admin.settings_update",
  ADMIN_EXPORT: "admin.export",
  ADMIN_SECURITY: "admin.security",
  ADMIN_COMPLIANCE: "admin.compliance",
  API_REQUEST: "api.request",
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export function inferCrudAuditAction(method: string): AuditAction {
  switch (method.toUpperCase()) {
    case "POST":
      return AUDIT_ACTION.DATA_CREATE;
    case "PUT":
    case "PATCH":
      return AUDIT_ACTION.DATA_UPDATE;
    case "DELETE":
      return AUDIT_ACTION.DATA_DELETE;
    case "GET":
    default:
      return AUDIT_ACTION.DATA_READ;
  }
}

export interface AuditLogEntry {
  id: string;
  tenant_id: string | null;
  organization_id: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: AuditAction | string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  status: "success" | "failed";
  timestamp: string;
  integrity_hash: string | null;
  previous_hash: string | null;
  archived: boolean;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
