/**
 * Domain Packs API
 *
 * REST endpoints for listing domain packs, getting merged context,
 * setting a pack on a value case, and hardening ghost KPIs.
 */

import { Request, Response, Router } from "express";
import { z } from "zod";
import { supabase } from "@shared/lib/supabase";
import { createLogger } from "@shared/lib/logger";
import { securityHeadersMiddleware } from "../middleware/securityMiddleware.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { DomainPackService } from "../services/domain-packs/index.js";

const logger = createLogger({ component: "DomainPacksAPI" });
const router = Router();

router.use(securityHeadersMiddleware);
router.use(requireAuth);
router.use(tenantContextMiddleware());

const service = new DomainPackService(supabase);

// ============================================================================
// GET /api/v1/domain-packs — List available packs
// ============================================================================

router.get("/", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    const packs = await service.listPacks(tenantId);
    return res.json({ packs });
  } catch (err) {
    logger.error("Failed to list domain packs", err instanceof Error ? err : undefined);
    return res.status(500).json({ error: "Failed to list domain packs" });
  }
});

// ============================================================================
// GET /api/v1/domain-packs/:packId — Get pack with layers
// ============================================================================

router.get("/:packId", async (req: Request, res: Response) => {
  try {
    const { packId } = req.params;
    const result = await service.getPackWithLayers(packId);
    return res.json(result);
  } catch (err) {
    logger.error("Failed to get domain pack", err instanceof Error ? err : undefined);
    return res.status(404).json({ error: "Domain pack not found" });
  }
});

// ============================================================================
// POST /api/v1/value-cases/:caseId/set-pack — Set domain pack for a case
// ============================================================================

const SetPackSchema = z.object({
  packId: z.string().uuid(),
});

router.post("/value-cases/:caseId/set-pack", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    const { caseId } = req.params;
    const body = SetPackSchema.parse(req.body);

    await service.setPackForCase(caseId, body.packId, tenantId);
    return res.json({ success: true, caseId, packId: body.packId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: err.errors });
    }
    logger.error("Failed to set domain pack", err instanceof Error ? err : undefined);
    return res.status(500).json({ error: "Failed to set domain pack" });
  }
});

// ============================================================================
// GET /api/v1/value-cases/:caseId/merged-context — Get resolved context
// ============================================================================

router.get("/value-cases/:caseId/merged-context", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    const { caseId } = req.params;
    const merged = await service.getMergedContext(caseId, tenantId);
    return res.json(merged);
  } catch (err) {
    logger.error("Failed to get merged context", err instanceof Error ? err : undefined);
    return res.status(500).json({ error: "Failed to get merged context" });
  }
});

// ============================================================================
// POST /api/v1/value-cases/:caseId/harden-kpi — Harden a single ghost KPI
// ============================================================================

const HardenKPISchema = z.object({
  kpiKey: z.string(),
  baselineValue: z.number().optional(),
  targetValue: z.number().optional(),
});

router.post("/value-cases/:caseId/harden-kpi", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    const { caseId } = req.params;
    const body = HardenKPISchema.parse(req.body);

    await service.hardenKPI(caseId, body.kpiKey, {
      baseline_value: body.baselineValue,
      target_value: body.targetValue,
    }, tenantId);

    return res.json({ success: true, caseId, kpiKey: body.kpiKey });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: err.errors });
    }
    logger.error("Failed to harden KPI", err instanceof Error ? err : undefined);
    return res.status(500).json({ error: "Failed to harden KPI" });
  }
});

// ============================================================================
// POST /api/v1/value-cases/:caseId/harden-all-kpis — Bulk-harden ghost KPIs
// ============================================================================

router.post("/value-cases/:caseId/harden-all-kpis", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    const { caseId } = req.params;
    const count = await service.hardenAllKPIs(caseId, tenantId);
    return res.json({ success: true, caseId, hardenedCount: count });
  } catch (err) {
    logger.error("Failed to bulk-harden KPIs", err instanceof Error ? err : undefined);
    return res.status(500).json({ error: "Failed to bulk-harden KPIs" });
  }
});

export default router;
