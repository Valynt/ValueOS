/**
 * Admin API Endpoints
 *
 * Tenant user administration with RBAC enforcement.
 */

import { Request, Response } from "express";
import { createSecureRouter } from "../middleware/secureRouter";
import { requireAuth } from "../middleware/auth";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import { requireAllPermissions, requirePermission } from "../middleware/rbac";
import { validateRequest, ValidationSchemas } from "../middleware/inputValidation";
import { adminUserService } from "../services/AdminUserService";
import { invitationsService } from "../services/InvitationsService";
import { createLogger } from "../lib/logger";
import { sanitizeForLogging } from "../lib/piiFilter";

const logger = createLogger({ component: "AdminAPI" });
const router = createSecureRouter("strict");

router.use(requireAuth, tenantContextMiddleware());

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

// New: server-side invitations table API
router.post(
  "/invitations",
  requireAllPermissions("users.invite", "roles.assign"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string | undefined;
      if (!tenantId) return res.status(400).json({ error: "Tenant ID required" });

      const actor = (req as any).user;
      const invitedBy = actor?.id;

      const { email, role } = req.body;
      if (!email || !role) return res.status(400).json({ error: "email and role required" });

      const invite = await invitationsService.createInvite({ tenantId, email, role, invitedBy });
      res.status(201).json({ invite });
    } catch (error) {
      logger.error("Failed to create invitation", sanitizeForLogging(error));
      res.status(500).json({ error: "Failed to create invitation" });
    }
  }
);

router.post(
  "/invitations/:invitationId/resend",
  requirePermission("users.invite"),
  async (req: Request, res: Response) => {
    try {
      const invitationId = req.params.invitationId;
      if (!invitationId) return res.status(400).json({ error: "invitationId required" });

      const invite = await invitationsService.resendInvite(invitationId);
      res.json({ invite });
    } catch (error) {
      logger.error("Failed to resend invitation", sanitizeForLogging(error));
      res.status(500).json({ error: "Failed to resend invitation" });
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

export default router;
