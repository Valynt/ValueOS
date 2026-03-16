/**
 * Agent Admin API
 *
 * GET  /api/admin/agents            — list all agents with kill-switch status
 * POST /api/admin/agents/:name/kill-switch — enable or disable an agent
 *
 * Requires system.admin permission (same as other /api/admin routes).
 */

import { Router, Request, Response } from "express";
import { agentKillSwitchService } from "../services/agents/AgentKillSwitchService.js";
import { requirePermission } from "../middleware/rbac.js";
import { logger } from "../lib/logger.js";

const agentAdminRouter = Router();

// GET /api/admin/agents
agentAdminRouter.get(
  "/",
  requirePermission("system.admin"),
  async (_req: Request, res: Response) => {
    try {
      const agents = await agentKillSwitchService.listAll();
      res.json({ agents });
    } catch (err) {
      logger.error("agentAdmin: listAll failed", { err });
      res.status(500).json({ error: "Failed to list agents" });
    }
  },
);

// POST /api/admin/agents/:name/kill-switch
agentAdminRouter.post(
  "/:name/kill-switch",
  requirePermission("system.admin"),
  async (req: Request, res: Response) => {
    const { name } = req.params;
    const { killed } = req.body as { killed?: unknown };

    if (typeof killed !== "boolean") {
      res.status(400).json({ error: '"killed" must be a boolean' });
      return;
    }

    try {
      await agentKillSwitchService.setKilled(name, killed);
      res.json({ name, killed });
    } catch (err) {
      logger.error("agentAdmin: setKilled failed", { name, err });
      res.status(500).json({ error: "Failed to update kill switch" });
    }
  },
);

export { agentAdminRouter };
