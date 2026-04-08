import type { IncomingMessage } from "http";

import type { WebSocket } from "ws";

import { extractTenantId, verifyAccessToken } from "../middleware/auth.js";

const WS_POLICY_VIOLATION_CODE = 1008;

export interface WebSocketAuthLogger {
  warn: (message: string, payload?: Record<string, unknown>) => void;
  info: (message: string, payload?: Record<string, unknown>) => void;
}

export interface WebSocketTenantResolver {
  hasTenantAccess: (userId: string, tenantId: string) => Promise<boolean>;
}

export interface AuthenticatedWebSocketConnection {
  userId: string;
  tenantId: string;
}

export function parseBearerToken(header?: string | string[]): string | null {
  if (!header) return null;
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (!headerValue) return null;

  const prefix = "Bearer ";
  if (!headerValue.startsWith(prefix)) return null;

  const token = headerValue.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

export function getWebSocketToken(req: IncomingMessage): string | null {
  // Only accept tokens via Authorization header to prevent token leakage
  // in server logs, proxy logs, and browser history.
  return parseBearerToken(req.headers.authorization);
}

export function getRequestedTenantId(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "", "http://localhost");
  return (
    url.searchParams.get("tenantId") ??
    url.searchParams.get("tenant_id") ??
    url.searchParams.get("organization_id")
  );
}

export async function authenticateWebSocketRequest(
  ws: WebSocket,
  req: IncomingMessage,
  deps: {
    tenantResolver: WebSocketTenantResolver;
    logger: WebSocketAuthLogger;
  }
): Promise<AuthenticatedWebSocketConnection | null> {
  const clientIp = req.socket.remoteAddress;
  const token = getWebSocketToken(req);

  if (!token) {
    deps.logger.warn("WebSocket authentication failed: missing token", {
      clientIp,
    });
    ws.close(WS_POLICY_VIOLATION_CODE, "Authentication required");
    return null;
  }

  const verified = await verifyAccessToken(token);
  if (!verified) {
    deps.logger.warn("WebSocket authentication failed: invalid token", {
      clientIp,
    });
    ws.close(WS_POLICY_VIOLATION_CODE, "Invalid token");
    return null;
  }

  const claims = verified.claims ?? null;
  const userId = verified.user?.id ?? claims?.sub;

  if (!userId) {
    deps.logger.warn("WebSocket authentication failed: missing user id", {
      clientIp,
    });
    ws.close(WS_POLICY_VIOLATION_CODE, "Invalid token");
    return null;
  }

  let tenantId = extractTenantId(claims, verified.user);
  if (!tenantId) {
    const requestedTenantId = getRequestedTenantId(req);
    if (requestedTenantId) {
      const hasAccess = await deps.tenantResolver.hasTenantAccess(
        userId,
        requestedTenantId
      );
      if (!hasAccess) {
        deps.logger.warn("WebSocket authentication failed: tenant access denied", {
          clientIp,
          userId,
          requestedTenantId,
        });
        ws.close(WS_POLICY_VIOLATION_CODE, "Tenant access denied");
        return null;
      }
      tenantId = requestedTenantId;
    }
  }

  if (!tenantId) {
    deps.logger.warn("WebSocket authentication failed: missing tenant context", {
      clientIp,
      userId,
    });
    ws.close(WS_POLICY_VIOLATION_CODE, "Tenant context required");
    return null;
  }

  return {
    userId,
    tenantId,
  };
}
