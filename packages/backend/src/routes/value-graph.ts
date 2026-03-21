/**
 * Value Graph API Routes
 *
 * 7 authenticated, tenant-scoped endpoints for reading and writing the
 * Value Graph for a given case.
 *
 * All endpoints:
 *   - Require JWT authentication via `authenticate`
 *   - Require tenant context via `tenantContextMiddleware`
 *   - Validate that the caseId belongs to the authenticated tenant before
 *     any graph query executes
 *   - Return { success: true, data: ... } on success
 *   - Return { success: false, error: { message } } on failure
 *   - Return 404 when the case is not found or not accessible to the tenant
 *
 * Endpoints:
 *   GET  /api/v1/cases/:caseId/graph           Full graph (nodes + edges)
 *   GET  /api/v1/cases/:caseId/graph/paths     Ordered value paths
 *   GET  /api/v1/cases/:caseId/graph/nodes     All nodes (optional ?type= filter)
 *   GET  /api/v1/cases/:caseId/graph/nodes/:nodeId  Single node
 *   GET  /api/v1/cases/:caseId/graph/edges     All edges (optional ?edge_type= filter)
 *   POST /api/v1/cases/:caseId/graph/edges     Manual edge creation
 *   GET  /api/v1/cases/:caseId/graph/integrity Gap report
 *
 * Sprint 49: Initial implementation.
 */

import { type NextFunction, type Request, type Response, Router } from "express";

import { authenticate } from "../middleware/auth.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { ValueCasesRepository } from "../api/valueCases/repository.js";
import {
  EDGE_TYPE_CONSTRAINTS,
  EdgeConstraintViolationError,
} from "@valueos/shared";
import type {
  ValueGraphEdgeType,
  ValueGraphEntityType,
} from "@valueos/shared";
import { ValueGraphService } from "../services/value-graph/ValueGraphService.js";
import { logger } from "../lib/logger.js";

const router = Router();
const requireTenantAccess = tenantContextMiddleware(true);
const valueGraphService = new ValueGraphService();

// ---------------------------------------------------------------------------
// GraphRequest middleware — validates caseId belongs to the authenticated tenant
// ---------------------------------------------------------------------------

async function validateCaseAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { caseId } = req.params;
  const organizationId = (req as unknown as { tenantId: string }).tenantId;

  if (!caseId || !organizationId) {
    res.status(400).json({ success: false, error: { message: "Missing caseId or tenant context" } });
    return;
  }

  try {
    const repo = ValueCasesRepository.fromRequest(req);
    const valueCase = await repo.getById(organizationId, caseId);
    if (!valueCase) {
      res.status(404).json({ success: false, error: { message: "Case not found or not accessible" } });
      return;
    }
    next();
  } catch (err) {
    logger.error("value-graph: case access validation failed", {
      caseId,
      organizationId,
      error: (err as Error).message,
    });
    res.status(500).json({ success: false, error: { message: "Internal server error" } });
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/cases/:caseId/graph
// Full graph: all nodes + edges for the case
// ---------------------------------------------------------------------------

router.get(
  "/:caseId/graph",
  authenticate,
  requireTenantAccess,
  validateCaseAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = (req as unknown as { tenantId: string }).tenantId;

      const graph = await valueGraphService.getGraphForOpportunity(caseId, organizationId);
      res.json({ success: true, data: graph });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/v1/cases/:caseId/graph/paths
// Ordered value paths (UseCase → ValueDriver)
// ---------------------------------------------------------------------------

router.get(
  "/:caseId/graph/paths",
  authenticate,
  requireTenantAccess,
  validateCaseAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = (req as unknown as { tenantId: string }).tenantId;

      const paths = await valueGraphService.getValuePaths(caseId, organizationId);
      res.json({ success: true, data: paths });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/v1/cases/:caseId/graph/nodes
// All nodes, optionally filtered by ?type=vg_capability
// ---------------------------------------------------------------------------

router.get(
  "/:caseId/graph/nodes",
  authenticate,
  requireTenantAccess,
  validateCaseAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = (req as unknown as { tenantId: string }).tenantId;
      const typeFilter = req.query.type as ValueGraphEntityType | undefined;

      const graph = await valueGraphService.getGraphForOpportunity(caseId, organizationId);
      const nodes = typeFilter
        ? graph.nodes.filter(n => n.entity_type === typeFilter)
        : graph.nodes;

      res.json({ success: true, data: nodes });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/v1/cases/:caseId/graph/nodes/:nodeId
// Single node by entity ID
// ---------------------------------------------------------------------------

router.get(
  "/:caseId/graph/nodes/:nodeId",
  authenticate,
  requireTenantAccess,
  validateCaseAccess,
  async (req, res, next) => {
    try {
      const { caseId, nodeId } = req.params;
      const organizationId = (req as unknown as { tenantId: string }).tenantId;

      const graph = await valueGraphService.getGraphForOpportunity(caseId, organizationId);
      const node = graph.nodes.find(n => n.entity_id === nodeId);

      if (!node) {
        res.status(404).json({ success: false, error: { message: "Node not found" } });
        return;
      }

      res.json({ success: true, data: node });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/v1/cases/:caseId/graph/edges
// All edges, optionally filtered by ?edge_type=capability_impacts_metric
// ---------------------------------------------------------------------------

router.get(
  "/:caseId/graph/edges",
  authenticate,
  requireTenantAccess,
  validateCaseAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = (req as unknown as { tenantId: string }).tenantId;
      const edgeTypeFilter = req.query.edge_type as ValueGraphEdgeType | undefined;

      const graph = await valueGraphService.getGraphForOpportunity(caseId, organizationId);
      const edges = edgeTypeFilter
        ? graph.edges.filter(e => e.edge_type === edgeTypeFilter)
        : graph.edges;

      res.json({ success: true, data: edges });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/v1/cases/:caseId/graph/edges
// Manual edge creation (human-in-the-loop overrides)
// Returns 422 if the edge triple violates EDGE_TYPE_CONSTRAINTS
// ---------------------------------------------------------------------------

router.post(
  "/:caseId/graph/edges",
  authenticate,
  requireTenantAccess,
  validateCaseAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = (req as unknown as { tenantId: string }).tenantId;

      const {
        from_entity_type,
        from_entity_id,
        to_entity_type,
        to_entity_id,
        edge_type,
        confidence_score,
        evidence_ids,
        created_by_agent,
      } = req.body as {
        from_entity_type: ValueGraphEntityType;
        from_entity_id: string;
        to_entity_type: ValueGraphEntityType;
        to_entity_id: string;
        edge_type: ValueGraphEdgeType;
        confidence_score?: number;
        evidence_ids?: string[];
        created_by_agent?: string;
      };

      // Validate required fields
      if (!from_entity_type || !from_entity_id || !to_entity_type || !to_entity_id || !edge_type) {
        res.status(400).json({
          success: false,
          error: { message: "Missing required fields: from_entity_type, from_entity_id, to_entity_type, to_entity_id, edge_type" },
        });
        return;
      }

      // Validate edge triple against constraints
      const constraint = EDGE_TYPE_CONSTRAINTS[edge_type];
      if (!constraint) {
        res.status(422).json({
          success: false,
          error: { message: `Unknown edge_type: "${edge_type}"` },
        });
        return;
      }

      if (from_entity_type !== constraint.from || to_entity_type !== constraint.to) {
        const violation = new EdgeConstraintViolationError(edge_type, from_entity_type, to_entity_type);
        res.status(422).json({
          success: false,
          error: { message: violation.message },
        });
        return;
      }

      const edge = await valueGraphService.writeEdge({
        opportunity_id: caseId,
        organization_id: organizationId,
        from_entity_type,
        from_entity_id,
        to_entity_type,
        to_entity_id,
        edge_type,
        confidence_score,
        evidence_ids,
        created_by_agent: created_by_agent ?? "human",
      });

      res.status(201).json({ success: true, data: edge });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/v1/cases/:caseId/graph/integrity
// Gap report: hypothesis_claims_value_driver edges with no evidence_supports_metric counterpart
// ---------------------------------------------------------------------------

router.get(
  "/:caseId/graph/integrity",
  authenticate,
  requireTenantAccess,
  validateCaseAccess,
  async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const organizationId = (req as unknown as { tenantId: string }).tenantId;

      const graph = await valueGraphService.getGraphForOpportunity(caseId, organizationId);

      // Find hypothesis_claims_value_driver edges
      const claimEdges = graph.edges.filter(
        e => e.edge_type === "hypothesis_claims_value_driver",
      );

      // Find value driver IDs that have at least one evidence_supports_metric edge
      // pointing to a metric that maps to them
      const evidenceMetricIds = new Set(
        graph.edges
          .filter(e => e.edge_type === "evidence_supports_metric")
          .map(e => e.to_entity_id),
      );

      const metricDriverIds = new Set(
        graph.edges
          .filter(
            e =>
              e.edge_type === "metric_maps_to_value_driver" &&
              evidenceMetricIds.has(e.from_entity_id),
          )
          .map(e => e.to_entity_id),
      );

      // A claim has a gap if its target driver has no evidence-backed metric path
      const gaps = claimEdges
        .filter(e => !metricDriverIds.has(e.to_entity_id))
        .map(e => ({
          hypothesis_entity_id: e.from_entity_id,
          value_driver_entity_id: e.to_entity_id,
          edge_id: e.id,
          gap_type: "no_evidence_supports_metric" as const,
        }));

      res.json({
        success: true,
        data: {
          gaps,
          total_claims: claimEdges.length,
          covered_claims: claimEdges.length - gaps.length,
          gap_count: gaps.length,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export { router as valueGraphRouter };
export default router;
