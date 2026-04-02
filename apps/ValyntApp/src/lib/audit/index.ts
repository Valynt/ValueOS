export interface AuditEntry { action: string; userId?: string; resource?: string; timestamp: string; metadata?: Record<string, unknown>; }
export function logAudit(_entry: AuditEntry): void {
  throw new Error("Frontend audit sink is not implemented. Route audit events to the backend audit service.");
}
export function getAuditLog(_filter?: Record<string, unknown>): AuditEntry[] {
  throw new Error("Frontend audit log access is not implemented. Query immutable backend audit logs instead.");
}

export interface AuditActor {
  type: "human" | "service" | "system";
  id: string;
  role?: string;
  organizationId?: string;
  sessionId?: string;
}

export const enhancedAuditLogger = {
  logDataAccess(
    _actor: AuditActor,
    _source: string,
    _binding: string,
    _operation: string,
    _success: boolean,
    _metadata?: Record<string, unknown>
  ): void {
    throw new Error("Enhanced frontend audit logging is not implemented. Use backend audit ingestion endpoints.");
  },
};
