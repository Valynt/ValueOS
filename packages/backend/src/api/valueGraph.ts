/**
 * Value Graph API
 *
 * REST endpoints for reading and mutating the Value Graph for an opportunity.
 * All routes require authentication and tenant-scoped access.
 *
 * Mount points:
 *   /api/v1/graph              — full CRUD API (Sprint 49)
 *   /api/v1/opportunities      — read-only graph + paths endpoint (Sprint 50)
 *
 * Middleware chain on /api/v1/graph routes:
 *   requireAuth → tenantContextMiddleware() → tenantDbContextMiddleware()
 *   → validateOpportunityAccess
 *
 * Routes (/api/v1/graph):
 *   GET  /:opportunityId/summary          — node/edge counts by type
 *   GET  /:opportunityId/nodes            — paginated nodes (?entity_type=)
 *   GET  /:opportunityId/export           — full graph JSON
 *   GET  /:opportunityId/paths            — value paths
 *   POST /:opportunityId/edges            — manually create an edge
 *   PATCH  /:opportunityId/nodes/:nodeId  — update node metadata
 *   DELETE /:opportunityId/nodes/:nodeId  — remove a node (audit logged)
 *
 * Routes (/api/v1/opportunities):
 *   GET  /:opportunityId/value-graph      — graph + sorted paths (Sprint 50)
 */

import { createLogger } from "@shared/lib/logger";
import type { NextFunction, Request, Response, Router } from "express";
import { Router as ExpressRouter } from "express";
import { z } from "zod";

import { logger as rootLogger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { tenantDbContextMiddleware } from "../middleware/tenantDbContext.js";
import { validateOpportunityAccess } from "../middleware/validateOpportunityAccess.js";
import { auditLogService } from "../services/security/AuditLogService.js";
import {
  valueGraphService,
  type WriteEdgeInput,
} from "../services/value-graph/ValueGraphService.js";

const logger = createLogger({ component: "valueGraph.router" });

// ---------------------------------------------------------------------------
// UUID validation helper (used by the Sprint 50 endpoint)
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// ---------------------------------------------------------------------------
// Zod schemas for write endpoints
// ---------------------------------------------------------------------------

const WriteEdgeBodySchema = z.object({
  from_entity_id: z.string().uuid(),
  from_entity_type: z.enum([
    "account", "stakeholder", "use_case", "vg_capability",
    "vg_metric", "vg_value_driver", "evidence", "value_hypothesis",
  ]),
  to_entity_id: z.string().uuid(),
  to_entity_type: z.enum([
    "account", "stakeholder", "use_case", "vg_capability",
    "vg_metric", "vg_value_driver", "evidence", "value_hypothesis",
  ]),
  edge_type: z.enum([
    "use_case_enabled_by_capability",
    "capability_impacts_metric",
    "metric_maps_to_value_driver",
    "hypothesis_claims_metric",
  ]),
  confidence_score: z.number().min(0).max(1).optional(),
  evidence_ids: z.array(z.string().uuid()).optional(),
  created_by_agent: z.string().default("human"),
  ontology_version: z.string().optional(),
});

const UpdateNodeBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  baseline_value: z.number().optional(),
  target_value: z.number().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  ontology_version: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helper — extract tenantId from request
// ---------------------------------------------------------------------------

function getTenantId(req: Request): string {
  return req.tenantId ?? (req.user?.tenant_id as string) ?? "";
}

// ===========================================================================
// Sprint 49 router — full CRUD API, mounted at /api/v1/graph
// ===========================================================================

export const valueGraphRouter: Router = ExpressRouter();

// Shared middleware chain — applied to all routes via router.use
valueGraphRouter.use(
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
);

// validateOpportunityAccess is applied per-route (after params are parsed)
const withOpportunityAccess = [validateOpportunityAccess];

// ---------------------------------------------------------------------------
// GET /:opportunityId/summary
// ---------------------------------------------------------------------------

valueGraphRouter.get(
  "/:opportunityId/summary",
  ...withOpportunityAccess,
  async (req: Request, res: Response): Promise<void> => {
    const opportunityId = req.opportunityId!;
    const organizationId = getTenantId(req);

    try {
      const graph = await valueGraphService.getGraphForOpportunity(
        opportunityId,
        organizationId,
      );

      const edgeCounts: Record<string, number> = {};
      for (const edge of graph.edges) {
        edgeCounts[edge.edge_type] = (edgeCounts[edge.edge_type] ?? 0) + 1;
      }

      res.json({
        opportunity_id: opportunityId,
        organization_id: organizationId,
        node_counts: {
          capabilities: graph.nodes.filter((n) => n.entity_type === "vg_capability").length,
          metrics: graph.nodes.filter((n) => n.entity_type === "vg_metric").length,
          value_drivers: graph.nodes.filter((n) => n.entity_type === "vg_value_driver").length,
          total: graph.nodes.length,
        },
        edge_counts: {
          by_type: edgeCounts,
          total: graph.edges.length,
        },
      });
    } catch (err) {
      logger.error("GET /summary failed", { opportunityId, error: (err as Error).message });
      res.status(500).json({ error: "Failed to load graph summary." });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:opportunityId/nodes
// ---------------------------------------------------------------------------

valueGraphRouter.get(
  "/:opportunityId/nodes",
  ...withOpportunityAccess,
  async (req: Request, res: Response): Promise<void> => {
    const opportunityId = req.opportunityId!;
    const organizationId = getTenantId(req);
    const entityType = req.query["entity_type"] as string | undefined;
    const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "50"), 10)));

    try {
      const graph = await valueGraphService.getGraphForOpportunity(
        opportunityId,
        organizationId,
      );

      let nodes = graph.nodes;
      if (entityType) {
        nodes = nodes.filter((n) => n.entity_type === entityType);
      }

      const total = nodes.length;
      const offset = (page - 1) * limit;
      const paginated = nodes.slice(offset, offset + limit);

      res.json({
        opportunity_id: opportunityId,
        organization_id: organizationId,
        nodes: paginated,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      logger.error("GET /nodes failed", { opportunityId, error: (err as Error).message });
      res.status(500).json({ error: "Failed to load graph nodes." });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:opportunityId/export
// ---------------------------------------------------------------------------

valueGraphRouter.get(
  "/:opportunityId/export",
  ...withOpportunityAccess,
  async (req: Request, res: Response): Promise<void> => {
    const opportunityId = req.opportunityId!;
    const organizationId = getTenantId(req);

    try {
      const graph = await valueGraphService.getGraphForOpportunity(
        opportunityId,
        organizationId,
      );

      res.json({
        opportunity_id: opportunityId,
        organization_id: organizationId,
        nodes: graph.nodes,
        edges: graph.edges,
      });
    } catch (err) {
      logger.error("GET /export failed", { opportunityId, error: (err as Error).message });
      res.status(500).json({ error: "Failed to export graph." });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:opportunityId/paths
// ---------------------------------------------------------------------------

valueGraphRouter.get(
  "/:opportunityId/paths",
  ...withOpportunityAccess,
  async (req: Request, res: Response): Promise<void> => {
    const opportunityId = req.opportunityId!;
    const organizationId = getTenantId(req);

    try {
      const paths = await valueGraphService.getValuePaths(opportunityId, organizationId);

      res.json({
        opportunity_id: opportunityId,
        organization_id: organizationId,
        paths,
      });
    } catch (err) {
      logger.error("GET /paths failed", { opportunityId, error: (err as Error).message });
      res.status(500).json({ error: "Failed to load value paths." });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:opportunityId/edges
// ---------------------------------------------------------------------------

valueGraphRouter.post(
  "/:opportunityId/edges",
  ...withOpportunityAccess,
  async (req: Request, res: Response): Promise<void> => {
    const opportunityId = req.opportunityId!;
    const organizationId = getTenantId(req);

    const parsed = WriteEdgeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body.", details: parsed.error.flatten() });
      return;
    }

    try {
      const edge = await valueGraphService.writeEdge({
        ...(parsed.data as WriteEdgeInput),
        opportunity_id: opportunityId,
        organization_id: organizationId,
      });

      res.status(201).json({
        opportunity_id: opportunityId,
        organization_id: organizationId,
        edge,
      });
    } catch (err) {
      logger.error("POST /edges failed", { opportunityId, error: (err as Error).message });
      res.status(500).json({ error: "Failed to create edge." });
    }
  },
);

// ---------------------------------------------------------------------------
// Node table constants — used to validate the source_table returned by the
// resolve_value_graph_node RPC before using it in a .from() call.
// ---------------------------------------------------------------------------

const VALID_NODE_TABLES = ["vg_capabilities", "vg_metrics", "vg_value_drivers"] as const;
type NodeTable = (typeof VALID_NODE_TABLES)[number];

function isValidNodeTable(value: unknown): value is NodeTable {
  return VALID_NODE_TABLES.includes(value as NodeTable);
}

// ---------------------------------------------------------------------------
// PATCH /:opportunityId/nodes/:nodeId
// ---------------------------------------------------------------------------

valueGraphRouter.patch(
  "/:opportunityId/nodes/:nodeId",
  ...withOpportunityAccess,
  async (req: Request, res: Response): Promise<void> => {
    const opportunityId = req.opportunityId!;
    const organizationId = getTenantId(req);
    const { nodeId } = req.params;

    const parsed = UpdateNodeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body.", details: parsed.error.flatten() });
      return;
    }

    if (Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: "Request body must contain at least one field to update." });
      return;
    }

    const supabase = req.supabase;
    if (!supabase) {
      res.status(500).json({ error: "Internal server error." });
      return;
    }

    try {
      // Resolve which table owns this node in a single RPC call, then dispatch
      // one targeted update. Replaces the previous sequential 3-table loop.
      const { data: resolved, error: resolveError } = await supabase
        .rpc("resolve_value_graph_node", {
          p_node_id: nodeId,
          p_opportunity_id: opportunityId,
          p_organization_id: organizationId,
        })
        .maybeSingle();

      if (resolveError) {
        logger.error("PATCH /nodes/:nodeId: resolve RPC failed", {
          opportunityId,
          nodeId,
          error: resolveError.message,
        });
        res.status(500).json({ error: "Failed to update node." });
        return;
      }

      if (!resolved) {
        res.status(404).json({ error: "Node not found." });
        return;
      }

      const resolvedTyped = resolved as { source_table: string };

      if (!isValidNodeTable(resolvedTyped.source_table)) {
        logger.error("PATCH /nodes/:nodeId: unexpected source_table from resolver", {
          opportunityId,
          nodeId,
          source_table: resolvedTyped.source_table,
        });
        res.status(500).json({ error: "Failed to update node." });
        return;
      }

      const { data: updated, error: updateError } = await supabase
        .from(resolvedTyped.source_table)
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq("id", nodeId)
        .eq("opportunity_id", opportunityId)
        .eq("organization_id", organizationId)
        .select()
        .maybeSingle();

      if (updateError || !updated) {
        res.status(404).json({ error: "Node not found." });
        return;
      }

      res.json({
        opportunity_id: opportunityId,
        organization_id: organizationId,
        node: updated,
      });
    } catch (err) {
      logger.error("PATCH /nodes/:nodeId failed", {
        opportunityId,
        nodeId,
        error: (err as Error).message,
      });
      res.status(500).json({ error: "Failed to update node." });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:opportunityId/nodes/:nodeId
// ---------------------------------------------------------------------------

valueGraphRouter.delete(
  "/:opportunityId/nodes/:nodeId",
  ...withOpportunityAccess,
  async (req: Request, res: Response): Promise<void> => {
    const opportunityId = req.opportunityId!;
    const organizationId = getTenantId(req);
    const { nodeId } = req.params;
    const userId = req.user?.id ?? req.userId ?? "unknown";

    const supabase = req.supabase;
    if (!supabase) {
      res.status(500).json({ error: "Internal server error." });
      return;
    }

    try {
      // Resolve which table owns this node in a single RPC call, then dispatch
      // one targeted delete. Replaces the previous sequential 3-table loop.
      const { data: resolved, error: resolveError } = await supabase
        .rpc("resolve_value_graph_node", {
          p_node_id: nodeId,
          p_opportunity_id: opportunityId,
          p_organization_id: organizationId,
        })
        .maybeSingle();

      if (resolveError) {
        logger.error("DELETE /nodes/:nodeId: resolve RPC failed", {
          opportunityId,
          nodeId,
          error: resolveError.message,
        });
        res.status(500).json({ error: "Failed to delete node." });
        return;
      }

      if (!resolved) {
        res.status(404).json({ error: "Node not found." });
        return;
      }

      const resolvedTyped = resolved as { source_table: string };

      if (!isValidNodeTable(resolvedTyped.source_table)) {
        logger.error("DELETE /nodes/:nodeId: unexpected source_table from resolver", {
          opportunityId,
          nodeId,
          source_table: resolvedTyped.source_table,
        });
        res.status(500).json({ error: "Failed to delete node." });
        return;
      }

      const { error: deleteError } = await supabase
        .from(resolvedTyped.source_table)
        .delete()
        .eq("id", nodeId)
        .eq("opportunity_id", opportunityId)
        .eq("organization_id", organizationId);

      if (deleteError) {
        res.status(500).json({ error: "Failed to delete node." });
        return;
      }

      // Audit log — non-fatal
      try {
        await auditLogService.logAudit({
          tenantId: organizationId,
          userId,
          userName: userId,
          userEmail: "",
          action: "value_graph.node.deleted",
          resourceType: "value_graph_node",
          resourceId: nodeId,
          details: {
            opportunity_id: opportunityId,
            table: resolvedTyped.source_table,
          },
          status: "success",
        });
      } catch (auditErr) {
        logger.warn("DELETE /nodes/:nodeId: audit log failed", {
          nodeId,
          error: (auditErr as Error).message,
        });
      }

      res.status(204).send();
    } catch (err) {
      logger.error("DELETE /nodes/:nodeId failed", {
        opportunityId,
        nodeId,
        error: (err as Error).message,
      });
      res.status(500).json({ error: "Failed to delete node." });
    }
  },
);

// ===========================================================================
// Sprint 50 router — read-only graph + paths, mounted at /api/v1/opportunities
// ===========================================================================

export const opportunityValueGraphRouter: Router = ExpressRouter();

/**
 * GET /api/v1/opportunities/:opportunityId/value-graph
 *
 * Returns the full graph (nodes + edges) and all traversable value paths for
 * the given opportunity, sorted by path_confidence descending.
 */
opportunityValueGraphRouter.get(
  "/:opportunityId/value-graph",
  requireAuth,
  tenantContextMiddleware(),
  validateOpportunityAccess,
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

      const sortedPaths = [...paths].sort(
        (a, b) => b.path_confidence - a.path_confidence,
      );

      res.json({ graph, paths: sortedPaths });
    } catch (err) {
      rootLogger.error("ValueGraph API: failed to load graph", {
        opportunityId,
        organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
      next(err);
    }
  },
);
