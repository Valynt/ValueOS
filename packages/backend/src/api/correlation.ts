/**
 * Request Correlation API Routes (S2-2, S2-3)
 *
 * Provides endpoints for:
 * - Querying logs by request ID (S2-2)
 * - Compliance export with integrity verification (S2-3)
 */

import { Router, Response } from "express";

import { requestCorrelationService } from "../../services/security/RequestCorrelationService.js";
import { requireAuth } from "../auth.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import type { AuthenticatedRequest } from "../auth.js";

const router = Router();

// Rate limiter for compliance export (expensive operation)
const complianceExportLimiter = createRateLimiter("strict", {
  message: "Too many compliance export requests. Please try again later.",
});

/**
 * GET /api/correlation/:requestId
 * Query all logs correlated by request ID (S2-2)
 * Tenant-scoped: only returns logs for the authenticated tenant
 */
router.get(
  "/:requestId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { requestId } = req.params;
      const tenantId = req.tenantId || req.user?.tenant_id;

      if (!tenantId) {
        return res.status(403).json({
          error: "tenant_required",
          message: "Tenant context required for correlation query",
        });
      }

      const result = await requestCorrelationService.queryByRequestId(
        requestId,
        tenantId
      );

      return res.json(result);
    } catch (error) {
      console.error("Correlation query failed:", error);
      return res.status(500).json({
        error: "correlation_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * POST /api/correlation/export
 * Generate compliance export with integrity verification (S2-3)
 * Tenant-scoped: only exports logs for the authenticated tenant
 * Rate-limited: strict tier for expensive operations
 */
router.post(
  "/export",
  requireAuth,
  complianceExportLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.user?.tenant_id;

      if (!tenantId) {
        return res.status(403).json({
          error: "tenant_required",
          message: "Tenant context required for compliance export",
        });
      }

      const {
        format = "json",
        requestId,
        startDate,
        endDate,
        includeIntegrityHash = true,
      } = req.body;

      if (!["json", "csv"].includes(format)) {
        return res.status(400).json({
          error: "invalid_format",
          message: "Format must be 'json' or 'csv'",
        });
      }

      const exportResult = await requestCorrelationService.generateComplianceExport({
        format,
        tenantId,
        requestId,
        startDate,
        endDate,
        includeIntegrityHash,
      });

      res.setHeader("Content-Type", format === "json" ? "application/json" : "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportResult.filename}"`
      );

      if (includeIntegrityHash) {
        res.setHeader("X-Integrity-Hash", exportResult.integrityHash);
      }

      return res.send(exportResult.data);
    } catch (error) {
      console.error("Compliance export failed:", error);
      return res.status(500).json({
        error: "export_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * POST /api/correlation/verify
 * Verify integrity of exported logs (S2-3)
 */
router.post(
  "/verify",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { logs, expectedHash } = req.body;

      if (!logs || !expectedHash) {
        return res.status(400).json({
          error: "missing_parameters",
          message: "Both 'logs' and 'expectedHash' are required",
        });
      }

      const isValid = requestCorrelationService.verifyIntegrity(logs, expectedHash);

      return res.json({
        valid: isValid,
        message: isValid
          ? "Integrity verification passed"
          : "Integrity verification failed - data may have been tampered with",
      });
    } catch (error) {
      console.error("Integrity verification failed:", error);
      return res.status(500).json({
        error: "verification_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
