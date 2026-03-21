/**
 * Realization API Routes
 *
 * Routes for post-sale value realization tracking.
 * Reference: openspec/specs/promise-baseline/spec.md
 */

import { Request, Response, Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import { RealizationService } from "../services/realization/RealizationService.js";

const requireTenantAccess = tenantContextMiddleware(true);

const router: Router = Router();
const realizationService = new RealizationService();

/**
 * GET /api/cases/:caseId/realization/baseline
 * Get promise baseline for a case
 */
router.get("/api/cases/:caseId/realization/baseline", async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const organizationId = req.tenantId ?? "";

    const baseline = await realizationService.getBaseline(caseId, organizationId);

    if (!baseline) {
      return res.status(404).json({
        success: false,
        error: { message: "Baseline not found for this case" },
      });
    }

    res.json({
      success: true,
      data: baseline,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : "Unknown error" },
    });
  }
});

/**
 * POST /api/cases/:caseId/realization/baseline
 * Create promise baseline (called when case is approved)
 */
router.post(
  "/api/cases/:caseId/realization/baseline",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = req.tenantId ?? "";
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

      res.status(201).json({
        success: true,
        data: { id: baselineId },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/cases/:caseId/realization/checkpoints
 * Get checkpoints for a case
 */
router.get(
  "/api/cases/:caseId/realization/checkpoints",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = req.tenantId ?? "";

      const checkpoints = await realizationService.getCheckpoints(caseId, organizationId);

      res.json({
        success: true,
        data: checkpoints,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/realization/checkpoints/:checkpointId/measure
 * Record a checkpoint measurement
 */
router.post(
  "/api/realization/checkpoints/:checkpointId/measure",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { checkpointId } = req.params;
      const { actualValue, notes } = req.body;

      await realizationService.recordCheckpoint(checkpointId, actualValue, notes);

      res.json({
        success: true,
        data: { measured: true },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/cases/:caseId/realization/kpi-targets
 * Get KPI targets for a case
 */
router.get(
  "/api/cases/:caseId/realization/kpi-targets",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = req.tenantId ?? "";

      const targets = await realizationService.getKpiTargets(caseId, organizationId);

      res.json({
        success: true,
        data: targets,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/cases/:caseId/realization
 * Get the latest realization report for a case.
 * Returns KPI variance, milestones, risks, and intervention recommendations.
 * Used by the RealizationDashboard component.
 */
router.get(
  "/api/cases/:caseId/realization",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = req.tenantId ?? req.tenant?.id ?? "";

      const report = await realizationService.getLatestReport(caseId, organizationId);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: { message: "No realization report found for this case" },
        });
      }

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
