import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  tenantOrOrg: string;
  action: string;
  result: AuditResult;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

const AUDIT_LOG_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../logs/audit.log");

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

function resolveTenantOrOrg(entry: {
  tenantOrOrg?: string;
  tenantId?: string;
  organizationId?: string;
}): string {
  return entry.tenantOrOrg || entry.organizationId || entry.tenantId || "unknown";
}

export async function logAuditEvent(
  entry: Omit<AuditLogEntry, "timestamp" | "tenantOrOrg"> & {
    timestamp?: string;
    tenantOrOrg?: string;
  }
): Promise<void> {
  const timestamp = entry.timestamp || new Date().toISOString();
  const record: AuditLogEntry = {
    timestamp,
    actor: entry.actor,
    tenantId: entry.tenantId,
    organizationId: entry.organizationId,
    tenantOrOrg: resolveTenantOrOrg(entry),
    action: entry.action,
    result: entry.result,
    ipAddress: entry.ipAddress || "unknown",
    userAgent: entry.userAgent || "unknown",
    details: entry.details,
  };

  try {
    await mkdir(dirname(AUDIT_LOG_PATH), { recursive: true });
    await appendFile(AUDIT_LOG_PATH, `${JSON.stringify(record)}\n`, "utf8");
  } catch (error) {
    console.error("[Audit] Failed to persist audit log", {
      error,
      record,
      path: AUDIT_LOG_PATH,
    });
  }
}
