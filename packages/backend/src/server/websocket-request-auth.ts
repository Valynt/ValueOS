import type { IncomingMessage } from "http";
import type { RawData, WebSocket, WebSocketServer } from "ws";

import type { TenantContextResolver } from "../services/tenant/TenantContextResolver.js";
import type { WebSocketLimiter } from "../services/realtime/WebSocketLimiter.js";

export interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  tenantId: string;
  connectionId: string;
}

export interface WebSocketAuthDependencies {
  verifyAccessToken: (token: string) => Promise<
    | {
        claims?: Record<string, unknown> | null;
        user?: { id?: string | null } | null;
      }
    | null
  >;
  extractTenantId: (
    claims?: Record<string, unknown> | null,
    user?: { id?: string | null } | null
  ) => string | null;
  tenantResolver: Pick<TenantContextResolver, "hasTenantAccess">;
  logger: {
    info: (message: string, payload?: unknown) => void;
    warn: (message: string, payload?: unknown) => void;
    error: (message: string, error?: Error) => void;
    debug: (message: string, payload?: unknown) => void;
  };
  websocketLimiter: Pick<WebSocketLimiter, "evaluateMessage" | "releaseConnection">;
  recordDroppedFrame: (reason: string) => void;
  recordThrottledClient: (tenantId: string) => void;
  logSecurityEvent: (event: {
    type: "WEBSOCKET_FRAME_BLOCKED";
    category: string;
    severity: string;
    outcome: string;
    reason: string;
    userId: string;
    tenantId: string;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
  }) => void;
  wsMaxPayloadBytes: number;
  wsMaxMessagesPerSecond: number;
  wsPolicyViolationCode: number;
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

function getPayloadBytes(data: RawData): number {
  return typeof data === "string"
    ? Buffer.byteLength(data)
    : data instanceof ArrayBuffer
      ? data.byteLength
      : Array.isArray(data)
        ? data.reduce((total, segment) => total + segment.byteLength, 0)
        : data.byteLength;
}

function getTextPayload(data: RawData): string {
  return typeof data === "string"
    ? data
    : data instanceof ArrayBuffer
      ? Buffer.from(data).toString()
      : Array.isArray(data)
        ? Buffer.concat(data).toString()
        : data.toString();
}

export async function authenticateWebSocketRequest(
  ws: WebSocket,
  req: IncomingMessage,
  wss: WebSocketServer,
  nextConnectionId: () => number,
  deps: WebSocketAuthDependencies
): Promise<void> {
  const clientIp = req.socket.remoteAddress;
  const token = getWebSocketToken(req);

  if (!token) {
    deps.logger.warn("WebSocket authentication failed: missing token", { clientIp });
    ws.close(deps.wsPolicyViolationCode, "Authentication required");
    return;
  }

  const verified = await deps.verifyAccessToken(token);
  if (!verified) {
    deps.logger.warn("WebSocket authentication failed: invalid token", { clientIp });
    ws.close(deps.wsPolicyViolationCode, "Invalid token");
    return;
  }

  const claims = verified.claims ?? null;
  const claimsSub =
    claims && typeof claims.sub === "string" ? claims.sub : null;
  const userId = verified.user?.id ?? claimsSub;

  if (!userId) {
    deps.logger.warn("WebSocket authentication failed: missing user id", {
      clientIp,
    });
    ws.close(deps.wsPolicyViolationCode, "Invalid token");
    return;
  }

  let tenantId = deps.extractTenantId(claims, verified.user);
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
        ws.close(deps.wsPolicyViolationCode, "Tenant access denied");
        return;
      }
      tenantId = requestedTenantId;
    }
  }

  if (!tenantId) {
    deps.logger.warn("WebSocket authentication failed: missing tenant context", {
      clientIp,
      userId,
    });
    ws.close(deps.wsPolicyViolationCode, "Tenant context required");
    return;
  }

  const authedSocket = ws as AuthenticatedWebSocket;
  authedSocket.userId = userId;
  authedSocket.tenantId = tenantId;
  authedSocket.connectionId = `${tenantId}:${nextConnectionId()}`;

  deps.logger.info("WebSocket client connected", {
    clientIp,
    userId,
    tenantId,
    connectionId: authedSocket.connectionId,
  });

  ws.on("message", (data: RawData) => {
    const payloadBytes = getPayloadBytes(data);
    const limiterResult = deps.websocketLimiter.evaluateMessage(
      authedSocket.connectionId,
      authedSocket.tenantId,
      payloadBytes
    );

    if (!limiterResult.allowed && limiterResult.reason) {
      deps.recordDroppedFrame(limiterResult.reason);
      deps.recordThrottledClient(authedSocket.tenantId);
      deps.logSecurityEvent({
        type: "WEBSOCKET_FRAME_BLOCKED",
        category: "rate_limiting",
        severity: "high",
        outcome: "blocked",
        reason: limiterResult.reason,
        userId: authedSocket.userId,
        tenantId: authedSocket.tenantId,
        ipAddress: clientIp,
        metadata: {
          connectionId: authedSocket.connectionId,
          payloadBytes,
          maxPayloadBytes: deps.wsMaxPayloadBytes,
          maxMessagesPerSecond: deps.wsMaxMessagesPerSecond,
        },
      });

      ws.close(deps.wsPolicyViolationCode, "Policy violation");
      return;
    }

    try {
      const message = JSON.parse(getTextPayload(data)) as {
        type?: string;
        messageId?: string;
        payload?: unknown;
      };
      deps.logger.debug("WebSocket message received", {
        type: message.type,
        messageId: message.messageId,
      });

      switch (message.type) {
        case "sdui_update": {
          const senderTenantId = authedSocket.tenantId;
          wss.clients.forEach(client => {
            const recipient = client as AuthenticatedWebSocket;
            if (
              client !== ws &&
              client.readyState === WebSocket.OPEN &&
              recipient.tenantId === senderTenantId
            ) {
              client.send(
                JSON.stringify({
                  type: "sdui_update",
                  data: message.payload,
                  timestamp: new Date().toISOString(),
                })
              );
            }
          });
          break;
        }
        case "ping":
          ws.send(
            JSON.stringify({
              type: "pong",
              timestamp: new Date().toISOString(),
            })
          );
          break;
        default:
          deps.logger.warn("Unknown WebSocket message type", { type: message.type });
      }
    } catch (error) {
      deps.logger.error(
        "Error handling WebSocket message",
        error instanceof Error ? error : undefined
      );
    }
  });

  ws.on("close", () => {
    deps.websocketLimiter.releaseConnection(
      authedSocket.connectionId,
      authedSocket.tenantId
    );
    deps.logger.info("WebSocket client disconnected", {
      clientIp,
      userId,
      tenantId,
      connectionId: authedSocket.connectionId,
    });
  });

  ws.on("error", error => {
    deps.logger.error("WebSocket error", error instanceof Error ? error : undefined);
  });
}
