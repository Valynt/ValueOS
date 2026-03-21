import "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";

type TenantDbContext = {
  client: PoolClient;
  query: <TRow extends QueryResultRow = QueryResultRow>(
    queryTextOrConfig: string,
    values?: unknown[]
  ) => Promise<QueryResult<TRow>>;
  tx: <TRow extends QueryResultRow = QueryResultRow>(
    queryTextOrConfig: string,
    values?: unknown[]
  ) => Promise<QueryResult<TRow>>;
};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        roles?: string[];
        role?: string;
        tenant_id?: string;
        organization_id?: string;
        sub?: string;
        auth0_sub?: string;
        subscription_tier?: string;
        plan_tier?: string;
        planTier?: string;
        app_metadata?: { role?: string; roles?: unknown; tier?: string };
        user_metadata?: { full_name?: string; name?: string };
        [key: string]: unknown;
      };
      tenantId?: string;
      tenant?: {
        id: string;
        [key: string]: unknown;
      };
      tenantSource?: string;
      tenantContext?: unknown;
      tenantSettings?: {
        billing?: { planTier?: string };
        [key: string]: unknown;
      };
      sessionId?: string;
      session?: {
        expires_at?: number;
        expires_in?: number | string;
        [key: string]: unknown;
      };
      userId?: string;
      requestId?: string;
      serviceIdentityVerified?: boolean;
      requestNonce?: string;
      servicePrincipal?: string;
      serviceIssuer?: string;
      serviceAuthMethod?: "mtls" | "jwt" | "hmac";
      useFallbackModel?: boolean;
      supabase?: SupabaseClient;
      db?: TenantDbContext;
      supabaseUser?: unknown;
      usageContext?: {
        tenantId: string;
        userId?: string;
        metric: string;
        entitlementCheck: unknown;
        timestamp: string;
      };
      organizationId?: string;
      traceContext?: {
        traceId: string;
        spanId: string;
      };
      featureFlags?: {
        isEnabled: (key: string) => Promise<boolean>;
        getVariant: (key: string) => Promise<string | null>;
        getConfig: (key: string) => Promise<Record<string, unknown> | null>;
      };
      featureFlagVariant?: string | null;
      featureFlagConfig?: Record<string, unknown> | null;
      _auditMiddlewareAttached?: boolean;
      /** Set by validateOpportunityAccess after ownership is confirmed. */
      opportunityId?: string;
    }
  }
}
