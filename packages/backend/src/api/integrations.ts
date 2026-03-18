/**
 * Integrations API Endpoints
 *
 * Manages CRM integrations (HubSpot, Salesforce) for a tenant.
 */

import { createLogger } from "@shared/lib/logger";
import { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { validateRequest, ValidationSchemas } from "../middleware/inputValidation";
import { requirePermission } from "../middleware/rbac";
import { createSecureRouter } from "../middleware/secureRouter";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import {
  integrationConnectionService,
  type IntegrationConnectPayload,
} from "../services/crm/IntegrationConnectionService";
import { integrationControlService } from "../services/crm/IntegrationControlService";
import { handleServiceError } from "../services/errors";
import { auditLogService } from "../services/security/AuditLogService";

const logger = createLogger({ component: "IntegrationsAPI" });
const router = createSecureRouter("strict");

router.use(requireAuth, tenantContextMiddleware());

function getActor(req: Request) {
  const user = (req as AuthenticatedRequest).user;
  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Unknown";

  return {
    id: user?.id as string,
    email: user?.email as string,
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

router.get("/", requirePermission("integrations:view"), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as AuthenticatedRequest).tenantId as string | undefined;
    const userId = (req as AuthenticatedRequest).user?.id as string | undefined;

    if (!tenantId || !userId) {
      return res.status(400).json({ error: "Tenant context is required" });
    }

    const integrations = await integrationConnectionService.listConnections(userId, tenantId);
    return res.json({ integrations });
  } catch (error) {
    return handleError(res, error, "Failed to list integrations");
  }
});

router.post(
  "/",
  requirePermission("integrations:manage"),
  validateRequest(ValidationSchemas.integrationConnect),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as AuthenticatedRequest).tenantId as string | undefined;
      const userId = (req as AuthenticatedRequest).user?.id as string | undefined;

      if (!tenantId || !userId) {
        return res.status(400).json({ error: "Tenant context is required" });
      }

      const enabled = await integrationControlService.areIntegrationsEnabled(tenantId);
      if (!enabled) {
        return res.status(403).json({
          error: "Integrations are disabled for this organization.",
        });
      }

      const payload = req.body as IntegrationConnectPayload;
      const integration = await integrationConnectionService.connect(userId, tenantId, payload);

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
      const tenantId = (req as AuthenticatedRequest).tenantId as string | undefined;
      const userId = (req as AuthenticatedRequest).user?.id as string | undefined;
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
      const tenantId = (req as AuthenticatedRequest).tenantId as string | undefined;
      const userId = (req as AuthenticatedRequest).user?.id as string | undefined;
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
      const tenantId = (req as AuthenticatedRequest).tenantId as string | undefined;
      const userId = (req as AuthenticatedRequest).user?.id as string | undefined;
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
