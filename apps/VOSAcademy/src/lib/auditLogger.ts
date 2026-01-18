import { auditLogs } from "../drizzle/schema";
import { getDb } from "../data/db";

type AuditResult = "success" | "failure";

export interface AuditEvent {
  actor: string;
  action: string;
  result: AuditResult;
  tenant?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp?: Date;
}

const getHeaderValue = (value: string | string[] | undefined): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

export const getAuditContextFromRequest = (req: any) => {
  const headers = req?.headers ?? {};
  const forwardedFor = getHeaderValue(headers["x-forwarded-for"]);
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || req?.socket?.remoteAddress || null;
  const userAgent = getHeaderValue(headers["user-agent"]);
  const tenant =
    getHeaderValue(headers["x-tenant-id"]) ||
    getHeaderValue(headers["x-org-id"]) ||
    getHeaderValue(headers["x-organization-id"]);

  return {
    ipAddress,
    userAgent,
    tenant,
  };
};

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Audit] Database not available for audit logging");
    return;
  }

  try {
    await db.insert(auditLogs).values({
      timestamp: event.timestamp ?? new Date(),
      actor: event.actor,
      tenant: event.tenant ?? null,
      action: event.action,
      result: event.result,
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent ?? null,
      metadata: event.metadata ?? null,
    });
  } catch (error) {
    console.error("[Audit] Failed to log audit event:", error);
  }
}
