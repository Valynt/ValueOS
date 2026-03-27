/**
 * CRM Integration API Routes
 *
 * Endpoints for OAuth connect/callback/disconnect, webhook ingestion,
 * sync triggers, and connection status.
 *
 * Routes:
 *   POST /api/crm/:provider/connect/start
 *   GET  /api/crm/:provider/connect/callback
 *   POST /api/crm/:provider/disconnect
 *   GET  /api/crm/:provider/status
 *   POST /api/crm/:provider/webhook
 *   POST /api/crm/:provider/sync/now
 */

import { Request, Response, Router } from "express";
import express from "express";
import { z } from "zod";

import { createLogger } from "../lib/logger";
import {
  isOriginAllowedExact,
  resolveValidatedOriginFromAppUrl,
} from "../lib/security/originAllowlist";
import { requireAuth } from "../middleware/auth";
import { createRateLimiter } from "../middleware/rateLimiter";
import { requirePermission } from "../middleware/rbac";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import { crmConnectionService } from "../services/crm/CrmConnectionService";
import { crmHealthService } from "../services/crm/CrmHealthService";
import { crmIntegrationService } from "../services/crm/CRMIntegrationService";
import { getCrmProvider } from "../services/crm/CrmProviderRegistry";
import { crmWebhookService } from "../services/crm/CrmWebhookService";
import { consumeOAuthState } from "../services/crm/OAuthStateStore";
import { CrmProviderSchema } from "../services/crm/types";
import { auditLogService } from "../services/security/AuditLogService";
import { getCrmSyncQueue, getCrmWebhookQueue } from "../workers/crmWorker";

const logger = createLogger({ component: "CrmAPI" });
const router = Router();

function getScriptNonceAttribute(res: Response): string {
  const nonce =
    typeof res.locals.cspNonce === "string" ? res.locals.cspNonce : "";
  return nonce ? ` nonce="${nonce}"` : "";
}

// Rate limiter for webhook endpoint: 100 requests per minute per IP
const webhookRateLimiter = createRateLimiter("strict", {
  message: "Webhook rate limit exceeded",
});

// Payload size limit for webhooks: 512KB
const webhookBodyLimit = express.json({ limit: "512kb" });

// ============================================================================
// Helpers
// ============================================================================

function getActor(req: Request) {
  const user = req.user;
  return {
    id: user?.id || "",
    email: user?.email || "",
    name: user?.user_metadata?.full_name || user?.email || "Unknown",
  };
}

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new Error("Tenant context required");
  return tenantId;
}

function parseProvider(req: Request) {
  return CrmProviderSchema.parse(req.params.provider);
}

function getRedirectUri(req: Request, provider: string): string {
  const baseUrl =
    process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}/api/crm/${provider}/connect/callback`;
}

function sendOAuthCallbackErrorHtml(
  res: Response,
  options: { status: number; message: string; appOrigin?: string }
): Response {
  const scriptNonceAttr = getScriptNonceAttribute(res);
  const messageLiteral = JSON.stringify(options.message);
  const appOriginLiteral = options.appOrigin
    ? JSON.stringify(options.appOrigin)
    : null;
  const postMessageScript = appOriginLiteral
    ? `window.opener?.postMessage({ type: 'crm-oauth-error', error: ${messageLiteral} }, ${appOriginLiteral});`
    : "";

  return res.status(options.status).send(`
    <html><body>
      <script${scriptNonceAttr}>
        ${postMessageScript}
        window.close();
      </script>
      <p>${options.message}</p>
    </body></html>
  `);
}

// ============================================================================
// OAuth Routes (authenticated + tenant context)
// ============================================================================

const authMiddleware = [requireAuth, tenantContextMiddleware()];

/**
 * POST /api/crm/:provider/connect/start
 * Initiates OAuth flow. Returns the auth URL to redirect the user to.
 */
router.post(
  "/:provider/connect/start",
  ...authMiddleware,
  requirePermission("integrations:manage"),
  async (req: Request, res: Response) => {
    try {
      const provider = parseProvider(req);
      const tenantId = getTenantId(req);
      const redirectUri = getRedirectUri(req, provider);

      const result = await crmConnectionService.startOAuth(
        tenantId,
        provider,
        redirectUri
      );

      const actor = getActor(req);
      await auditLogService.logAudit({
        tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "crm_oauth_started",
        resourceType: "crm_connection",
        resourceId: provider,
        details: { provider },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      return res.json({ authUrl: result.authUrl, state: result.state });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn("OAuth start rejected: unsupported provider", {
          provider: req.params.provider,
        });
        return res.status(400).json({ error: "Unsupported provider" });
      }
      logger.error(
        "Failed to start OAuth",
        error instanceof Error ? error : undefined
      );
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to start OAuth",
      });
    }
  }
);

/**
 * GET /api/crm/:provider/connect/callback
 * OAuth callback. Exchanges code for tokens and stores them.
 */
router.get(
  "/:provider/connect/callback",
  async (req: Request, res: Response) => {
    try {
      const provider = CrmProviderSchema.parse(req.params.provider);
      const code = req.query.code as string;
      const state = req.query.state as string;

      if (!code || !state) {
        return res
          .status(400)
          .json({ error: "Missing code or state parameter" });
      }

      const appOriginResolution = resolveValidatedOriginFromAppUrl(
        process.env.APP_URL
      );
      if (!appOriginResolution.ok) {
        logger.error("OAuth callback rejected: APP_URL is missing or invalid", {
          provider,
          reason: appOriginResolution.error,
        });
        return sendOAuthCallbackErrorHtml(res, {
          status: 500,
          message: `OAuth callback misconfiguration: ${appOriginResolution.error}`,
        });
      }

      const appOrigin = appOriginResolution.origin;
      const requestOrigin = req.get("origin")?.trim();
      if (requestOrigin && !isOriginAllowedExact(appOrigin, requestOrigin)) {
        logger.warn("OAuth callback rejected: unexpected origin", {
          provider,
          expectedOrigin: appOrigin,
          receivedOrigin: requestOrigin,
        });
        return sendOAuthCallbackErrorHtml(res, {
          status: 403,
          message: "OAuth callback rejected: unexpected origin",
          appOrigin,
        });
      }

      // The state is an opaque nonce. completeOAuth validates it server-side
      // via consumeOAuthState and resolves the tenantId from the state store.
      // We pass the state-store tenantId to completeOAuth for validation.
      const redirectUri = getRedirectUri(req, provider);

      // Peek at the state store to get the tenantId, then let completeOAuth
      // do the full validation. We consume the state here and pass the
      // verified tenantId to completeOAuth.
      const stateMeta = await consumeOAuthState(state, provider);
      if (!stateMeta) {
        logger.warn("OAuth callback rejected: invalid or expired state", {
          provider,
        });
        return sendOAuthCallbackErrorHtml(res, {
          status: 400,
          message:
            "Connection failed. Invalid or expired state. Please try again.",
          appOrigin,
        });
      }

      const tenantId = stateMeta.tenantId;

      const connection =
        await crmConnectionService.completeOAuthAfterStateValidation(
          tenantId,
          provider,
          code,
          redirectUri,
          "oauth-callback"
        );

      // Audit log
      await auditLogService.logAudit({
        tenantId,
        userId: "system",
        userName: "System",
        userEmail: "system@valueos.io",
        action: "crm_connected",
        resourceType: "crm_connection",
        resourceId: connection.id,
        details: { provider, status: connection.status },
      });

      // Trigger initial sync
      const syncQueue = getCrmSyncQueue();
      await syncQueue.add(
        "crm:sync:initial",
        {
          tenantId,
          provider,
          type: "initial",
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        }
      );

      // Return HTML that closes the popup.
      // Provider is already validated by CrmProviderSchema.parse() above,
      // but we use JSON.stringify to guarantee safe embedding in script context.
      const safeProvider = JSON.stringify(provider);
      const appOriginLiteral = JSON.stringify(appOrigin);
      const scriptNonceAttr = getScriptNonceAttribute(res);
      return res.send(`
        <html><body>
          <script${scriptNonceAttr}>
            window.opener?.postMessage({ type: 'crm-oauth-complete', provider: ${safeProvider} }, ${appOriginLiteral});
            window.close();
          </script>
          <p>Connected successfully. You can close this window.</p>
        </body></html>
      `);
    } catch (error) {
      logger.error(
        "OAuth callback failed",
        error instanceof Error ? error : undefined
      );
      const appOriginResolution = resolveValidatedOriginFromAppUrl(
        process.env.APP_URL
      );
      return sendOAuthCallbackErrorHtml(res, {
        status: 500,
        message: "Connection failed. Please try again.",
        appOrigin: appOriginResolution.ok
          ? appOriginResolution.origin
          : undefined,
      });
    }
  }
);

/**
 * POST /api/crm/:provider/disconnect
 */
router.post(
  "/:provider/disconnect",
  ...authMiddleware,
  requirePermission("integrations:manage"),
  async (req: Request, res: Response) => {
    try {
      const provider = parseProvider(req);
      const tenantId = getTenantId(req);

      await crmConnectionService.disconnect(tenantId, provider);

      const actor = getActor(req);
      await auditLogService.logAudit({
        tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "crm_disconnected",
        resourceType: "crm_connection",
        resourceId: provider,
        details: { provider },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      return res.json({ success: true });
    } catch (error) {
      logger.error(
        "Disconnect failed",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({ error: "Failed to disconnect" });
    }
  }
);

/**
 * GET /api/crm/:provider/status
 */
router.get(
  "/:provider/status",
  ...authMiddleware,
  requirePermission("integrations:view"),
  async (req: Request, res: Response) => {
    try {
      const provider = parseProvider(req);
      const tenantId = getTenantId(req);

      const connection = await crmConnectionService.getConnection(
        tenantId,
        provider
      );

      if (!connection) {
        return res.json({
          connected: false,
          status: "disconnected",
          provider,
        });
      }

      return res.json({
        connected: connection.status === "connected",
        status: connection.status,
        provider: connection.provider,
        lastSyncAt: connection.last_sync_at,
        lastSuccessfulSyncAt: connection.last_successful_sync_at,
        lastError: connection.last_error,
        externalOrgId: connection.external_org_id,
      });
    } catch (error) {
      logger.error(
        "Status check failed",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({ error: "Failed to get status" });
    }
  }
);

// ============================================================================
// Webhook Route (no auth — verified by signature)
// ============================================================================

/**
 * POST /api/crm/:provider/webhook
 * Receives CRM webhook events. Verifies signature, stores event, enqueues processing.
 * Rate-limited and payload-size-limited.
 */
router.post(
  "/:provider/webhook",
  webhookRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const provider = CrmProviderSchema.parse(req.params.provider);

      const result = await crmWebhookService.ingestWebhook(provider, req);

      if (!result.accepted) {
        if (!result.duplicate) {
          // Log security event for signature failures
          logger.warn("Webhook signature verification failed", {
            provider,
            ip: req.ip,
            userAgent: req.get("user-agent"),
          });
          await auditLogService
            .logAudit({
              userId: "system",
              userName: "System",
              userEmail: "system@valueos.io",
              action: "webhook_signature_rejected",
              resourceType: "crm_webhook",
              resourceId: provider,
              details: {
                provider,
                ip: req.ip,
                reason: "signature_verification_failed",
              },
              status: "failed",
            })
            .catch(() => {}); // non-blocking
        }
        return res.status(result.duplicate ? 200 : 401).json({
          ok: result.duplicate,
          message: result.duplicate
            ? "Duplicate event, already processed"
            : "Invalid signature",
        });
      }

      // Respond 200 quickly — processing happens async via queue
      return res.status(200).json({ ok: true, eventId: result.eventId });
    } catch (error) {
      logger.error(
        "Webhook ingestion failed",
        error instanceof Error ? error : undefined
      );
      // Return 200 to prevent CRM from retrying on our errors
      return res.status(200).json({ ok: false });
    }
  }
);

const dealSearchSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  tenantId: z.string().min(1).optional(),
  valueCaseId: z.string().min(1).optional(),
  company: z.string().optional(),
});

function mapStage(
  stage?: string
):
  | "prospecting"
  | "qualification"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost" {
  const normalized = (stage ?? "").toLowerCase();
  if (normalized.includes("won")) return "closed_won";
  if (normalized.includes("lost")) return "closed_lost";
  if (normalized.includes("negoti")) return "negotiation";
  if (normalized.includes("proposal")) return "proposal";
  if (normalized.includes("qualif")) return "qualification";
  return "prospecting";
}

router.get(
  "/deals/search",
  ...authMiddleware,
  requirePermission("integrations:view"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const parsed = dealSearchSchema.safeParse(req.query);
      if (!parsed.success) {
        return res
          .status(400)
          .json({
            error: "Invalid search params",
            details: parsed.error.flatten(),
          });
      }

      const { q, page, pageSize, company } = parsed.data;
      const requestedTenantId = parsed.data.tenantId;
      if (requestedTenantId && requestedTenantId !== tenantId) {
        return res.status(403).json({ error: "Tenant scope mismatch" });
      }

      const deals = await crmIntegrationService.fetchDeals(tenantId);
      const query = (q ?? "").toLowerCase();
      const companyFilter = (company ?? "").toLowerCase();

      const filtered = deals.filter(deal => {
        const name = (deal.name ?? "").toLowerCase();
        const companyName = (deal.companyName ?? "").toLowerCase();
        const queryMatch =
          !query || name.includes(query) || companyName.includes(query);
        const companyMatch =
          !companyFilter || companyName.includes(companyFilter);
        return queryMatch && companyMatch;
      });

      const start = (page - 1) * pageSize;
      const paged = filtered.slice(start, start + pageSize).map(deal => ({
        id: deal.id,
        name: deal.name,
        company: deal.companyName ?? "Unknown company",
        stage: mapStage(deal.stage),
        amount: deal.amount ?? undefined,
        closeDate: deal.closeDate?.toISOString(),
        crmId: deal.externalId ?? deal.id,
        crmSource: deal.provider === "salesforce" ? "salesforce" : "hubspot",
        owner: deal.ownerName ?? undefined,
        lastActivity: deal.updatedAt?.toISOString(),
      }));

      return res.json({
        deals: paged,
        total: filtered.length,
        hasMore: start + pageSize < filtered.length,
        page,
        pageSize,
      });
    } catch (error) {
      logger.error(
        "Deal search failed",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({ error: "Failed to search deals" });
    }
  }
);

// ============================================================================
// Sync Health
// ============================================================================

/**
 * GET /api/crm/:provider/health
 * Returns sync health metrics, lag, error rates, and alerts.
 */
router.get(
  "/:provider/health",
  ...authMiddleware,
  requirePermission("integrations:view"),
  async (req: Request, res: Response) => {
    try {
      const provider = parseProvider(req);
      const tenantId = getTenantId(req);

      const health = await crmHealthService.getHealth(tenantId, provider);
      if (!health) {
        return res.json({ connected: false, provider });
      }

      return res.json(health);
    } catch (error) {
      logger.error(
        "Health check failed",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({ error: "Failed to get health status" });
    }
  }
);

// ============================================================================
// Manual Sync Trigger
// ============================================================================

/**
 * POST /api/crm/:provider/sync/now
 * Admin/manual trigger for delta sync.
 */
router.post(
  "/:provider/sync/now",
  ...authMiddleware,
  requirePermission("integrations:manage"),
  async (req: Request, res: Response) => {
    try {
      const provider = parseProvider(req);
      const tenantId = getTenantId(req);

      const syncQueue = getCrmSyncQueue();
      const job = await syncQueue.add(
        "crm:sync:manual",
        {
          tenantId,
          provider,
          type: "delta",
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        }
      );

      const actor = getActor(req);
      await auditLogService.logAudit({
        tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "crm_sync_triggered",
        resourceType: "crm_connection",
        resourceId: provider,
        details: { provider, jobId: job.id },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      return res.json({ success: true, jobId: job.id });
    } catch (error) {
      logger.error(
        "Sync trigger failed",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({ error: "Failed to trigger sync" });
    }
  }
);

// ============================================================================
// Opportunity Search (provider-scoped, uses canonical CRM provider)
// ============================================================================

/**
 * GET /api/crm/:provider/opportunities
 *
 * Returns open opportunities from the connected provider for the tenant.
 * Supports optional ?q= search filter applied server-side on name/account.
 * Uses the canonical CrmProviderInterface.fetchDeltaOpportunities.
 */
router.get(
  "/:provider/opportunities",
  ...authMiddleware,
  requirePermission("integrations:view"),
  async (req: Request, res: Response) => {
    try {
      const provider = parseProvider(req);
      const tenantId = getTenantId(req);

      const connection = await crmConnectionService.getConnection(
        tenantId,
        provider
      );
      if (!connection) {
        return res.json({ opportunities: [] });
      }

      const tokens = await crmConnectionService.getTokens(tenantId, provider);
      if (!tokens) {
        return res
          .status(401)
          .json({ error: "CRM tokens unavailable — please reconnect" });
      }

      const impl = getCrmProvider(provider);
      const delta = await impl.fetchDeltaOpportunities(tokens, null);

      const q =
        typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
      const filtered = q
        ? delta.opportunities.filter(
            o =>
              o.name.toLowerCase().includes(q) ||
              (o.companyName ?? "").toLowerCase().includes(q)
          )
        : delta.opportunities;

      return res.json({ opportunities: filtered });
    } catch (error) {
      logger.error(
        "Failed to fetch CRM opportunities",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({ error: "Failed to fetch opportunities" });
    }
  }
);

// ============================================================================
// Deal Search
// ============================================================================

/**
 * GET /api/crm/deals
 * Returns open deals from the connected CRM for the authenticated tenant.
 * Supports optional ?q= search filter on name/company, applied in this handler.
 * Falls back to empty array when no CRM is connected.
 */
router.get(
  "/deals",
  ...authMiddleware,
  requirePermission("integrations:view"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const deals = await crmIntegrationService.fetchDeals(tenantId);

      const q =
        typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
      const filtered = q
        ? deals.filter(
            d =>
              d.name.toLowerCase().includes(q) ||
              (d.companyName ?? "").toLowerCase().includes(q)
          )
        : deals;

      return res.json({ deals: filtered });
    } catch (error) {
      logger.error(
        "Failed to fetch CRM deals",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({ error: "Failed to fetch deals" });
    }
  }
);

export default router;
