export interface AuditEntry { action: string; userId?: string; resource?: string; timestamp: string; metadata?: Record<string, unknown>; }
export function logAudit(_entry: AuditEntry): void {}
export function getAuditLog(_filter?: Record<string, unknown>): AuditEntry[] { return []; }

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
  ): void {},
};
