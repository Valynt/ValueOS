import { JwtPayload } from 'jsonwebtoken';

export type VerificationContext = {
  route?: string;
  method?: string;
};

export type AuthUser = {
  id?: string;
  email?: string;
  role?: string | string[];
  tenant_id?: string;
  organization_id?: string;
  app_metadata?: {
    tenant_id?: string;
    roles?: unknown;
    tier?: string;
  };
  user_metadata?: Record<string, unknown>;
};

export type AuthSession = {
  access_token?: string;
  token_type?: string;
  expires_at?: number;
  expires_in?: number;
  user?: AuthUser;
};

/** Result of verifyAccessToken / verifyTokenWithSupabase / verifyTokenLocally */
export type VerifiedAuth = {
  user: AuthUser;
  session: AuthSession;
  claims: JwtPayload;
};

export type FallbackEmergencyConfig = {
  incidentId: string;
  incidentSeverity: string;
  incidentStartedAt: string;
  incidentCorrelationId: string;
  allowedRoutes: string[];
  allowedMethods: string[];
  requireAuthoritativeRevocation: boolean;
};

export type RevocationCheckResult = {
  revoked: boolean;
  authoritative: boolean;
};
