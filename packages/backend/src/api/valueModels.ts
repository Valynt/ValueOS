import { Request, Response, Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { ValueModelScenariosRepository } from "./valueModels/repository.js";
import { ValueModelScenariosService } from "./valueModels/service.js";

const router = Router();

const scenarioUpsertSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  assumptions: z.array(
    z.object({
      key: z.string().min(1),
      value: z.number(),
      unit: z.string().optional(),
    })
  ).min(1),
  /** Investment cost in USD. Required unless an 'implementation_cost' assumption is present. */
  estimatedCostUsd: z.number().positive().optional(),
  /** Benefit realization horizon in years (integer 1–30). Defaults to 3. */
  timelineYears: z.number().int().min(1).max(30).optional(),
  /** Discount rate as decimal (e.g. 0.10). Defaults to 0.10. */
  discountRate: z.number().min(0).max(1).optional(),
});

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new Error("Tenant context required");
  }
  return tenantId;
}

router.use(requireAuth, tenantContextMiddleware());

router.get("/:modelId/scenarios", requirePermission("content.read"), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ValueModelScenariosService(ValueModelScenariosRepository.fromRequest(req));
    const scenarios = await service.list({ organizationId: tenantId, modelId: req.params.modelId });
    return res.json({ scenarios });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch scenarios" });
  }
});

router.post("/:modelId/scenarios", requirePermission("content.write"), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const parsed = scenarioUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid scenario payload", details: parsed.error.flatten() });
    }

    const service = new ValueModelScenariosService(ValueModelScenariosRepository.fromRequest(req));
    const scenario = await service.create({
      organizationId: tenantId,
      modelId: req.params.modelId,
      ...parsed.data,
    });

    return res.status(201).json({ scenario });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create scenario" });
  }
});

export { router as valueModelsRouter };
