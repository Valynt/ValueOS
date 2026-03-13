/**
 * Audit Hooks Middleware
 *
 * AUD-302: Automatic audit logging for critical operations
 */

import { logger } from "@shared/lib/logger";
import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

import { auditLogService } from "../services/AuditLogService";
import {
  extractAuditActorContext,
  extractAuditNetworkContext,
  extractAuditResourceContext,
  requiredAuditPayloadSchema,
} from "../services/security/auditPayloadContract.js";

interface RequestUser {
  id?: string;
  name?: string;
  email?: string;
}

interface BuildAuditInput {
  actionType: string;
  resourceType: string;
  resourceId?: string;
  outcome: "success" | "failed";
  statusCode: number;
}

function buildValidatedAuditInput(req: Request, input: BuildAuditInput) {
  const user = req.user as RequestUser | undefined;
  const actorContext = extractAuditActorContext(req);
  const resourceContext = extractAuditResourceContext(req);
  const networkContext = extractAuditNetworkContext(req);
  const correlationId =
    (req as { requestId?: string }).requestId || req.get("x-request-id") || randomUUID();
  const timestamp = new Date().toISOString();

  const payload = requiredAuditPayloadSchema.parse({
    actor: actorContext.actor,
    action_type: input.actionType,
    resource_type: input.resourceType,
    resource_id: input.resourceId || resourceContext.resourceId,
    request_path: resourceContext.requestPath,
    ip_address: networkContext.ipAddress,
    user_agent: networkContext.userAgent,
    outcome: input.outcome,
    status_code: input.statusCode,
    timestamp,
    correlation_id: correlationId,
  });

  return {
    userId: user?.id ?? "anonymous",
    userName: user?.name ?? user?.email ?? actorContext.actor,
    userEmail: user?.email ?? "unknown@example.com",
    action: payload.action_type,
    actionType: payload.action_type,
    resourceType: payload.resource_type,
    resourceTypeCanonical: payload.resource_type,
    resourceId: payload.resource_id,
    resourceIdCanonical: payload.resource_id,
    requestPath: payload.request_path,
    ipAddress: payload.ip_address,
    userAgent: payload.user_agent,
    status: payload.outcome,
    statusCode: payload.status_code,
    correlationId: payload.correlation_id,
    actor: payload.actor,
    timestamp: payload.timestamp,
  };
}

export function auditDataExport(resourceType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;
    const originalJson = res.json;

    const logExport = async (success: boolean, recordCount?: number) => {
      try {
        const auditInput = buildValidatedAuditInput(req, {
          actionType: "data_export",
          resourceType,
          resourceId: req.params.id || "bulk",
          outcome: success ? "success" : "failed",
          statusCode: res.statusCode,
        });

        await auditLogService.logAudit({
          ...auditInput,
          details: {
            recordCount,
            duration: Date.now() - startTime,
            format: req.query.format || "json",
          },
        });
      } catch (error) {
        logger.error("Failed to log data export audit", error instanceof Error ? error : undefined);
      }
    };

    res.send = function (data: unknown) {
      void logExport(res.statusCode < 400, (data as { length?: number })?.length);
      return originalSend.call(this, data);
    };

    res.json = function (data: unknown) {
      const value = data as { length?: number; count?: number };
      void logExport(res.statusCode < 400, value?.length || value?.count);
      return originalJson.call(this, data);
    };

    next();
  };
}

export function auditAPIKeyOperation(operation: "view" | "create" | "rotate" | "revoke") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function (data: unknown) {
      setImmediate(async () => {
        try {
          const auditInput = buildValidatedAuditInput(req, {
            actionType: `api_key_${operation}`,
            resourceType: "api_key",
            resourceId: req.params.keyId || (data as { id?: string })?.id || "unknown",
            outcome: res.statusCode < 400 ? "success" : "failed",
            statusCode: res.statusCode,
          });

          await auditLogService.logAudit({
            ...auditInput,
            details: { operation },
          });
        } catch (error) {
          logger.error("Failed to log API key audit", error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

export function auditBulkDelete(resourceType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const recordIds =
      (Array.isArray(req.body?.ids) && req.body.ids) ||
      (Array.isArray(req.body?.records) && req.body.records) ||
      (req.params?.id ? [req.params.id] : []);
    const originalJson = res.json;

    res.json = function (data: unknown) {
      setImmediate(async () => {
        try {
          const auditInput = buildValidatedAuditInput(req, {
            actionType: "bulk_delete",
            resourceType,
            resourceId: "bulk",
            outcome: res.statusCode < 400 ? "success" : "failed",
            statusCode: res.statusCode,
          });

          const value = data as { deletedCount?: number; count?: number };
          await auditLogService.logAudit({
            ...auditInput,
            details: {
              recordCount: recordIds.length,
              deletedCount: value?.deletedCount || value?.count,
            },
          });
        } catch (error) {
          logger.error("Failed to log bulk delete audit", error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

export function auditPermissionChange() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const targetUserId = req.params.userId || req.body.userId;
    const permission = req.body.permission;
    const granted = req.method === "POST" || req.body.granted;
    const originalJson = res.json;

    res.json = function (data: unknown) {
      setImmediate(async () => {
        try {
          const auditInput = buildValidatedAuditInput(req, {
            actionType: granted ? "permission_grant" : "permission_revoke",
            resourceType: "user_permission",
            resourceId: targetUserId,
            outcome: res.statusCode < 400 ? "success" : "failed",
            statusCode: res.statusCode,
          });

          await auditLogService.logAudit({
            ...auditInput,
            details: { permission, granted },
          });
        } catch (error) {
          logger.error("Failed to log permission change audit", error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

export function auditRoleAssignment() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const targetUserId = req.params.userId || req.body.userId;
    const role = req.body.role;
    const assigned = req.method === "POST" || req.body.assigned;
    const originalJson = res.json;

    res.json = function (data: unknown) {
      setImmediate(async () => {
        try {
          const auditInput = buildValidatedAuditInput(req, {
            actionType: assigned ? "role_assign" : "role_remove",
            resourceType: "user_role",
            resourceId: targetUserId,
            outcome: res.statusCode < 400 ? "success" : "failed",
            statusCode: res.statusCode,
          });

          await auditLogService.logAudit({ ...auditInput, details: { role, assigned } });
        } catch (error) {
          logger.error("Failed to log role assignment audit", error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

export function auditTenantProvisioning(
  operation: "provision" | "deprovision" | "suspend" | "reactivate"
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.params.tenantId || req.body.organizationId;
    const originalJson = res.json;

    res.json = function (data: unknown) {
      setImmediate(async () => {
        try {
          const auditInput = buildValidatedAuditInput(req, {
            actionType: `tenant_${operation}`,
            resourceType: "tenant",
            resourceId: tenantId,
            outcome: res.statusCode < 400 ? "success" : "failed",
            statusCode: res.statusCode,
          });

          const value = data as { name?: string; tier?: string };
          await auditLogService.logAudit({
            ...auditInput,
            details: {
              operation,
              tenantName: req.body.name || value?.name,
              tier: req.body.tier || value?.tier,
            },
          });
        } catch (error) {
          logger.error("Failed to log tenant provisioning audit", error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

export function auditSettingsChange(settingsType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function (data: unknown) {
      setImmediate(async () => {
        try {
          const auditInput = buildValidatedAuditInput(req, {
            actionType: "settings_change",
            resourceType: settingsType,
            resourceId: req.params.id || "global",
            outcome: res.statusCode < 400 ? "success" : "failed",
            statusCode: res.statusCode,
          });

          await auditLogService.logAudit({
            ...auditInput,
            details: { changedFields: Object.keys(req.body ?? {}) },
          });
        } catch (error) {
          logger.error("Failed to log settings change audit", error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

export function auditOperation(
  action: string,
  resourceType: string,
  getResourceId?: (req: Request) => string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const resourceId = getResourceId ? getResourceId(req) : req.params.id || "unknown";
    const originalJson = res.json;

    res.json = function (data: unknown) {
      setImmediate(async () => {
        try {
          const auditInput = buildValidatedAuditInput(req, {
            actionType: action,
            resourceType,
            resourceId,
            outcome: res.statusCode < 400 ? "success" : "failed",
            statusCode: res.statusCode,
          });

          await auditLogService.logAudit({
            ...auditInput,
            details: { method: req.method, path: req.path },
          });
        } catch (error) {
          logger.error("Failed to log audit", error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}
