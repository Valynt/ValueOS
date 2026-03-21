/**
 * Value Graph API router tests
 *
 * Covers authentication, tenant isolation, and handler behaviour for all
 * 7 endpoints.
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@shared/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { mockRequireAuth } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () =>
    (req: Record<string, unknown>, _res: unknown, next: () => void) => {
      req["tenantId"] = "tenant-abc";
      next();
    },
}));

const mockSupabaseChain = {
  from: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "cap-1", name: "Updated" }, error: null }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "cap-1" }, error: null }),
      }),
    }),
  }),
};

vi.mock("../../middleware/tenantDbContext.js", () => ({
  tenantDbContextMiddleware: () =>
    (req: Record<string, unknown>, _res: unknown, next: () => void) => {
      req["supabase"] = mockSupabaseChain;
      next();
    },
}));

const { mockValidateOpportunityAccess } = vi.hoisted(() => ({
  mockValidateOpportunityAccess: vi.fn(
    (req: Record<string, unknown>, _res: unknown, next: () => void) => {
      req["opportunityId"] = req["params"]
        ? (req["params"] as Record<string, string>)["opportunityId"]
        : "770e8400-e29b-41d4-a716-446655440002";
      next();
    },
  ),
}));

vi.mock("../../middleware/validateOpportunityAccess.js", () => ({
  validateOpportunityAccess: mockValidateOpportunityAccess,
}));

const { mockGetGraphForOpportunity, mockGetValuePaths, mockWriteEdge, MOCK_GRAPH } = vi.hoisted(() => {
  const MOCK_GRAPH = {
    nodes: [
      { id: "cap-1", entity_type: "vg_capability", name: "Automation" },
      { id: "met-1", entity_type: "vg_metric", name: "Revenue" },
      { id: "vd-1", entity_type: "vg_value_driver", name: "Growth" },
    ],
    edges: [
      { id: "edge-1", edge_type: "capability_impacts_metric", from_entity_id: "cap-1", to_entity_id: "met-1" },
    ],
  };
  return {
    MOCK_GRAPH,
    mockGetGraphForOpportunity: vi.fn().mockResolvedValue(MOCK_GRAPH),
    mockGetValuePaths: vi.fn().mockResolvedValue([]),
    mockWriteEdge: vi.fn().mockResolvedValue({ id: "edge-new" }),
  };
});

vi.mock("../../services/value-graph/ValueGraphService.js", () => ({
  valueGraphService: {
    getGraphForOpportunity: mockGetGraphForOpportunity,
    getValuePaths: mockGetValuePaths,
    writeEdge: mockWriteEdge,

  },
  ValueGraphService: class {},
}));

vi.mock("../../services/security/AuditLogService.js", () => ({
  auditLogService: {
    logAudit: vi.fn().mockResolvedValue(undefined),
    logAction: vi.fn().mockResolvedValue(undefined),
  },
  AuditLogService: class {},
}));

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

import { valueGraphRouter } from "../valueGraph.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/graph", valueGraphRouter);
  return app;
}

const OPP_ID = "770e8400-e29b-41d4-a716-446655440002";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Value Graph API", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    // Restore default implementations after clearAllMocks
    mockGetGraphForOpportunity.mockResolvedValue(MOCK_GRAPH);
    mockGetValuePaths.mockResolvedValue([]);
    mockWriteEdge.mockResolvedValue({ id: "edge-new" });
    mockRequireAuth.mockImplementation((_req: unknown, _res: unknown, next: () => void) => next());
    mockValidateOpportunityAccess.mockImplementation(
      (req: Record<string, unknown>, _res: unknown, next: () => void) => {
        req["opportunityId"] = (req["params"] as Record<string, string>)["opportunityId"];
        next();
      },
    );
    // Restore default Supabase chain (cleared by vi.clearAllMocks)
    mockSupabaseChain.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "cap-1", name: "Updated" }, error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "cap-1" }, error: null }),
        }),
      }),
    });
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when requireAuth rejects", async () => {
      mockRequireAuth.mockImplementation((_req: unknown, res: Record<string, unknown>) => {
        (res["status"] as (code: number) => typeof res)(401).json({ error: "Unauthorized" });
      });

      const res = await request(app).get(`/api/v1/graph/${OPP_ID}/summary`);
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  describe("tenant isolation", () => {
    it("returns 403 when validateOpportunityAccess denies access", async () => {
      mockValidateOpportunityAccess.mockImplementation(
        (_req: unknown, res: Record<string, unknown>) => {
          (res["status"] as (code: number) => typeof res)(403).json({
            error: "Access to this Value Graph is denied.",
          });
        },
      );

      const res = await request(app).get(`/api/v1/graph/${OPP_ID}/summary`);
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("denied");
    });
  });

  // -------------------------------------------------------------------------
  // GET /summary
  // -------------------------------------------------------------------------

  describe("GET /:opportunityId/summary", () => {
    it("returns node and edge counts", async () => {
      const res = await request(app).get(`/api/v1/graph/${OPP_ID}/summary`);

      expect(res.status).toBe(200);
      expect(res.body.opportunity_id).toBe(OPP_ID);
      expect(res.body.node_counts.total).toBe(3);
      expect(res.body.node_counts.capabilities).toBe(1);
      expect(res.body.edge_counts.total).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // GET /nodes
  // -------------------------------------------------------------------------

  describe("GET /:opportunityId/nodes", () => {
    it("returns paginated nodes", async () => {
      const res = await request(app).get(`/api/v1/graph/${OPP_ID}/nodes`);

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(3);
      expect(res.body.pagination.total).toBe(3);
    });

    it("filters by entity_type", async () => {
      const res = await request(app).get(
        `/api/v1/graph/${OPP_ID}/nodes?entity_type=vg_capability`,
      );

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(1);
      expect(res.body.nodes[0].entity_type).toBe("vg_capability");
    });
  });

  // -------------------------------------------------------------------------
  // GET /export
  // -------------------------------------------------------------------------

  describe("GET /:opportunityId/export", () => {
    it("returns full graph with nodes and edges", async () => {
      const res = await request(app).get(`/api/v1/graph/${OPP_ID}/export`);

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(3);
      expect(res.body.edges).toHaveLength(1);
      expect(res.body.opportunity_id).toBe(OPP_ID);
    });
  });

  // -------------------------------------------------------------------------
  // GET /paths
  // -------------------------------------------------------------------------

  describe("GET /:opportunityId/paths", () => {
    it("returns value paths", async () => {
      mockGetValuePaths.mockResolvedValue([{ id: "path-1" }]);

      const res = await request(app).get(`/api/v1/graph/${OPP_ID}/paths`);

      expect(res.status).toBe(200);
      expect(res.body.paths).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // POST /edges
  // -------------------------------------------------------------------------

  describe("POST /:opportunityId/edges", () => {
    const validEdge = {
      from_entity_id: "550e8400-e29b-41d4-a716-446655440000",
      from_entity_type: "vg_capability",
      to_entity_id: "660e8400-e29b-41d4-a716-446655440001",
      to_entity_type: "vg_metric",
      edge_type: "capability_impacts_metric",
      created_by_agent: "human",
    };

    it("creates an edge and returns 201", async () => {
      const res = await request(app)
        .post(`/api/v1/graph/${OPP_ID}/edges`)
        .send(validEdge);

      expect(res.status).toBe(201);
      expect(res.body.edge.id).toBe("edge-new");
      expect(mockWriteEdge).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunity_id: OPP_ID,
          edge_type: "capability_impacts_metric",
        }),
      );
    });

    it("returns 400 for invalid body", async () => {
      const res = await request(app)
        .post(`/api/v1/graph/${OPP_ID}/edges`)
        .send({ from_entity_id: "not-a-uuid" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid");
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /nodes/:nodeId
  // -------------------------------------------------------------------------

  describe("PATCH /:opportunityId/nodes/:nodeId", () => {
    it("returns 200 with updated node on success", async () => {
      const res = await request(app)
        .patch(`/api/v1/graph/${OPP_ID}/nodes/cap-1`)
        .send({ name: "Updated Capability" });

      expect(res.status).toBe(200);
      expect(res.body.node).toMatchObject({ id: "cap-1", name: "Updated" });
      expect(res.body.opportunity_id).toBe(OPP_ID);
    });

    it("returns 404 when node does not exist in any table", async () => {
      // Override the supabase mock so all three table updates return no data
      mockSupabaseChain.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const res = await request(app)
        .patch(`/api/v1/graph/${OPP_ID}/nodes/nonexistent-node`)
        .send({ name: "Ghost" });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });

    it("returns 400 for empty body", async () => {
      const res = await request(app)
        .patch(`/api/v1/graph/${OPP_ID}/nodes/cap-1`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid field types", async () => {
      const res = await request(app)
        .patch(`/api/v1/graph/${OPP_ID}/nodes/cap-1`)
        .send({ baseline_value: "not-a-number" });

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /nodes/:nodeId
  // -------------------------------------------------------------------------

  describe("DELETE /:opportunityId/nodes/:nodeId", () => {
    it("returns 204 and writes an audit log entry", async () => {
      const { auditLogService } = await import(
        "../../services/security/AuditLogService.js"
      );

      const res = await request(app).delete(`/api/v1/graph/${OPP_ID}/nodes/cap-1`);

      expect(res.status).toBe(204);
      expect(vi.mocked(auditLogService.logAudit)).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "value_graph.node.deleted",
          resourceId: "cap-1",
        }),
      );
    });
  });
});
