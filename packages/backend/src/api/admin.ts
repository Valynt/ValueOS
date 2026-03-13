/**
 * Admin API Endpoints
 *
 * Tenant user administration with RBAC enforcement.
 */

import { createLogger } from "@shared/lib/logger";
import { sanitizeForLogging } from "@shared/lib/piiFilter";
import { Request, Response } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js"
import { validateRequest, ValidationSchemas } from "../middleware/inputValidation.js"
import { requireAllPermissions, requirePermission } from "../middleware/rbac.js"
import { createSecureRouter } from "../middleware/secureRouter.js"
import { tenantContextMiddleware } from "../middleware/tenantContext.js"
import { tenantDbContextMiddleware } from "../middleware/tenantDbContext.js"
import { adminRoleService } from "../services/AdminRoleService.js"
import { adminUserService } from "../services/AdminUserService.js"
import { auditLogService } from "../services/AuditLogService.js"
import { tokenReEncryptionJob } from "../services/crm/TokenReEncryptionJob.js"
import { provisionTenant, TenantTier } from "../services/TenantProvisioning.js"
import { tenantDeletionService } from "../services/tenant/TenantDeletionService.js"

const logger = createLogger({ component: "AdminAPI" });
const router = createSecureRouter("strict");

const provisionTenantSchema = z.object({
  name: z.string().min(2).max(120),
  tier: z.enum(["free", "starter", "professional", "enterprise"] as const satisfies readonly [TenantTier, ...TenantTier[]]),
  ownerEmail: z.string().email(),
  // ownerId is intentionally excluded — it is always derived from the authenticated
  // user to prevent privilege escalation via the request body.
});

// POST /api/admin/provision — Create a new tenant (called from CreateOrganization UI).
// Does not require an existing tenant context — the user is creating their first one.
router.post(
  "/provision",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const actor = req.user;
      if (!actor?.id || !actor?.email) {
        return res.status(401).json({ error: "Authenticated user required" });
      }

      const parsed = provisionTenantSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { name, tier, ownerEmail } = parsed.data;

      const result = await provisionTenant({
        organizationId: "",
        name,
        tier,
        // Always use the authenticated user's ID — never trust ownerId from the request body.
        ownerId: actor.id,
        ownerEmail,
      });

      if (!result.success) {
        return res.status(422).json({ error: result.errors.join("; "), errors: result.errors });
      }
      return res.status(201).json({ organizationId: result.organizationId });
    } catch (err) {
      logger.error("Tenant provisioning failed", err instanceof Error ? err : undefined);
      return res.status(500).json({ error: "Provisioning failed" });
    }
  }
);

router.use(requireAuth, tenantContextMiddleware(), tenantDbContextMiddleware());

router.get("/audit-logs", requirePermission("audit.read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    const {
      userId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      status,
      limit,
      offset,
    } = req.query;

    const logs = await auditLogService.query({
      tenantId,
      userId: userId as string,
      action: action as string | string[],
      resourceType: resourceType as string | string[],
      resourceId: resourceId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as "success" | "failed",
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    await auditLogService.logAudit({
      userId: req.user.id,
      userName: req.user.email ?? "unknown",
      userEmail: req.user.email ?? "",
      action: "audit.logs.query",
      resourceType: "audit_logs",
      resourceId: tenantId,
      details: {
        endpoint: "/api/admin/audit-logs",
        filters: { userId, action, resourceType, resourceId, startDate, endDate, status, limit, offset },
      },
      status: "success",
    });

    return res.json({ logs });
  } catch (error) {
    logger.error("Failed to fetch audit logs", error instanceof Error ? error : undefined);
    return res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.get("/users", requirePermission("users.read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    const users = await adminUserService.listTenantUsers(tenantId);
    return res.json({ users });
  } catch (error) {
    logger.error("Failed to list tenant users", error instanceof Error ? error : undefined);
    return res.status(500).json({ error: "Failed to load users" });
  }
});

router.post(
  "/users/invite",
  requireAllPermissions("users.invite", "roles.assign"),
  validateRequest(ValidationSchemas.adminInviteUser),
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = req.user;
      const actorName =
        actor?.user_metadata?.full_name ||
        actor?.user_metadata?.name ||
        actor?.email ||
        "Admin User";

      const user = await adminUserService.inviteUserToTenant(
        {
          id: actor.id,
          email: actor.email,
          name: actorName,
        },
        {
          email: req.body.email,
          role: req.body.role,
          tenantId,
        }
      );

      return res.status(201).json({ user });
    } catch (error) {
      logger.error("Failed to invite user", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Failed to invite user" });
    }
  }
);

router.patch(
  "/users/:userId/role",
  requirePermission("roles.assign"),
  validateRequest(ValidationSchemas.adminChangeRole),
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = req.user;
      const actorName =
        actor?.user_metadata?.full_name ||
        actor?.user_metadata?.name ||
        actor?.email ||
        "Admin User";

      await adminUserService.updateUserRole(
        {
          id: actor.id,
          email: actor.email,
          name: actorName,
        },
        {
          userId: req.params.userId!,
          role: req.body.role,
          tenantId,
        }
      );

      return res.json({ message: "Role updated" });
    } catch (error) {
      if (error instanceof Error && error.name === "ValidationError") {
        return res.status(409).json({ error: error.message });
      }
      logger.error("Failed to update role", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Failed to update role" });
    }
  }
);

router.delete(
  "/users/:userId",
  requirePermission("users.delete"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = req.user;
      const actorName =
        actor?.user_metadata?.full_name ||
        actor?.user_metadata?.name ||
        actor?.email ||
        "Admin User";

      await adminUserService.removeUserFromTenant(
        {
          id: actor.id,
          email: actor.email,
          name: actorName,
        },
        {
          userId: req.params.userId!,
          tenantId,
        }
      );

      return res.json({ message: "User removed" });
    } catch (error) {
      if (error instanceof Error && error.name === "ValidationError") {
        return res.status(409).json({ error: error.message });
      }
      logger.error("Failed to remove user", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Failed to remove user" });
    }
  }
);

const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid(),
});

router.post(
  "/transfer-ownership",
  requirePermission("owner.transfer"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const parsed = transferOwnershipSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const actor = req.user;
      const actorName =
        actor?.user_metadata?.full_name ||
        actor?.user_metadata?.name ||
        actor?.email ||
        "Admin User";

      await adminUserService.transferOwnership(
        { id: actor.id, email: actor.email, name: actorName },
        { newOwnerId: parsed.data.newOwnerId, tenantId },
      );

      return res.json({ message: "Ownership transferred" });
    } catch (error) {
      if (error instanceof Error && error.name === "ValidationError") {
        return res.status(409).json({ error: error.message });
      }
      logger.error("Failed to transfer ownership", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Failed to transfer ownership" });
    }
  }
);

router.post(
  "/roles",
  requirePermission("roles.assign"),
  validateRequest(ValidationSchemas.adminCustomRoleUpsert),
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = req.user;
      const actorName = actor?.user_metadata?.full_name || actor?.user_metadata?.name || actor?.email || "Admin User";

      const role = await adminRoleService.createCustomRole(
        { id: actor.id, email: actor.email, name: actorName },
        {
          tenantId,
          name: req.body.name,
          description: req.body.description,
          permissionKeys: req.body.permissionKeys || [],
        }
      );

      return res.status(201).json({ role });
    } catch (error) {
      logger.error("Failed to create custom role", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Failed to create role" });
    }
  }
);

router.patch(
  "/roles/:roleId",
  requirePermission("roles.assign"),
  validateRequest(ValidationSchemas.adminCustomRoleUpsert),
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = req.user;
      const actorName = actor?.user_metadata?.full_name || actor?.user_metadata?.name || actor?.email || "Admin User";

      const role = await adminRoleService.updateCustomRole(
        { id: actor.id, email: actor.email, name: actorName },
        req.params.roleId!,
        {
          tenantId,
          name: req.body.name,
          description: req.body.description,
        }
      );

      return res.json({ role });
    } catch (error) {
      logger.error("Failed to update custom role", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Failed to update role" });
    }
  }
);

router.delete(
  "/roles/:roleId",
  requirePermission("roles.assign"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = req.user;
      const actorName = actor?.user_metadata?.full_name || actor?.user_metadata?.name || actor?.email || "Admin User";

      await adminRoleService.deleteCustomRole(
        { id: actor.id, email: actor.email, name: actorName },
        tenantId,
        req.params.roleId!
      );

      return res.json({ message: "Role deleted" });
    } catch (error) {
      logger.error("Failed to delete custom role", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Failed to delete role" });
    }
  }
);

router.get("/roles/matrix", requirePermission("users.read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    const matrix = await adminRoleService.listRolePermissionMatrix(tenantId);
    return res.json({ matrix });
  } catch (error) {
    logger.error("Failed to list role permission matrix", error instanceof Error ? error : undefined);
    return res.status(500).json({ error: "Failed to list role matrix" });
  }
});

router.post(
  "/roles/:roleId/permissions",
  requirePermission("roles.assign"),
  validateRequest(ValidationSchemas.adminRolePermissionMutation),
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = req.user;
      const actorName = actor?.user_metadata?.full_name || actor?.user_metadata?.name || actor?.email || "Admin User";

      await adminRoleService.assignPermissionsToRole(
        { id: actor.id, email: actor.email, name: actorName },
        {
          tenantId,
          roleId: req.params.roleId!,
          permissionKeys: req.body.permissionKeys,
        }
      );

      return res.status(204).send();
    } catch (error) {
      logger.error("Failed to assign permissions", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Failed to assign permissions" });
    }
  }
);

router.delete(
  "/roles/:roleId/permissions",
  requirePermission("roles.assign"),
  validateRequest(ValidationSchemas.adminRolePermissionMutation),
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = req.user;
      const actorName = actor?.user_metadata?.full_name || actor?.user_metadata?.name || actor?.email || "Admin User";

      await adminRoleService.removePermissionsFromRole(
        { id: actor.id, email: actor.email, name: actorName },
        {
          tenantId,
          roleId: req.params.roleId!,
          permissionKeys: req.body.permissionKeys,
        }
      );

      return res.status(204).send();
    } catch (error) {
      logger.error("Failed to remove permissions", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Failed to remove permissions" });
    }
  }
);

// ── Tenant deletion ───────────────────────────────────────────────────────────

/**
 * POST /admin/tenants/:tenantId/delete
 * Phase 1: Initiate soft delete. Marks tenant pending_deletion, cancels billing.
 * Body: { reason: string }
 */
router.post(
  "/tenants/:tenantId/delete",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("system.admin"),
  async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    const { reason } = req.body as { reason?: string };
    const requestedBy = (req as unknown as { userId?: string }).userId ?? "unknown";

    if (!reason) return res.status(400).json({ error: "reason is required" });

    try {
      const result = await tenantDeletionService.initiateSoftDelete(tenantId, requestedBy, reason);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error("Admin: tenant soft-delete failed", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Soft-delete failed" });
    }
  }
);

/**
 * POST /admin/tenants/:tenantId/export
 * Phase 2: Export all tenant data. Returns the export archive as JSON.
 */
router.post(
  "/tenants/:tenantId/export",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("system.admin"),
  async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    try {
      const exportData = await tenantDeletionService.exportTenantData(tenantId);
      return res.status(200).json(exportData);
    } catch (error) {
      logger.error("Admin: tenant export failed", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Export failed" });
    }
  }
);

/**
 * POST /admin/tenants/:tenantId/hard-delete
 * Phase 3: Permanently delete all tenant data. Requires export to be complete
 * and the soft-delete window to have elapsed.
 */
router.post(
  "/tenants/:tenantId/hard-delete",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("system.admin"),
  async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    try {
      const result = await tenantDeletionService.hardDelete(tenantId);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error("Admin: tenant hard-delete failed", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Hard-delete failed" });
    }
  }
);

/**
 * POST /admin/tenants/process-scheduled-deletions
 * Cron-triggered: hard-delete all tenants whose soft-delete window has elapsed.
 */
router.post(
  "/tenants/process-scheduled-deletions",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("system.admin"),
  async (_req: Request, res: Response) => {
    try {
      const result = await tenantDeletionService.processScheduledDeletions();
      return res.status(200).json(result);
    } catch (error) {
      logger.error("Admin: scheduled deletions failed", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Scheduled deletion job failed" });
    }
  }
);

// ── Key rotation ─────────────────────────────────────────────────────────────

/**
 * POST /admin/crm/re-encrypt-tokens
 *
 * Triggers the CRM token re-encryption job. Run this after rotating
 * CRM_TOKEN_KEY_VERSION to re-encrypt existing rows under the new key.
 *
 * Requires: system.admin permission.
 * Returns: { processed, reEncrypted, skipped, errors }
 */
router.post(
  "/crm/re-encrypt-tokens",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("system.admin"),
  async (_req: Request, res: Response) => {
    try {
      logger.info("Admin: CRM token re-encryption job triggered");
      const result = await tokenReEncryptionJob.run();
      return res.status(200).json(result);
    } catch (error) {
      logger.error("Admin: CRM token re-encryption job failed", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Re-encryption job failed" });
    }
  }
);

export default router;
