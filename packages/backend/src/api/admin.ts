/**
 * Admin API Endpoints
 *
 * Tenant user administration with RBAC enforcement.
 */

import { Request, Response } from "express";
import { createSecureRouter } from "../middleware/secureRouter.js"
import { requireAuth } from "../middleware/auth.js"
import { tenantContextMiddleware } from "../middleware/tenantContext.js"
import { tenantDbContextMiddleware } from "../middleware/tenantDbContext.js"
import { requireAllPermissions, requirePermission } from "../middleware/rbac.js"
import { validateRequest, ValidationSchemas } from "../middleware/inputValidation.js"
import { adminUserService } from "../services/AdminUserService.js"
import { adminRoleService } from "../services/AdminRoleService.js"
import { auditLogService } from "../services/AuditLogService.js"
import { createLogger } from "@shared/lib/logger";
import { sanitizeForLogging } from "@shared/lib/piiFilter";

const logger = createLogger({ component: "AdminAPI" });
const router = createSecureRouter("strict");

router.use(requireAuth, tenantContextMiddleware(), tenantDbContextMiddleware());

router.get("/audit-logs", requirePermission("users.read"), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
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

    res.json({ logs });
  } catch (error) {
    logger.error("Failed to fetch audit logs", sanitizeForLogging(error));
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.get("/users", requirePermission("users.read"), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    const users = await adminUserService.listTenantUsers(tenantId);
    res.json({ users });
  } catch (error) {
    logger.error("Failed to list tenant users", sanitizeForLogging(error));
    res.status(500).json({ error: "Failed to load users" });
  }
});

router.post(
  "/users/invite",
  requireAllPermissions("users.invite", "roles.assign"),
  validateRequest(ValidationSchemas.adminInviteUser),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = (req as any).user;
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

      res.status(201).json({ user });
    } catch (error) {
      logger.error("Failed to invite user", sanitizeForLogging(error));
      res.status(500).json({ error: "Failed to invite user" });
    }
  }
);

router.patch(
  "/users/:userId/role",
  requirePermission("roles.assign"),
  validateRequest(ValidationSchemas.adminChangeRole),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = (req as any).user;
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
          userId: req.params.userId,
          role: req.body.role,
          tenantId,
        }
      );

      res.json({ message: "Role updated" });
    } catch (error) {
      logger.error("Failed to update role", sanitizeForLogging(error));
      res.status(500).json({ error: "Failed to update role" });
    }
  }
);

router.delete(
  "/users/:userId",
  requirePermission("users.delete"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = (req as any).user;
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
          userId: req.params.userId,
          tenantId,
        }
      );

      res.json({ message: "User removed" });
    } catch (error) {
      logger.error("Failed to remove user", sanitizeForLogging(error));
      res.status(500).json({ error: "Failed to remove user" });
    }
  }
);

router.post(
  "/roles",
  requirePermission("roles.assign"),
  validateRequest(ValidationSchemas.adminCustomRoleUpsert),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = (req as any).user;
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

      res.status(201).json({ role });
    } catch (error) {
      logger.error("Failed to create custom role", sanitizeForLogging(error));
      res.status(500).json({ error: "Failed to create role" });
    }
  }
);

router.patch(
  "/roles/:roleId",
  requirePermission("roles.assign"),
  validateRequest(ValidationSchemas.adminCustomRoleUpsert),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = (req as any).user;
      const actorName = actor?.user_metadata?.full_name || actor?.user_metadata?.name || actor?.email || "Admin User";

      const role = await adminRoleService.updateCustomRole(
        { id: actor.id, email: actor.email, name: actorName },
        req.params.roleId,
        {
          tenantId,
          name: req.body.name,
          description: req.body.description,
        }
      );

      res.json({ role });
    } catch (error) {
      logger.error("Failed to update custom role", sanitizeForLogging(error));
      res.status(500).json({ error: "Failed to update role" });
    }
  }
);

router.delete(
  "/roles/:roleId",
  requirePermission("roles.assign"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = (req as any).user;
      const actorName = actor?.user_metadata?.full_name || actor?.user_metadata?.name || actor?.email || "Admin User";

      await adminRoleService.deleteCustomRole(
        { id: actor.id, email: actor.email, name: actorName },
        tenantId,
        req.params.roleId
      );

      res.json({ message: "Role deleted" });
    } catch (error) {
      logger.error("Failed to delete custom role", sanitizeForLogging(error));
      res.status(500).json({ error: "Failed to delete role" });
    }
  }
);

router.get("/roles/matrix", requirePermission("users.read"), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    const matrix = await adminRoleService.listRolePermissionMatrix(tenantId);
    res.json({ matrix });
  } catch (error) {
    logger.error("Failed to list role permission matrix", sanitizeForLogging(error));
    res.status(500).json({ error: "Failed to list role matrix" });
  }
});

router.post(
  "/roles/:roleId/permissions",
  requirePermission("roles.assign"),
  validateRequest(ValidationSchemas.adminRolePermissionMutation),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = (req as any).user;
      const actorName = actor?.user_metadata?.full_name || actor?.user_metadata?.name || actor?.email || "Admin User";

      await adminRoleService.assignPermissionsToRole(
        { id: actor.id, email: actor.email, name: actorName },
        {
          tenantId,
          roleId: req.params.roleId,
          permissionKeys: req.body.permissionKeys,
        }
      );

      res.status(204).send();
    } catch (error) {
      logger.error("Failed to assign permissions", sanitizeForLogging(error));
      res.status(500).json({ error: "Failed to assign permissions" });
    }
  }
);

router.delete(
  "/roles/:roleId/permissions",
  requirePermission("roles.assign"),
  validateRequest(ValidationSchemas.adminRolePermissionMutation),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string | undefined;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const actor = (req as any).user;
      const actorName = actor?.user_metadata?.full_name || actor?.user_metadata?.name || actor?.email || "Admin User";

      await adminRoleService.removePermissionsFromRole(
        { id: actor.id, email: actor.email, name: actorName },
        {
          tenantId,
          roleId: req.params.roleId,
          permissionKeys: req.body.permissionKeys,
        }
      );

      res.status(204).send();
    } catch (error) {
      logger.error("Failed to remove permissions", sanitizeForLogging(error));
      res.status(500).json({ error: "Failed to remove permissions" });
    }
  }
);

export default router;
