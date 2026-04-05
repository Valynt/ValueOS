import type { IncomingMessage } from "http";

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
