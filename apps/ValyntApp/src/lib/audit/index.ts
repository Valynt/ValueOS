export interface AuditEntry { action: string; userId?: string; resource?: string; timestamp: string; metadata?: Record<string, unknown>; }
export function logAudit(_entry: AuditEntry): void {}
export function getAuditLog(_filter?: Record<string, unknown>): AuditEntry[] { return []; }
