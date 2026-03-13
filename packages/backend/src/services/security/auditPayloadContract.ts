import { Request } from "express";
import { z } from "zod";

import { sanitizeForLogging } from "../lib/piiFilter.js";

export const requiredAuditPayloadSchema = z.object({
  actor: z.string().min(1),
  action_type: z.string().min(1),
  resource_type: z.string().min(1),
  resource_id: z.string().min(1),
  request_path: z.string().min(1),
  ip_address: z.string().min(1),
  user_agent: z.string().min(1),
  outcome: z.enum(["success", "failed"]),
  status_code: z.number().int().min(100).max(599),
  timestamp: z.string().datetime(),
  correlation_id: z.string().min(1),
});

export type RequiredAuditPayload = z.infer<typeof requiredAuditPayloadSchema>;

interface RequestUser {
  id?: string;
  name?: string;
  email?: string;
}

export function extractAuditActorContext(req: Request): { actor: string; userId?: string } {
  const user = req.user as RequestUser | undefined;
  const headerActor = req.get("x-user-email") || req.get("x-actor");
  const actor =
    (sanitizeForLogging(user?.email || user?.name || headerActor || "anonymous") as string) ||
    "anonymous";

  return {
    actor,
    userId: user?.id,
  };
}

export function extractAuditResourceContext(req: Request): { requestPath: string; resourceId: string } {
  const requestPath =
    (sanitizeForLogging(req.path || req.originalUrl || "unknown") as string) || "unknown";
  const resourceId =
    (sanitizeForLogging(
      req.params.id || req.params.userId || req.params.tenantId || req.body?.id || "unknown"
    ) as string) || "unknown";

  return { requestPath, resourceId };
}

export function extractAuditNetworkContext(req: Request): { ipAddress: string; userAgent: string } {
  return {
    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
    userAgent: req.get("user-agent") || "unknown",
  };
}

export function mapAuditPayloadToLegacyShape(payload: RequiredAuditPayload): Record<string, unknown> {
  return {
    actor: payload.actor,
    action: payload.action_type,
    resource: payload.resource_type,
    requestPath: payload.request_path,
    ipAddress: payload.ip_address,
    userAgent: payload.user_agent,
    statusCode: payload.status_code,
    requestId: payload.correlation_id,
    outcome: payload.outcome,
    timestamp: payload.timestamp,
  };
}
