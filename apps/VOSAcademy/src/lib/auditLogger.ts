import { sql } from "drizzle-orm";

import { getDbConnection } from "../data/_core/db-connection";

export type AuditResult = "success" | "failure";

export interface AuditRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogEntry {
  timestamp: string;
  actor: string;
  tenantId?: string;
  organizationId?: string;
  action: string;
  result: AuditResult;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

let schemaEnsured = false;

function normalizeHeaderValue(value: string | string[] | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseForwardedFor(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.split(",")[0]?.trim() || undefined;
}

export function getAuditRequestContext(req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): AuditRequestContext {
  const forwardedFor = parseForwardedFor(normalizeHeaderValue(req.headers?.["x-forwarded-for"]));
  const realIp = normalizeHeaderValue(req.headers?.["x-real-ip"]);
  const ipAddress = forwardedFor || realIp || req.socket?.remoteAddress || undefined;
  const userAgent = normalizeHeaderValue(req.headers?.["user-agent"]);

  return {
    ipAddress,
    userAgent,
  };
}

async function ensureAuditSchema() {
  if (schemaEnsured) {
    return;
  }

  const db = await getDbConnection();
  if (!db) {
    throw new Error("[Audit] Database connection unavailable");
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL,
      actor TEXT NOT NULL,
      tenant_id TEXT,
      organization_id TEXT,
      action TEXT NOT NULL,
      result TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      details JSONB
    )
  `);

  schemaEnsured = true;
}

export async function logAuditEvent(entry: Omit<AuditLogEntry, "timestamp"> & { timestamp?: string }): Promise<void> {
  const timestamp = entry.timestamp || new Date().toISOString();

  try {
    await ensureAuditSchema();
    const db = await getDbConnection();
    if (!db) {
      throw new Error("[Audit] Database connection unavailable");
    }

    await db.execute(sql`
      INSERT INTO audit_logs (
        timestamp,
        actor,
        tenant_id,
        organization_id,
        action,
        result,
        ip_address,
        user_agent,
        details
      ) VALUES (
        ${timestamp}::timestamptz,
        ${entry.actor},
        ${entry.tenantId ?? null},
        ${entry.organizationId ?? null},
        ${entry.action},
        ${entry.result},
        ${entry.ipAddress ?? null},
        ${entry.userAgent ?? null},
        ${entry.details ? JSON.stringify(entry.details) : null}::jsonb
      )
    `);
  } catch (error) {
    console.error("[Audit] Failed to persist audit log", {
      error,
      entry: {
        ...entry,
        timestamp,
      },
    });
  }
}
