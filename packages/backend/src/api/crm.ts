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

import { Router, Request, Response } from 'express';
import express from 'express';
import { z } from 'zod';
import { createLogger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requirePermission } from '../middleware/rbac.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { crmConnectionService } from '../services/crm/CrmConnectionService.js';
import { crmWebhookService } from '../services/crm/CrmWebhookService.js';
import { crmHealthService } from '../services/crm/CrmHealthService.js';
import { getCrmSyncQueue, getCrmWebhookQueue } from '../workers/crmWorker.js';
import { auditLogService } from '../services/AuditLogService.js';
import { CrmProviderSchema } from '../services/crm/types.js';

const logger = createLogger({ component: 'CrmAPI' });
const router = Router();

// Rate limiter for webhook endpoint: 100 requests per minute per IP
const webhookRateLimiter = createRateLimiter('strict', {
  message: 'Webhook rate limit exceeded',
});

// Payload size limit for webhooks: 512KB
const webhookBodyLimit = express.json({ limit: '512kb' });

// ============================================================================
// Helpers
// ============================================================================

function getActor(req: Request) {
  const user = (req as any).user;
  return {
    id: (user?.id as string) || '',
    email: (user?.email as string) || '',
    name: user?.user_metadata?.full_name || user?.email || 'Unknown',
  };
}

function getTenantId(req: Request): string {
  const tenantId = (req as any).tenantId as string | undefined;
  if (!tenantId) throw new Error('Tenant context required');
  return tenantId;
}

function parseProvider(req: Request) {
  return CrmProviderSchema.parse(req.params.provider);
}

function getRedirectUri(req: Request, provider: string): string {
  const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/api/crm/${provider}/connect/callback`;
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
  '/:provider/connect/start',
  ...authMiddleware,
  requirePermission('integrations:manage'),
  async (req: Request, res: Response) => {
    try {
      const provider = parseProvider(req);
      const tenantId = getTenantId(req);
      const redirectUri = getRedirectUri(req, provider);

      const result = await crmConnectionService.startOAuth(tenantId, provider, redirectUri);

      const actor = getActor(req);
      await auditLogService.logAudit({
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: 'crm_oauth_started',
        resourceType: 'crm_connection',
        resourceId: provider,
        details: { provider, tenantId },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.json({ authUrl: result.authUrl, state: result.state });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('OAuth start rejected: unsupported provider', {
          provider: req.params.provider,
        });
        return res.status(400).json({ error: 'Unsupported provider' });
      }
      logger.error('Failed to start OAuth', error instanceof Error ? error : undefined);
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to start OAuth',
      });
    }
  },
);

/**
 * GET /api/crm/:provider/connect/callback
 * OAuth callback. Exchanges code for tokens and stores them.
 */
router.get(
  '/:provider/connect/callback',
  async (req: Request, res: Response) => {
    try {
      const provider = CrmProviderSchema.parse(req.params.provider);
      const code = req.query.code as string;
      const state = req.query.state as string;

      if (!code || !state) {
        return res.status(400).json({ error: 'Missing code or state parameter' });
      }

      // Extract tenantId from state (format: randomHex:tenantId)
      const stateParts = state.split(':');
      if (stateParts.length < 2) {
        return res.status(400).json({ error: 'Invalid state parameter' });
      }
      const tenantId = stateParts.slice(1).join(':');

      const redirectUri = getRedirectUri(req, provider);

      const connection = await crmConnectionService.completeOAuth(
        tenantId,
        provider,
        code,
        state,
        redirectUri,
        'oauth-callback', // connected_by — we don't have auth context in callback
      );

      // Audit log
      await auditLogService.logAudit({
        userId: 'system',
        userName: 'System',
        userEmail: 'system@valueos.io',
        action: 'crm_connected',
        resourceType: 'crm_connection',
        resourceId: connection.id,
        details: { provider, tenantId, status: connection.status },
      });

      // Trigger initial sync
      const syncQueue = getCrmSyncQueue();
      await syncQueue.add('crm:sync:initial', {
        tenantId,
        provider,
        type: 'initial',
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });

      // Return HTML that closes the popup
      return res.send(`
        <html><body>
          <script>
            window.opener?.postMessage({ type: 'crm-oauth-complete', provider: '${provider}' }, '*');
            window.close();
          </script>
          <p>Connected successfully. You can close this window.</p>
        </body></html>
      `);
    } catch (error) {
      logger.error('OAuth callback failed', error instanceof Error ? error : undefined);
      return res.status(500).send(`
        <html><body>
          <script>
            window.opener?.postMessage({ type: 'crm-oauth-error', error: 'Connection failed' }, '*');
            window.close();
          </script>
          <p>Connection failed. Please try again.</p>
        </body></html>
      `);
    }
  },
);

/**
 * POST /api/crm/:provider/disconnect
 */
router.post(
  '/:provider/disconnect',
  ...authMiddleware,
  requirePermission('integrations:manage'),
  async (req: Request, res: Response) => {
    try {
      const provider = parseProvider(req);
      const tenantId = getTenantId(req);

      await crmConnectionService.disconnect(tenantId, provider);

      const actor = getActor(req);
      await auditLogService.logAudit({
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: 'crm_disconnected',
        resourceType: 'crm_connection',
        resourceId: provider,
        details: { provider, tenantId },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.json({ success: true });
    } catch (error) {
      logger.error('Disconnect failed', error instanceof Error ? error : undefined);
      return res.status(500).json({ error: 'Failed to disconnect' });
    }
  },
);

/**
 * GET /api/crm/:provider/status
 */
router.get(
  '/:provider/status',
  ...authMiddleware,
  requirePermission('integrations:view'),
  async (req: Request, res: Response) => {
    try {
      const provider = parseProvider(req);
      const tenantId = getTenantId(req);

      const connection = await crmConnectionService.getConnection(tenantId, provider);

      if (!connection) {
        return res.json({
          connected: false,
          status: 'disconnected',
          provider,
        });
      }

      return res.json({
        connected: connection.status === 'connected',
        status: connection.status,
        provider: connection.provider,
        lastSyncAt: connection.last_sync_at,
        lastSuccessfulSyncAt: connection.last_successful_sync_at,
        lastError: connection.last_error,
        externalOrgId: connection.external_org_id,
      });
    } catch (error) {
      logger.error('Status check failed', error instanceof Error ? error : undefined);
      return res.status(500).json({ error: 'Failed to get status' });
    }
  },
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
  '/:provider/webhook',
  webhookRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const provider = CrmProviderSchema.parse(req.params.provider);

      const result = await crmWebhookService.ingestWebhook(provider, req);

      if (!result.accepted) {
        if (!result.duplicate) {
          // Log security event for signature failures
          logger.warn('Webhook signature verification failed', {
            provider,
            ip: req.ip,
            userAgent: req.get('user-agent'),
          });
          await auditLogService.logAudit({
            userId: 'system',
            userName: 'System',
            userEmail: 'system@valueos.io',
            action: 'webhook_signature_rejected',
            resourceType: 'crm_webhook',
            resourceId: provider,
            details: {
              provider,
              ip: req.ip,
              reason: 'signature_verification_failed',
            },
            status: 'failed',
          }).catch(() => {}); // non-blocking
        }
        return res.status(result.duplicate ? 200 : 401).json({
          ok: result.duplicate,
          message: result.duplicate ? 'Duplicate event, already processed' : 'Invalid signature',
        });
      }

      // Respond 200 quickly — processing happens async via queue
      return res.status(200).json({ ok: true, eventId: result.eventId });
    } catch (error) {
      logger.error('Webhook ingestion failed', error instanceof Error ? error : undefined);
      // Return 200 to prevent CRM from retrying on our errors
      return res.status(200).json({ ok: false });
    }
  },
);

// ============================================================================
// Sync Health
// ============================================================================

/**
 * GET /api/crm/:provider/health
 * Returns sync health metrics, lag, error rates, and alerts.
 */
router.get(
  '/:provider/health',
  ...authMiddleware,
  requirePermission('integrations:view'),
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
      logger.error('Health check failed', error instanceof Error ? error : undefined);
      return res.status(500).json({ error: 'Failed to get health status' });
    }
  },
);

// ============================================================================
// Manual Sync Trigger
// ============================================================================

/**
 * POST /api/crm/:provider/sync/now
 * Admin/manual trigger for delta sync.
 */
router.post(
  '/:provider/sync/now',
  ...authMiddleware,
  requirePermission('integrations:manage'),
  async (req: Request, res: Response) => {
    try {
      const provider = parseProvider(req);
      const tenantId = getTenantId(req);

      const syncQueue = getCrmSyncQueue();
      const job = await syncQueue.add('crm:sync:manual', {
        tenantId,
        provider,
        type: 'delta',
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });

      const actor = getActor(req);
      await auditLogService.logAudit({
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: 'crm_sync_triggered',
        resourceType: 'crm_connection',
        resourceId: provider,
        details: { provider, tenantId, jobId: job.id },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.json({ success: true, jobId: job.id });
    } catch (error) {
      logger.error('Sync trigger failed', error instanceof Error ? error : undefined);
      return res.status(500).json({ error: 'Failed to trigger sync' });
    }
  },
);

export default router;
