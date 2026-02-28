import { createLogger } from "@shared/lib/logger";
import { Request, Response } from "express";

import { requireAuth } from "../middleware/auth.js";
import { createSecureRouter } from "../middleware/secureRouter.js";
import { persistTenantUsage } from "../services/UsagePersistenceService.js";

interface UsagePersistRequestBody {
  organization_id: string;
  period: string;
  users: number;
  teams: number;
  projects: number;
  storage: number;
  api_calls: number;
  agent_calls: number;
  last_updated: string;
}

const logger = createLogger({ component: "UsageAPI" });
export const usageRouter = createSecureRouter("standard");

usageRouter.post("/persist", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as UsagePersistRequestBody;
  const tenantId = (req as { tenantId?: string }).tenantId;

  if (!tenantId) {
    return res.status(403).json({ error: "Tenant context required" });
  }

  if (!body.organization_id || body.organization_id !== tenantId) {
    return res.status(403).json({ error: "Cross-tenant usage persistence is forbidden" });
  }

  try {
    await persistTenantUsage(body);
    return res.status(202).json({ success: true });
  } catch (error) {
    logger.error("Usage persistence failed", error instanceof Error ? error : undefined, {
      organizationId: body.organization_id,
      tenantId,
    });
    return res.status(500).json({ error: "Failed to persist usage" });
  }
});

