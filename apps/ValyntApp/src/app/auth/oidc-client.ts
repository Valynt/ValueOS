import { getConfig } from "../config/env";

export interface OidcClaims {
  sub: string;
  email?: string;
  roles?: string[];
  tenant_id?: string;
  [key: string]: unknown;
}

export interface OidcConfig {
  domain: string;
  clientId: string;
  audience: string;
  redirectUri: string;
}

export function getOidcConfig(): OidcConfig | null {
  const { oidc } = getConfig();
  if (!oidc.domain || !oidc.clientId) {
    return null;
  }
  return oidc;
}

export function decodeJwtClaims(token: string): OidcClaims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded) as OidcClaims;
  } catch {
    return null;
  }
}

export function createTenantScopedHeaders({
  tenantId,
  accessToken,
}: {
  tenantId: string;
  accessToken?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "x-tenant-id": tenantId,
  };

  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  return headers;
}
