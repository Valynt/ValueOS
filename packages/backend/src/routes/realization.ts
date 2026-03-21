/**
 * Realization API Routes (FIXED)
 *
 * Key fixes:
 * - Resolved merge conflicts
 * - Enforced authentication consistently
 * - Enforced tenant context validation centrally
 * - Removed silent fallbacks ("?? ''")
 * - Standardized error handling
 */

import { Request, Response, Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import { RealizationService } from "../services/realization/RealizationService.js";

const router: Router = Router();
const realizationService = new RealizationService();

const requireTenantAccess = tenantContextMiddleware(true);

const ensureTenantId = (req: Request, res: Response): string | null => {
  const organizationId = req.tenantId;

  if (!organizationId) {
    res.status(400).json({
      success: false,
      error: { message: "Tenant context is required." },
    });
    return null;
  }

  return organizationId;
};

/**
 * GET baseline
 */
router.get(
  "/api/cases/:caseId/realization/baseline",
  authenticate,
  requireTenantAccess,
  async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const organizationId = ensureTenantId(req, res);
      if (!organizationId) return;

      const baseline = await realizationService.getBaseline(caseId, organizationId);

      if (!baseline) {
        return res.status(404).json({
          success: false,
          error: { message: "Baseline not found for this case" },
        });
      }

      res.json({ success: true, data: baseline });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: { message: error instanceof Error ? error.message : "Unknown error" },
      });
    }
  }
);

/**
 * POST baseline
 */
router.post(
  "/api/cases/:caseId/realization/baseline",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = ensureTenantId(req, res);
      if (!organizationId) return;

      const { scenarioId, scenarioName, kpiTargets, assumptions, handoffNotes } = req.body;

      const baselineId = await realizationService.createBaseline(
        caseId,
        organizationId,
        scenarioId,
        scenarioName,
        kpiTargets,
        assumptions,
        handoffNotes
      );

      res.status(201).json({ success: true, data: { id: baselineId } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET checkpoints
 */
router.get(
  "/api/cases/:caseId/realization/checkpoints",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = ensureTenantId(req, res);
      if (!organizationId) return;

      const checkpoints = await realizationService.getCheckpoints(caseId, organizationId);

      res.json({ success: true, data: checkpoints });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST checkpoint measurement
 */
router.post(
  "/api/realization/checkpoints/:checkpointId/measure",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { checkpointId } = req.params;
      const organizationId = ensureTenantId(req, res);
      if (!organizationId) return;

      const { actualValue, notes } = req.body;

      await realizationService.recordCheckpoint(
        checkpointId,
        organizationId,
        actualValue,
        notes
      );

      res.json({ success: true, data: { measured: true } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET KPI targets
 */
router.get(
  "/api/cases/:caseId/realization/kpi-targets",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = ensureTenantId(req, res);
      if (!organizationId) return;

      const targets = await realizationService.getKpiTargets(caseId, organizationId);

      res.json({ success: true, data: targets });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET realization report
 */
router.get(
  "/api/cases/:caseId/realization",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = ensureTenantId(req, res);
      if (!organizationId) return;

      const report = await realizationService.getLatestReport(caseId, organizationId);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: { message: "No realization report found for this case" },
        });
      }

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

