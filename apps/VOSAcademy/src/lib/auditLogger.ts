import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface AuditLogEntry {
  timestamp: string;
  actor: string;
  tenantOrOrg: string;
  action: string;
  result: "success" | "failure";
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  socket?: {
    remoteAddress?: string;
  };
}

const AUDIT_LOG_DIR = path.resolve(process.cwd(), "apps/VOSAcademy/logs");
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, "audit.log");

export function getRequestAuditContext(req: RequestLike): { ipAddress?: string; userAgent?: string } {
  const forwardedFor = req.headers?.["x-forwarded-for"];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim() || req.socket?.remoteAddress;

  const userAgentHeader = req.headers?.["user-agent"];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;

  return {
    ipAddress,
    userAgent,
  };
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await mkdir(AUDIT_LOG_DIR, { recursive: true });
    await appendFile(AUDIT_LOG_FILE, `${JSON.stringify(entry)}\n`, "utf-8");
  } catch (error) {
    console.error("[AuditLogger] Failed to write audit log", error);
  }
}
