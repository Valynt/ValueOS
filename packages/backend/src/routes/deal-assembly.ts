/**
 * Deal Assembly API Routes
 *
 * Routes for deal context extraction, gap filling, and assembly management.
 * Reference: openspec/specs/deal-assembly/spec.md
 */

import { Router } from "express";
import { DealAssemblyService } from "../../services/deal/DealAssemblyService.js";
import { authenticate } from "../../middleware/auth.js";
import { requireTenantAccess } from "../../middleware/tenant.js";

const router = Router();
const dealAssemblyService = new DealAssemblyService();

/**
 * GET /api/cases/:caseId/context
 * Get deal context for a case
 */
router.get(
  "/api/cases/:caseId/context",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = req.tenant!.id;

      const context = await dealAssemblyService.getContext(caseId, organizationId);

      if (!context) {
        return res.status(404).json({
          success: false,
          error: { message: "Deal context not found for this case" },
        });
      }

      res.json({
        success: true,
        data: context,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/cases/:caseId/context
 * Create or update deal context
 */
router.post(
  "/api/cases/:caseId/context",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = req.tenant!.id;
      const {
        account_name,
        stakeholders,
        use_cases,
        pain_signals,
        value_driver_candidates,
        baseline_clues,
        gaps,
        extracted_from,
      } = req.body;

      const contextId = await dealAssemblyService.upsertContext(caseId, organizationId, {
        account_name,
        stakeholders,
        use_cases,
        pain_signals,
        value_driver_candidates,
        baseline_clues,
        gaps,
        extracted_from,
      });

      res.status(201).json({
        success: true,
        data: { id: contextId },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/cases/:caseId/gaps/:gapId/fill
 * Fill a gap with a value
 */
router.post(
  "/api/cases/:caseId/gaps/:gapId/fill",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId, gapId } = req.params;
      const organizationId = req.tenant!.id;
      const { value } = req.body;
      const userId = req.user!.id;

      await dealAssemblyService.fillGap(caseId, organizationId, gapId, value, userId);

      res.json({
        success: true,
        data: { filled: true },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/cases/:caseId/assembly/confirm
 * Confirm deal assembly and mark ready for modeling
 */
router.post(
  "/api/cases/:caseId/assembly/confirm",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = req.tenant!.id;

      await dealAssemblyService.confirmAssembly(caseId, organizationId);

      res.json({
        success: true,
        data: { confirmed: true },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/cases/:caseId/assembly/reassemble
 * Trigger re-assembly
 */
router.post(
  "/api/cases/:caseId/assembly/reassemble",
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = req.tenant!.id;

      await dealAssemblyService.triggerReassembly(caseId, organizationId);

      res.json({
        success: true,
        data: { reassembling: true },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
