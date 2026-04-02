import { logger } from "./logger.js";

export interface AuditLogPayload {
  event: string;
  actor: string;
  tenant_id: string;
  resource?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

export async function auditLog(payload: AuditLogPayload): Promise<void> {
  const { event, ...rest } = payload;
  logger.info("audit.event", { audit_event: event, ...rest });
}
