import { AsyncLocalStorage } from "async_hooks";

import { getContext, runWithContext } from "@shared/lib/context";
import { createLogger } from "@shared/lib/logger";
import {
  getUserTenantId,
  resolveOrganizationIdToTenantId,
  verifyTenantExists,
  verifyTenantMembership,
} from "@shared/lib/tenantVerification";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import type { AuthenticatedRequest } from "./auth.js";

// Extended request shape used internally by this middleware
interface TenantRequest extends AuthenticatedRequest {
  session?: { expires_at?: number; expires_in?: number };
  serviceIdentityVerified?: boolean;
  tenantSource?: string;
  tenantContext?: TCTPayload;
}

const logger = createLogger({ component: "TenantContextMiddleware" });

const assertValidTctSecret = (): string => {
  const secret = process.env.TCT_SECRET;
  if (!secret) {
    throw new Error(
      "TCT_SECRET must be configured before initializing tenant context middleware."
    );
  }
  return secret;
};

export interface TCTPayload {
  iss: string;
  sub: string;
  tid: string;
  roles: string[];
  tier: string;
  exp: number;
}

export const tenantContextStorage = new AsyncLocalStorage<TCTPayload>();

/**
 * Trusted resolution sources in priority order.
 * "request" (route-param) is intentionally excluded — route parameters are
 * user-controlled input and must not be trusted for tenant resolution.
 */
type TenantCandidateSource =
  | "tct"
  | "service-header"
  | "user-claim"
  | "user-claim-org-canonicalized"
  | "user-lookup"
  | "none";

type TenantContextUser = {
  id?: string;
  role?: string | string[];
  roles?: string | string[];
  email?: string;
  tenant_id?: string;
  organization_id?: string;
  app_metadata?: { roles?: unknown; tier?: string };
  [key: string]: unknown;
};

const resolveRoles = (user: TenantContextUser | undefined): string[] => {
  const directRole = user?.role;
  if (Array.isArray(directRole)) {
    return directRole.filter(role => typeof role === "string");
  }
  if (typeof directRole === "string" && directRole.length > 0) {
    return [directRole];
  }
  const metadataRoles = user?.app_metadata?.roles;
  if (Array.isArray(metadataRoles)) {
    return metadataRoles.filter((role: unknown) => typeof role === "string");
  }
  return [];
};

const isAgentScopedRequest = (req: Request): boolean => {
  const requestPath = `${req.baseUrl ?? ""}${req.path ?? ""}`;
  return (
    requestPath.startsWith("/api/agents") ||
    requestPath.startsWith("/api/groundtruth")
  );
};

const buildRequestContext = (
  tenantId: string,
  req: Request,
  userId?: string | null
): TCTPayload => {
  const user = (req as TenantRequest).user as TenantContextUser | undefined;
  const session = (req as TenantRequest).session;
  const roles = resolveRoles(user);
  const exp =
    (session?.expires_at as number | undefined) ??
    (session?.expires_in
      ? Math.floor(Date.now() / 1000) + Number(session.expires_in)
      : undefined) ??
    Math.floor(Date.now() / 1000) + 3600;

  return {
    iss: "jwt",
    sub: userId || "service",
    tid: tenantId,
    roles,
    tier: user?.app_metadata?.tier ?? "unknown",
    exp,
  };
};

/**
 * Middleware to extract and verify Tenant Context Token (TCT).
 *
 * Resolution chain (in priority order):
 *   1. TCT JWT (x-tenant-context header) — cryptographically verified
 *   2. Service header (x-tenant-id) — only when serviceIdentityVerified=true
 *   3. User JWT claim (tenant_id / organization_id)
 *   4. User lookup (DB) — only when authenticated user has no claim
 *
 * Sources are consulted in this order; a lower-priority source is only used
 * when no higher-priority source has already resolved a tenant.
 *
 * Route parameters are NOT a resolution source. They are user-controlled
 * input and must not be trusted for tenant identity.
 *
 * If a verified Tenant Context Token conflicts with an already-resolved
 * tenant or the authenticated user identity, the request is rejected with
 * 403. Other sources are treated as fallbacks rather than cross-validated
 * against every possible combination.
 */
export const tenantContextMiddleware = (enforce = true) => {
  const tctSecret = assertValidTctSecret();

  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["x-tenant-context"];
    const userId = (req as TenantRequest).user?.id as string | undefined;
    let tenantSource: TenantCandidateSource = "none";
    let resolvedTenantId: string | null = null;
    let tctPayload: TCTPayload | null = null;

    // ── Source 1: TCT JWT ──────────────────────────────────────────────────
    if (authHeader) {
      const token = Array.isArray(authHeader)
        ? (authHeader[0] ?? "")
        : authHeader;

      try {
        tctPayload = jwt.verify(token, tctSecret, {
          algorithms: ["HS256"],
        }) as unknown as TCTPayload;
        const requestTenantId = (req as TenantRequest).tenantId as
          | string
          | undefined;

        if (requestTenantId && tctPayload.tid !== requestTenantId) {
          logger.warn("Tenant context tenant mismatch", {
            expected: requestTenantId,
            received: tctPayload.tid,
          });
          return res.status(403).json({ error: "Tenant context mismatch" });
        }

        if (userId && tctPayload.sub !== userId) {
          logger.warn("Tenant context user mismatch", {
            expected: userId,
            received: tctPayload.sub,
          });
          return res.status(403).json({ error: "Tenant context mismatch" });
        }

        resolvedTenantId = tctPayload.tid;
        tenantSource = "tct";
      } catch (error) {
        logger.error("Invalid TCT", error);
        if (enforce) {
          return res
            .status(401)
            .json({ error: "Invalid Tenant Context Token" });
        }
        return next();
      }
    }

    // ── Source 2: Service header ───────────────────────────────────────────
    if (!resolvedTenantId) {
      const tenantHeader = req.header("x-tenant-id");
      if (tenantHeader) {
        if (!(req as TenantRequest).serviceIdentityVerified) {
          logger.warn("Blocked external tenant header usage", {
            userId,
            path: req.path,
          });
          return res.status(403).json({
            error: "Forbidden",
            message:
              "Tenant header is restricted to internal service requests.",
          });
        }
        resolvedTenantId = tenantHeader;
        tenantSource = "service-header";
      }
    }

    // ── Source 3: User JWT claim ───────────────────────────────────────────
    // SECURITY: organization_id is NOT a direct tenant resolution source.
    // If JWT contains only organization_id, it MUST be canonicalized to tenant_id
    // via database lookup. Only tenant_id is authoritative.
    const jwtTenantId = (req as TenantRequest).user?.tenant_id as string | undefined;
    const jwtOrganizationId = (req as TenantRequest).user?.organization_id as string | undefined;

    // Track if we had to canonicalize org_id to tenant_id
    let didCanonicalizeOrgId = false;

    if (!resolvedTenantId && (jwtTenantId || jwtOrganizationId)) {
      let claimTenantId: string | null = null;

      if (jwtTenantId) {
        claimTenantId = jwtTenantId;
      } else if (jwtOrganizationId) {
        // Canonicalize: organization_id MUST map to tenant_id via lookup
        claimTenantId = await resolveOrganizationIdToTenantId(jwtOrganizationId);
        didCanonicalizeOrgId = true;

        if (!claimTenantId) {
          logger.warn("Organization ID could not be canonicalized to tenant", {
            userId,
            organizationId: jwtOrganizationId,
            path: req.path,
          });
          return res.status(403).json({
            error: "tenant_required",
            message: "Organization context requires valid tenant mapping.",
          });
        }
      }

      if (claimTenantId) {
        resolvedTenantId = claimTenantId;
        tenantSource = didCanonicalizeOrgId ? "user-claim-org-canonicalized" : "user-claim";
      }
    }

    // ── Source 4: User lookup (DB) ─────────────────────────────────────────
    // Note: route-param (tenantSource='request') is intentionally removed.
    // Route parameters are user-controlled and must not be trusted for tenant
    // identity resolution.
    //
    // Source 4 should be rare in production — it fires only when an authenticated
    // user has no tenant_id / organization_id claim in their JWT. This typically
    // indicates a misconfigured client or a legacy token. Log a warning so
    // operators can detect and remediate.
    if (!resolvedTenantId && userId) {
      const userTenantId = await getUserTenantId(userId);
      if (userTenantId) {
        resolvedTenantId = userTenantId;
        tenantSource = "user-lookup";
        logger.warn("Tenant resolved via DB lookup (source 4) — JWT missing tenant claim", {
          userId,
          resolvedTenantId,
          path: req.path,
        });
      }
    }

    // ── Conflict detection (all routes) ───────────────────────────────────
    // If the authenticated user's JWT claim disagrees with the resolved tenant,
    // deny the request regardless of path. This was previously only enforced
    // on agent-scoped paths; it now applies universally.
    const claimTenantId = jwtTenantId || (didCanonicalizeOrgId ? resolvedTenantId : null);
    if (
      claimTenantId &&
      resolvedTenantId &&
      claimTenantId !== resolvedTenantId
    ) {
      logger.warn("Tenant resolution conflict: claim vs resolved", {
        claimTenantId,
        resolvedTenantId,
        tenantSource,
        userId,
        path: req.path,
        isAgentScoped: isAgentScopedRequest(req),
      });
      return res.status(403).json({
        error: "tenant_mismatch",
        message: "Tenant context must match authenticated tenant claim.",
      });
    }

    // ── TCT vs JWT Conflict Detection ───────────────────────────────────────
    // If a TCT token was provided, its tid must match the JWT tenant claim
    if (tctPayload && jwtTenantId && tctPayload.tid !== jwtTenantId) {
      logger.warn("TCT vs JWT tenant conflict", {
        tctTenantId: tctPayload.tid,
        jwtTenantId,
        userId,
        path: req.path,
      });
      return res.status(403).json({
        error: "tenant_mismatch",
        message: "Tenant context token conflicts with authenticated tenant claim.",
      });
    }

    // ── No tenant resolved ─────────────────────────────────────────────────
    if (!resolvedTenantId) {
      if (enforce) {
        return res.status(403).json({
          error: "tenant_required",
          message: "Tenant context is required.",
        });
      }
      return next();
    }

    // ── Tenant existence check ─────────────────────────────────────────────
    const tenantExists = await verifyTenantExists(resolvedTenantId);
    if (!tenantExists) {
      logger.warn("Tenant context resolved to inactive or unknown tenant", {
        userId,
        tenantId: resolvedTenantId,
        source: tenantSource,
      });
      return res.status(404).json({
        error: "Not Found",
        message: "Tenant not found or inactive.",
      });
    }

    // ── Membership check ──────────────────────────────────────────────────
    const membershipUserId = tctPayload?.sub ?? userId;
    if (membershipUserId) {
      const isMember = await verifyTenantMembership(
        membershipUserId,
        resolvedTenantId
      );
      if (!isMember) {
        logger.warn("Tenant membership verification failed", {
          userId: membershipUserId,
          tenantId: resolvedTenantId,
          source: tenantSource,
        });
        return res.status(404).json({
          error: "Not Found",
          message: "Resource not found.",
        });
      }
    } else if (enforce) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Tenant membership could not be verified.",
      });
    }

    // ── Structured audit log on every successful resolution ───────────────
    logger.info("Tenant context resolved", {
      tenantId: resolvedTenantId,
      tenantSource,
      userId: membershipUserId ?? null,
      path: req.path,
      conflictDetected: false,
    });

    // ── Attach context and continue ────────────────────────────────────────
    const attachContext = () => {
      (req as TenantRequest).tenantId = resolvedTenantId!;
      (req as TenantRequest).organizationId =
        ((req as TenantRequest).organizationId as string | undefined) ??
        ((req as TenantRequest).user?.organization_id as string | undefined) ??
        resolvedTenantId!;
      (req as TenantRequest).tenantSource = tenantSource;
      next();
    };

    const contextPayload =
      tctPayload ??
      buildRequestContext(resolvedTenantId, req, membershipUserId);

    const existingContext = getContext() ?? {};
    const sharedContext = { ...existingContext, tenantId: resolvedTenantId };

    tenantContextStorage.run(contextPayload, () => {
      (req as TenantRequest).tenantContext = contextPayload;
      runWithContext(sharedContext, attachContext);
    });
  };
};

/**
 * Helper to get current tenant context
 */
export const getCurrentTenantContext = (): TCTPayload | undefined => {
  return tenantContextStorage.getStore();
};
