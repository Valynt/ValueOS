/**
 * Realization API Routes (FINAL RECONCILED)
 *
 * Key fixes:
 * - Resolved all merge conflicts
 * - Enforced authentication consistently
 * - Enforced tenant context validation centrally
 * - Removed silent fallbacks ("?? ''")
 * - Standardized handler structure
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
 * GET /api/cases/:caseId/realization/baseline
 * Get promise baseline for a case.
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

      return res.json({
        success: true,
        data: baseline,
      });
    } catch (error: unknown) {
      return res.status(500).json({
        success: false,
        error: { message: error instanceof Error ? error.message : "Unknown error" },
      });
    }
  },
);

/**
 * POST /api/cases/:caseId/realization/baseline
 * Create promise baseline (called when case is approved).
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
        handoffNotes,
      );

      return res.status(201).json({
        success: true,
        data: { id: baselineId },
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * GET /api/cases/:caseId/realization/checkpoints
 * Get checkpoints for a case.
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

      return res.json({
        success: true,
        data: checkpoints,
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * POST /api/realization/checkpoints/:checkpointId/measure
 * Record a checkpoint measurement.
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
        notes,
      );

      return res.json({
        success: true,
        data: { measured: true },
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * GET /api/cases/:caseId/realization/kpi-targets
 * Get KPI targets for a case.
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

      return res.json({
        success: true,
        data: targets,
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * GET /api/cases/:caseId/realization
 * Get the latest realization report for a case.
 * Returns KPI variance, milestones, risks, and intervention recommendations.
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

      return res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;


