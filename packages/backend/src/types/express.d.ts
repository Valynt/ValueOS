import "express";
import type { SupabaseClient } from "@supabase/supabase-js";

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
      useFallbackModel?: boolean;
      supabase?: SupabaseClient;
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
      _auditMiddlewareAttached?: boolean;
    }
  }
}
