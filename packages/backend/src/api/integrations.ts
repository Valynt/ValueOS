/**
 * Integrations API Endpoints
 *
 * Manages CRM integrations (HubSpot, Salesforce) for a tenant.
 */

import { createLogger } from "@shared/lib/logger";
import type { Request, Response, Router } from "express";

import type { AuthenticatedRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import {
  validateRequest,
  ValidationSchemas,
} from "../middleware/inputValidation";
import { requirePermission } from "../middleware/rbac";
import { createSecureRouter } from "../middleware/secureRouter";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import {
  integrationConnectionService,
  type IntegrationConnectPayload,
} from "../services/crm/IntegrationConnectionService";
import { getCrmSyncQueue } from "../workers/crmWorker";
import type { CrmProvider } from "../services/crm/types";
import { crmWebhookService } from "../services/crm/CrmWebhookService";
import { integrationControlService } from "../services/crm/IntegrationControlService";
import { handleServiceError } from "../services/errors";
import { auditLogService } from "../services/security/AuditLogService";

const logger = createLogger({ component: "IntegrationsAPI" });
const router: Router = createSecureRouter("strict");

router.use(requireAuth, tenantContextMiddleware());

function getActor(req: Request) {
  const user = (req as AuthenticatedRequest).user;
  const userMetadata = user?.user_metadata as Record<string, unknown> | undefined;
  const userName =
    (typeof userMetadata?.full_name === 'string' ? userMetadata.full_name : undefined) ||
    (typeof userMetadata?.name === 'string' ? userMetadata.name : undefined) ||
    user?.email ||
    "Unknown";

  return {
    id: user?.id || "",
    email: user?.email || "",
    name: userName,
  };
}

function handleError(res: Response, error: unknown, message: string) {
  const serviceError = handleServiceError(error);
  logger.error(message, serviceError, { code: serviceError.code });
  return res.status(serviceError.statusCode ?? 500).json({
    error: serviceError.message || message,
    code: serviceError.code,
  });
}

type OperationsProvider = CrmProvider;

interface OperationsTimelineEntry {
  id: string;
  category: "connection" | "webhook_failure" | "sync_failure" | "lifecycle";
  action: string;
  provider: string;
  status: string;
  timestamp: string;
  correlationId: string | null;
  resourceId: string;
  details?: Record<string, unknown>;
}

function parseOperationsProvider(value: string): OperationsProvider | null {
  if (value === "hubspot" || value === "salesforce") return value;
  return null;
}

function safeIsoTimestamp(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function extractCorrelationId(details?: Record<string, unknown>): string | null {
  const candidate =
    details?.correlation_id ??
    details?.correlationId ??
    details?.trace_id ??
    details?.traceId;
  return typeof candidate === "string" ? candidate : null;
}

router.get(
  "/",
  requirePermission("integrations:view"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as AuthenticatedRequest).tenantId as
        | string
        | undefined;
      const userId = (req as AuthenticatedRequest).user?.id as
        | string
        | undefined;

      if (!tenantId || !userId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }

      const integrations = await integrationConnectionService.listConnections(
        userId,
        tenantId
      );
      return res.json({ integrations });
    } catch (error) {
      return handleError(res, error, "Failed to list integrations");
    }
  }
);

router.post(
  "/",
  requirePermission("integrations:manage"),
  validateRequest(ValidationSchemas.integrationConnect),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as AuthenticatedRequest).tenantId as
        | string
        | undefined;
      const userId = (req as AuthenticatedRequest).user?.id as
        | string
        | undefined;

      if (!tenantId || !userId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }

      const enabled =
        await integrationControlService.areIntegrationsEnabled(tenantId);
      if (!enabled) {
        return res.status(403).json({
          error: "Integrations are disabled for this organization.",
        });
      }

      const payload = req.body as IntegrationConnectPayload;
      const integration = await integrationConnectionService.connect(
        userId,
        tenantId,
        payload
      );

      const actor = getActor(req);
      await auditLogService.logAudit({
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "integration_connected",
        resourceType: "integration",
        resourceId: integration.id,
        details: {
          provider: integration.provider,
          status: integration.status,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || undefined,
      });

      return res.status(201).json({ integration });
    } catch (error) {
      return handleError(res, error, "Failed to connect integration");
    }
  }
);

router.delete(
  "/:integrationId",
  requirePermission("integrations:manage"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as AuthenticatedRequest).tenantId as
        | string
        | undefined;
      const userId = (req as AuthenticatedRequest).user?.id as
        | string
        | undefined;
      const integrationId = req.params.integrationId;

      if (!tenantId || !userId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }

      const integration = await integrationConnectionService.disconnect(
        userId,
        tenantId,
        integrationId
      );

      const actor = getActor(req);
      await auditLogService.logAudit({
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "integration_disconnected",
        resourceType: "integration",
        resourceId: integration.id,
        details: {
          provider: integration.provider,
          status: integration.status,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || undefined,
      });

      return res.json({ integration });
    } catch (error) {
      return handleError(res, error, "Failed to disconnect integration");
    }
  }
);

router.post(
  "/:integrationId/test",
  requirePermission("integrations:manage"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as AuthenticatedRequest).tenantId as
        | string
        | undefined;
      const userId = (req as AuthenticatedRequest).user?.id as
        | string
        | undefined;
      const integrationId = req.params.integrationId;

      if (!tenantId || !userId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }

      const result = await integrationConnectionService.testConnection(
        userId,
        tenantId,
        integrationId
      );

      const actor = getActor(req);
      await auditLogService.logAudit({
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "integration_tested",
        resourceType: "integration",
        resourceId: integrationId,
        details: {
          status: result.status,
          ok: result.ok,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || undefined,
      });

      return res.json({ result });
    } catch (error) {
      return handleError(res, error, "Failed to test integration");
    }
  }
);

router.post(
  "/:integrationId/sync",
  requirePermission("integrations:manage"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as AuthenticatedRequest).tenantId as
        | string
        | undefined;
      const userId = (req as AuthenticatedRequest).user?.id as
        | string
        | undefined;
      const integrationId = req.params.integrationId;

      if (!tenantId || !userId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }

      const integration = await integrationConnectionService.sync(
        userId,
        tenantId,
        integrationId
      );

      const actor = getActor(req);
      await auditLogService.logAudit({
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "integration_sync_requested",
        resourceType: "integration",
        resourceId: integrationId,
        details: {
          provider: integration.provider,
          status: integration.status,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || undefined,
      });

      return res.json({ integration });
    } catch (error) {
      return handleError(res, error, "Failed to sync integration");
    }
  }
);

router.get(
  "/operations",
  requirePermission("integrations:view"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as AuthenticatedRequest).tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }

      const providerQuery = typeof req.query.provider === "string" ? req.query.provider : undefined;
      const selectedProvider = providerQuery ? parseOperationsProvider(providerQuery) : null;
      if (providerQuery && !selectedProvider) {
        return res.status(400).json({ error: "Invalid provider filter" });
      }

      const actions = [
        "integration_connected",
        "integration_disconnected",
        "integration_sync_requested",
        "integration_tested",
        "integration_sync_retry_requested",
        "integration_webhook_replay_requested",
        "crm_connected",
        "crm_disconnected",
        "crm_sync_triggered",
        "crm_sync_completed",
        "crm_sync_failed",
        "integrations_disabled",
      ];

      const auditRows = await auditLogService.query({
        tenantId,
        action: actions,
        limit: 300,
      });

      const filteredAuditRows = auditRows.filter((row) => {
        const details = (row.details ?? {}) as Record<string, unknown>;
        const provider = details.provider;
        if (!selectedProvider) return true;
        return provider === selectedProvider || row.resource_id === selectedProvider;
      });

      const connectionEvents: OperationsTimelineEntry[] = [];
      const syncFailures: OperationsTimelineEntry[] = [];
      const lifecycleHistory: OperationsTimelineEntry[] = [];

      for (const row of filteredAuditRows) {
        const details = (row.details ?? {}) as Record<string, unknown>;
        const provider = typeof details.provider === "string" ? details.provider : String(row.resource_id || "unknown");
        const entry: OperationsTimelineEntry = {
          id: row.id,
          category: "lifecycle",
          action: row.action,
          provider,
          status: row.status,
          timestamp: safeIsoTimestamp(row.timestamp, new Date().toISOString()),
          correlationId: extractCorrelationId(details),
          resourceId: row.resource_id,
          details,
        };

        if (
          row.action === "integration_connected" ||
          row.action === "integration_disconnected" ||
          row.action === "crm_connected" ||
          row.action === "crm_disconnected"
        ) {
          entry.category = "connection";
          connectionEvents.push(entry);
        }

        if (row.action === "crm_sync_failed") {
          entry.category = "sync_failure";
          syncFailures.push(entry);
        }

        if (
          row.action === "integration_connected" ||
          row.action === "integration_disconnected" ||
          row.action === "integration_webhook_replay_requested" ||
          row.action === "integrations_disabled"
        ) {
          entry.category = "lifecycle";
          lifecycleHistory.push(entry);
        }
      }

      const webhookFailures = await crmWebhookService.listFailedEvents(
        tenantId,
        selectedProvider,
        100
      );

      return res.json({
        provider: selectedProvider,
        operations: {
          connectionEvents,
          webhookFailures,
          syncFailures,
          lifecycleHistory,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      return handleError(res, error, "Failed to load integration operations");
    }
  }
);

router.post(
  "/operations/:provider/sync/retry",
  requirePermission("integrations:manage"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as AuthenticatedRequest).tenantId as string | undefined;
      const provider = parseOperationsProvider(req.params.provider);
      const userId = (req as AuthenticatedRequest).user?.id as string | undefined;
      if (!tenantId || !userId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }
      if (!provider) {
        return res.status(400).json({ error: "Unsupported provider" });
      }

      const queue = getCrmSyncQueue();
      const correlationId = req.header("x-correlation-id") ?? req.header("x-request-id") ?? null;
      const job = await queue.add("crm:sync:retry", {
        tenantId,
        provider,
        type: "retry",
        correlationId,
      });

      const actor = getActor(req);
      await auditLogService.logAudit({
        tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "integration_sync_retry_requested",
        resourceType: "integration",
        resourceId: provider,
        details: {
          provider,
          retryJobId: job.id,
          correlation_id: correlationId,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || undefined,
      });

      return res.json({
        success: true,
        provider,
        retryJobId: job.id,
        correlationId,
        requestedAt: new Date().toISOString(),
      });
    } catch (error) {
      return handleError(res, error, "Failed to queue sync retry");
    }
  }
);

router.post(
  "/operations/:provider/webhook/:eventId/replay",
  requirePermission("integrations:manage"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as AuthenticatedRequest).tenantId as string | undefined;
      const provider = parseOperationsProvider(req.params.provider);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }
      if (!provider) {
        return res.status(400).json({ error: "Unsupported provider" });
      }

      const correlationId = req.header("x-correlation-id") ?? req.header("x-request-id") ?? null;
      const replay = await crmWebhookService.replayFailedEvent(
        tenantId,
        provider,
        req.params.eventId,
        correlationId,
      );

      const actor = getActor(req);
      await auditLogService.logAudit({
        tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "integration_webhook_replay_requested",
        resourceType: "integration_webhook",
        resourceId: req.params.eventId,
        details: {
          provider,
          replayJobId: replay.replayJobId,
          correlation_id: correlationId,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || undefined,
      });

      return res.json({
        success: true,
        ...replay,
      });
    } catch (error) {
      return handleError(res, error, "Failed to replay webhook event");
    }
  }
);

export default router;
