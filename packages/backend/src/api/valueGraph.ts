/**
 * Value Graph API
 *
 * Exposes the Value Graph for an opportunity: all nodes/edges and traversable
 * value paths. Used by the ValyntApp ValueGraphVisualization SDUI component.
 *
 * Route: GET /api/v1/opportunities/:opportunityId/value-graph
 *
 * Tenant-scoped via req.tenantId. Uses the service-role Supabase client (same
 * as all ValueGraphService callers); tenant isolation is enforced by passing
 * organization_id to every query inside ValueGraphService.
 *
 * Sprint 50: Initial implementation.
 */

import { NextFunction, Request, Response, Router } from "express";

import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { valueGraphService } from "../services/value-graph/ValueGraphService.js";

const router = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * GET /api/v1/opportunities/:opportunityId/value-graph
 *
 * Returns the full graph (nodes + edges) and all traversable value paths for
 * the given opportunity, sorted by path_confidence descending.
 */
router.get(
  "/:opportunityId/value-graph",
  requireAuth,
  tenantContextMiddleware(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { opportunityId } = req.params;
    const organizationId = req.tenantId;

    if (!isValidUuid(opportunityId)) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "opportunityId must be a valid UUID",
      });
      return;
    }

    if (!organizationId) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Tenant context required",
      });
      return;
    }

    try {
      const [graph, paths] = await Promise.all([
        valueGraphService.getGraphForOpportunity(opportunityId, organizationId),
        valueGraphService.getValuePaths(opportunityId, organizationId),
      ]);

      // Sort paths by path_confidence descending
      const sortedPaths = [...paths].sort(
        (a, b) => b.path_confidence - a.path_confidence
      );

      res.json({ graph, paths: sortedPaths });
    } catch (err) {
      logger.error("ValueGraph API: failed to load graph", {
        opportunityId,
        organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
      next(err);
    }
  }
);

export { router as valueGraphRouter };
