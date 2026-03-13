import { z } from "zod";

export type SiemSinkType = "webhook" | "http" | "syslog";

export interface SiemSinkConfig {
  name: string;
  type: SiemSinkType;
  endpoint: string;
  token?: string;
  protocol?: "udp" | "tcp";
  headers?: Record<string, string>;
}

export interface SiemRoutingConfig {
  enabled: boolean;
  maxRetries: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  deadLetterEnabled: boolean;
  routes: {
    auditLogs: string[];
    securityAuditLog: string[];
  };
  sinks: SiemSinkConfig[];
}

const sinkSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["webhook", "http", "syslog"]),
  endpoint: z.string().min(1),
  token: z.string().optional(),
  protocol: z.enum(["udp", "tcp"]).optional(),
  headers: z.record(z.string()).optional(),
});

const sinksSchema = z.array(sinkSchema);

function parseList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function getSiemRoutingConfig(env: NodeJS.ProcessEnv = process.env): SiemRoutingConfig {
  const sinksRaw = env.SIEM_SINKS_JSON;
  const parsedSinks = sinksRaw ? JSON.parse(sinksRaw) : [];
  const sinks = sinksSchema.parse(parsedSinks);

  return {
    enabled: env.SIEM_FORWARDER_ENABLED === "true",
    maxRetries: Number(env.SIEM_FORWARDER_MAX_RETRIES ?? "5"),
    baseBackoffMs: Number(env.SIEM_FORWARDER_BACKOFF_MS ?? "500"),
    maxBackoffMs: Number(env.SIEM_FORWARDER_MAX_BACKOFF_MS ?? "30000"),
    deadLetterEnabled: env.SIEM_FORWARDER_DEAD_LETTER_ENABLED !== "false",
    routes: {
      auditLogs: parseList(env.SIEM_ROUTE_AUDIT_LOGS),
      securityAuditLog: parseList(env.SIEM_ROUTE_SECURITY_AUDIT_LOG),
    },
    sinks,
  };
}

