import { Request, Response, Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";

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
});

interface StoredScenario {
  id: string;
  name: string;
  description?: string;
  assumptions: Array<{ key: string; value: number; unit?: string }>;
  roiPercent: number;
  paybackMonths: number;
  annualSavings: number;
  updatedAt: string;
}

const scenarioStore = new Map<string, StoredScenario[]>();

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new Error("Tenant context required");
  return tenantId;
}

function keyFor(tenantId: string, modelId: string): string {
  return `${tenantId}:${modelId}`;
}

router.use(requireAuth, tenantContextMiddleware());

router.get("/:modelId/scenarios", requirePermission("content.read"), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const key = keyFor(tenantId, req.params.modelId);
    const scenarios = scenarioStore.get(key) ?? [];
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

    const key = keyFor(tenantId, req.params.modelId);
    const current = scenarioStore.get(key) ?? [];

    const annualSavings = parsed.data.assumptions.reduce((sum, assumption) => sum + assumption.value, 0);
    const roiPercent = Math.max(0, Math.round(annualSavings / 10000));
    const paybackMonths = Math.max(1, Math.round(36 - Math.min(30, roiPercent / 5)));

    const scenario: StoredScenario = {
      id: `scenario_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: parsed.data.name,
      description: parsed.data.description,
      assumptions: parsed.data.assumptions,
      annualSavings,
      roiPercent,
      paybackMonths,
      updatedAt: new Date().toISOString(),
    };

    scenarioStore.set(key, [scenario, ...current]);
    return res.status(201).json({ scenario });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create scenario" });
  }
});

export default router;
