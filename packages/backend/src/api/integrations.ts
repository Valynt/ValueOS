/**
 * Integrations API Endpoints
 *
 * Manages CRM integrations (HubSpot, Salesforce) for a tenant.
 */

import { createLogger } from "@shared/lib/logger";
import type { Request, Response, Router } from "express";
import { z } from "zod";

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
import { getIntegrationCapabilityRegistry } from "../services/crm/IntegrationCapabilityRegistry";
import { integrationControlService } from "../services/crm/IntegrationControlService";
import { integrationOperationsService } from "../services/crm/IntegrationOperationsService";
import { handleServiceError } from "../services/errors";
import { auditLogService } from "../services/security/AuditLogService";

const logger = createLogger({ component: "IntegrationsAPI" });
const router: Router = createSecureRouter("strict");
const operationsQuerySchema = z.object({
  provider: z.enum(["hubspot", "salesforce"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

router.use(requireAuth, tenantContextMiddleware());

function getActor(req: Request) {
  const user = req.user;
  const userMetadata = user?.user_metadata as Record<string, unknown> | undefined;
  const userName =
    (typeof userMetadata?.full_name === "string" ? userMetadata.full_name : undefined) ||
    (typeof userMetadata?.name === "string" ? userMetadata.name : undefined) ||
    user?.email ||
    "Unknown";

  return {
    id: user?.id || "",
    email: user?.email || "",
    name: userName,
  };
}

function getAuthContext(req: Request): { tenantId?: string; userId?: string } {
  return {
    tenantId: req.tenantId,
    userId: req.user?.id,
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

router.get(
  "/capabilities",
  requirePermission("integrations:view"),
  async (_req: Request, res: Response) => {
    const providers = getIntegrationCapabilityRegistry();
    return res.json({
      generatedAt: new Date().toISOString(),
      providers,
    });
  }
);

router.get(
  "/operations",
  requirePermission("integrations:view"),
  async (req: Request, res: Response) => {
    try {
      const { userId, tenantId } = getAuthContext(req);
      if (!tenantId || !userId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }

      const parsed = operationsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid operations query",
          details: parsed.error.flatten(),
        });
      }

      const operations = await integrationOperationsService.getOperations(
        tenantId,
        parsed.data.provider,
        parsed.data.limit
      );

      return res.json(operations);
    } catch (error) {
      return handleError(res, error, "Failed to load integration operations");
    }
  }
);

router.post(
  "/operations/webhooks/:eventId/replay",
  requirePermission("integrations:manage"),
  async (req: Request, res: Response) => {
    try {
      const { userId, tenantId } = getAuthContext(req);
      if (!tenantId || !userId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }

      const result = await integrationOperationsService.replayWebhookFailure(
        tenantId,
        req.params.eventId
      );

      const actor = getActor(req);
      await auditLogService.logAudit({
        tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "integration_webhook_replay_requested",
        resourceType: "crm_webhook",
        resourceId: result.eventId,
        details: {
          eventId: result.eventId,
          jobId: result.jobId,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || undefined,
      });

      return res.json({ success: true, ...result });
    } catch (error) {
      return handleError(res, error, "Failed to replay webhook failure");
    }
  }
);

router.post(
  "/operations/:provider/sync/retry",
  requirePermission("integrations:manage"),
  async (req: Request, res: Response) => {
    try {
      const { userId, tenantId } = getAuthContext(req);
      if (!tenantId || !userId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }

      const providerParse = z.enum(["hubspot", "salesforce"]).safeParse(req.params.provider);
      if (!providerParse.success) {
        return res.status(400).json({ error: "Unsupported provider" });
      }

      const result = await integrationOperationsService.retrySync(
        tenantId,
        providerParse.data
      );

      const actor = getActor(req);
      await auditLogService.logAudit({
        tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "integration_sync_retry_requested",
        resourceType: "crm_connection",
        resourceId: result.provider,
        details: {
          provider: result.provider,
          jobId: result.jobId,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || undefined,
      });

      return res.json({ success: true, ...result });
    } catch (error) {
      return handleError(res, error, "Failed to retry sync");
    }
  }
);

router.get(
  "/",
  requirePermission("integrations:view"),
  async (req: Request, res: Response) => {
    try {
      const { userId, tenantId } = getAuthContext(req);

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
      const { userId, tenantId } = getAuthContext(req);

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
  requirePermission("integrations:disconnect"),
  async (req: Request, res: Response) => {
    try {
      const { userId, tenantId } = getAuthContext(req);
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
  "/:integrationId/rotate-secret",
  requirePermission("secrets:rotate"),
  async (req: Request, res: Response) => {
    try {
      const { userId, tenantId } = getAuthContext(req);
      const integrationId = req.params.integrationId;
      const payload = req.body as Pick<
        IntegrationConnectPayload,
        "accessToken" | "refreshToken" | "tokenExpiresAt"
      >;

      if (!tenantId || !userId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }

      if (!payload.accessToken || payload.accessToken.trim().length < 10) {
        return res.status(400).json({ error: "accessToken is required" });
      }

      const integration = await integrationConnectionService.rotateCredentials(
        userId,
        tenantId,
        integrationId,
        payload
      );

      const actor = getActor(req);
      await auditLogService.logAudit({
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "integration_secret_rotated",
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
      return handleError(res, error, "Failed to rotate integration credentials");
    }
  }
);

router.post(
  "/:integrationId/test",
  requirePermission("integrations:manage"),
  async (req: Request, res: Response) => {
    try {
      const { userId, tenantId } = getAuthContext(req);
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

router.get(
  "/:integrationId/audit-history",
  requirePermission("integrations:view"),
  async (req: Request, res: Response) => {
    try {
      const { userId, tenantId } = getAuthContext(req);
      const integrationId = req.params.integrationId;

      if (!tenantId || !userId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }

      const history = await integrationConnectionService.getAuditHistory(
        userId,
        tenantId,
        integrationId
      );

      return res.json({ history });
    } catch (error) {
      return handleError(res, error, "Failed to load integration audit history");
    }
  }
);

router.post(
  "/:integrationId/sync",
  requirePermission("integrations:manage"),
  async (req: Request, res: Response) => {
    try {
      const { userId, tenantId } = getAuthContext(req);
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

export default router;
