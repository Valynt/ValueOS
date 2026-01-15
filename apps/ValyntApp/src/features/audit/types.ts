export type AuditAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "export"
  | "import"
  | "invite"
  | "approve"
  | "reject";

export type AuditResource =
  | "user"
  | "project"
  | "workspace"
  | "team"
  | "settings"
  | "billing"
  | "api_key"
  | "document"
  | "workflow";

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId: string;
  userId: string;
  userEmail: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
}

export interface AuditFilter {
  action?: AuditAction[];
  resource?: AuditResource[];
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}
