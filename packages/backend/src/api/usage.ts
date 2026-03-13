import { createLogger } from "@shared/lib/logger";
import { Request, Response } from "express";
import { z } from "zod";

import { auditOperation } from "../middleware/auditHooks.js";
import { AUDIT_ACTION } from "../types/audit.js";
import { requireAuth } from "../middleware/auth.js";
import { createSecureRouter } from "../middleware/secureRouter.js";
import { persistTenantUsage } from "../services/billing/UsagePersistenceService.js";

const UsagePersistSchema = z.object({
  organization_id: z.string().uuid(),
  period: z.string().min(1).max(20),
  users: z.number().int().nonnegative(),
  teams: z.number().int().nonnegative(),
  projects: z.number().int().nonnegative(),
  storage: z.number().nonnegative(),
  api_calls: z.number().int().nonnegative(),
  agent_calls: z.number().int().nonnegative(),
  last_updated: z.string().datetime(),
});

type UsagePersistRequestBody = z.infer<typeof UsagePersistSchema>;

const logger = createLogger({ component: "UsageAPI" });
export const usageRouter = createSecureRouter("standard");

usageRouter.post(
  "/persist",
  requireAuth,
  auditOperation(
    AUDIT_ACTION.DATA_UPDATE,
    "tenant_usage",
    (req) => (req.body as { organization_id?: string })?.organization_id ?? "unknown",
  ),
  async (req: Request, res: Response) => {
    const parsed = UsagePersistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    }

    const body: UsagePersistRequestBody = parsed.data;
    const tenantId = (req as { tenantId?: string }).tenantId;

    if (!tenantId) {
      return res.status(403).json({ error: "Tenant context required" });
    }

    if (body.organization_id !== tenantId) {
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
  },
);
