/**
 * Teams API Endpoints
 *
 * Implements team management for the frontend.
 * Maps 1:1 with tenant user management but exposed via /api/teams/:tenantId/...
 */

import { createLogger } from "@shared/lib/logger";
import { sanitizeForLogging } from "@shared/lib/piiFilter";
import { Request, Response } from "express";

import { auditBulkDelete, auditOperation, auditRoleAssignment } from "../middleware/auditHooks.js"
import { AUDIT_ACTION } from "../types/audit.js"
import { requireAuth } from "../middleware/auth.js"
import { validateRequest, ValidationSchemas } from "../middleware/inputValidation.js"
import { requirePermission } from "../middleware/rbac.js"
import { createSecureRouter } from "../middleware/secureRouter.js"
import { tenantContextMiddleware } from "../middleware/tenantContext.js"
import { adminUserService } from "../services/AdminUserService.js"

const logger = createLogger({ component: "TeamsAPI" });
const router = createSecureRouter("strict");

/**
 * GET /:tenantId/members
 * Fetch all team members and invites.
 */
router.get(
  "/:tenantId/members",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("users.read"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string;

      const users = await adminUserService.listTenantUsers(tenantId);

      const members = users
        .filter((u) => u.status !== "invited")
        .map((u) => ({
          id: u.id,
          userId: u.id,
          email: u.email,
          fullName: u.fullName,
          role: u.role.toLowerCase(),
          status: u.status,
          joinedAt: u.createdAt,
        }));

      const invites = users
        .filter((u) => u.status === "invited")
        .map((u) => ({
          id: u.id, // User ID as invite ID for simplicity
          email: u.email,
          role: u.role.toLowerCase(),
          invitedBy: "Unknown", // Backend doesn't provide this yet
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Mock expiry
          createdAt: u.createdAt,
        }));

      res.json({ members, invites });
    } catch (error) {
      logger.error("Failed to fetch team members", error instanceof Error ? error : undefined, {
        tenantId: req.params.tenantId, // Use params for logging if middleware failed
      });
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  }
);

/**
 * POST /:tenantId/invites
 * Invite a new member.
 */
router.post(
  "/:tenantId/invites",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("users.invite"),
  auditOperation(AUDIT_ACTION.DATA_CREATE, "team_member", (req) => req.params.tenantId),
  validateRequest(ValidationSchemas.adminInviteUser),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string;
      const actor = (req as any).user;
      const actorName =
        actor?.user_metadata?.full_name ||
        actor?.user_metadata?.name ||
        actor?.email ||
        "Admin User";

      const result = await adminUserService.inviteUserToTenant(
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

      // Return as invite shape
      const invite = {
        id: result.id,
        email: result.email,
        role: result.role.toLowerCase(),
        invitedBy: actorName,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: result.createdAt,
      };

      res.status(201).json(invite);
    } catch (error) {
      logger.error("Failed to invite user", error instanceof Error ? error : undefined, {
        tenantId: req.params.tenantId,
        email: sanitizeForLogging(req.body.email),
      });
      res.status(500).json({ error: "Failed to invite user" });
    }
  }
);

/**
 * PATCH /:tenantId/members/:userId
 * Update a member's role.
 */
router.patch(
  "/:tenantId/members/:userId",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("roles.assign"),
  auditRoleAssignment(),
  validateRequest(ValidationSchemas.adminChangeRole),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string;
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
      logger.error("Failed to update role", error instanceof Error ? error : undefined, {
        tenantId: req.params.tenantId,
        userId: req.params.userId,
      });
      res.status(500).json({ error: "Failed to update role" });
    }
  }
);

/**
 * DELETE /:tenantId/members/:userId
 * Remove a member.
 */
router.delete(
  "/:tenantId/members/:userId",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("users.delete"),
  auditBulkDelete("team_member"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string;
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

      res.json({ message: "Member removed" });
    } catch (error) {
      logger.error("Failed to remove member", error instanceof Error ? error : undefined, {
        tenantId: req.params.tenantId,
        userId: req.params.userId,
      });
      res.status(500).json({ error: "Failed to remove member" });
    }
  }
);

/**
 * DELETE /:tenantId/invites/:userId
 * Cancel an invite (removes the user).
 */
router.delete(
  "/:tenantId/invites/:userId",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("users.delete"),
  auditOperation(AUDIT_ACTION.DATA_DELETE, "team_invite", (req) => req.params.userId),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as string;
      const actor = (req as any).user;
      const actorName =
        actor?.user_metadata?.full_name ||
        actor?.user_metadata?.name ||
        actor?.email ||
        "Admin User";

      // Cancelling an invite is effectively removing the user from the tenant
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

      res.json({ message: "Invite cancelled" });
    } catch (error) {
      logger.error("Failed to cancel invite", error instanceof Error ? error : undefined, {
        tenantId: req.params.tenantId,
        userId: req.params.userId,
      });
      res.status(500).json({ error: "Failed to cancel invite" });
    }
  }
);

export default router;
