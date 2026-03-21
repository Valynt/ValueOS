/**
 * Value Graph API Routes — integration tests (Sprint 49)
 *
 * Covers all 7 endpoints:
 *   GET  /:caseId/graph
 *   GET  /:caseId/graph/paths
 *   GET  /:caseId/graph/nodes
 *   GET  /:caseId/graph/nodes/:nodeId
 *   GET  /:caseId/graph/edges
 *   POST /:caseId/graph/edges
 *   GET  /:caseId/graph/integrity
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---

const { mockGetById, mockGetGraph, mockGetPaths, mockWriteEdge } = vi.hoisted(() => ({
  mockGetById: vi.fn(),
  mockGetGraph: vi.fn(),
  mockGetPaths: vi.fn(),
  mockWriteEdge: vi.fn(),
}));

// --- Module mocks ---

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../lib/supabase.js", () => ({
  supabase: {},
  createServerSupabaseClient: vi.fn(() => ({})),
  createServiceRoleSupabaseClient: vi.fn(() => ({})),
}));

vi.mock("../../middleware/auth.js", () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../api/valueCases/repository.js", () => ({
  ValueCasesRepository: class {
    static fromRequest() {
      return { getById: mockGetById };
    }
    getById = mockGetById;
  },
  NotFoundError: class extends Error {},
  ConflictError: class extends Error {},
  DatabaseError: class extends Error {},
}));

vi.mock("../../services/value-graph/ValueGraphService.js", () => ({
  ValueGraphService: class {
    getGraphForOpportunity = mockGetGraph;
    getValuePaths = mockGetPaths;
    writeEdge = mockWriteEdge;
  },
  valueGraphService: {
    getGraphForOpportunity: mockGetGraph,
    getValuePaths: mockGetPaths,
    writeEdge: mockWriteEdge,
  },
}));

// --- Imports ---

import { valueGraphRouter } from "../value-graph.js";

// --- App setup ---

function makeApp() {
  const app = express();
  app.use(express.json());
  // Inject tenant context (normally done by middleware)
  app.use((req, _res, next) => {
    (req as unknown as { tenantId: string }).tenantId = "org-456";
    next();
  });
  app.use("/", valueGraphRouter);
  return app;
}

// --- Fixtures ---

const MOCK_GRAPH = {
  opportunity_id: "case-001",
  organization_id: "org-456",
  ontology_version: "1.0",
  nodes: [
    { entity_type: "vg_capability", entity_id: "cap-001", data: { id: "cap-001", name: "Vendor Consolidation" } },
    { entity_type: "vg_metric", entity_id: "metric-001", data: { id: "metric-001", name: "Procurement Cost" } },
    { entity_type: "vg_value_driver", entity_id: "driver-001", data: { id: "driver-001", name: "Cost Reduction" } },
  ],
  edges: [
    {
      id: "edge-001", organization_id: "org-456", opportunity_id: "case-001",
      from_entity_type: "use_case", from_entity_id: "case-001",
      to_entity_type: "vg_capability", to_entity_id: "cap-001",
      edge_type: "use_case_enabled_by_capability", confidence_score: 0.8,
      evidence_ids: [], created_by_agent: "OpportunityAgent", ontology_version: "1.0",
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "edge-002", organization_id: "org-456", opportunity_id: "case-001",
      from_entity_type: "capability_impacts_metric", from_entity_id: "cap-001",
      to_entity_type: "vg_metric", to_entity_id: "metric-001",
      edge_type: "capability_impacts_metric", confidence_score: 0.75,
      evidence_ids: [], created_by_agent: "FinancialModelingAgent", ontology_version: "1.0",
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "edge-003", organization_id: "org-456", opportunity_id: "case-001",
      from_entity_type: "value_hypothesis", from_entity_id: "hyp-001",
      to_entity_type: "vg_value_driver", to_entity_id: "driver-001",
      edge_type: "hypothesis_claims_value_driver", confidence_score: 0.7,
      evidence_ids: [], created_by_agent: "OpportunityAgent", ontology_version: "1.0",
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
};

const MOCK_PATHS = [
  {
    edges: [MOCK_GRAPH.edges[0]],
    path_confidence: 0.8,
    value_driver: MOCK_GRAPH.nodes[2].data,
    use_case_id: "case-001",
    metrics: [MOCK_GRAPH.nodes[1].data],
    capabilities: [MOCK_GRAPH.nodes[0].data],
  },
];

// --- Tests ---

describe("Value Graph API Routes", () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetById.mockResolvedValue({ id: "case-001", organization_id: "org-456" });
    mockGetGraph.mockResolvedValue(MOCK_GRAPH);
    mockGetPaths.mockResolvedValue(MOCK_PATHS);
    mockWriteEdge.mockResolvedValue({
      id: "edge-new", organization_id: "org-456", opportunity_id: "case-001",
      from_entity_type: "vg_metric", from_entity_id: "metric-001",
      to_entity_type: "vg_value_driver", to_entity_id: "driver-001",
      edge_type: "target_quantifies_driver", confidence_score: 0.8,
      evidence_ids: [], created_by_agent: "human", ontology_version: "1.0",
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    });
    app = makeApp();
  });

  // -------------------------------------------------------------------------
  // GET /:caseId/graph
  // -------------------------------------------------------------------------

  describe("GET /:caseId/graph", () => {
    it("returns the full graph", async () => {
      const res = await request(app).get("/case-001/graph");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.nodes).toHaveLength(3);
      expect(res.body.data.edges).toHaveLength(3);
    });

    it("returns 404 when case not found", async () => {
      mockGetById.mockResolvedValue(null);

      const res = await request(app).get("/case-999/graph");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:caseId/graph/paths
  // -------------------------------------------------------------------------

  describe("GET /:caseId/graph/paths", () => {
    it("returns ordered value paths", async () => {
      const res = await request(app).get("/case-001/graph/paths");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].path_confidence).toBe(0.8);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:caseId/graph/nodes
  // -------------------------------------------------------------------------

  describe("GET /:caseId/graph/nodes", () => {
    it("returns all nodes without filter", async () => {
      const res = await request(app).get("/case-001/graph/nodes");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
    });

    it("filters nodes by ?type=vg_capability", async () => {
      const res = await request(app).get("/case-001/graph/nodes?type=vg_capability");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].entity_type).toBe("vg_capability");
    });

    it("returns empty array when no nodes match the type filter", async () => {
      const res = await request(app).get("/case-001/graph/nodes?type=stakeholder");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:caseId/graph/nodes/:nodeId
  // -------------------------------------------------------------------------

  describe("GET /:caseId/graph/nodes/:nodeId", () => {
    it("returns a single node by entity_id", async () => {
      const res = await request(app).get("/case-001/graph/nodes/cap-001");

      expect(res.status).toBe(200);
      expect(res.body.data.entity_id).toBe("cap-001");
      expect(res.body.data.entity_type).toBe("vg_capability");
    });

    it("returns 404 when node not found", async () => {
      const res = await request(app).get("/case-001/graph/nodes/nonexistent");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:caseId/graph/edges
  // -------------------------------------------------------------------------

  describe("GET /:caseId/graph/edges", () => {
    it("returns all edges without filter", async () => {
      const res = await request(app).get("/case-001/graph/edges");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
    });

    it("filters edges by ?edge_type=hypothesis_claims_value_driver", async () => {
      const res = await request(app).get(
        "/case-001/graph/edges?edge_type=hypothesis_claims_value_driver",
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].edge_type).toBe("hypothesis_claims_value_driver");
    });
  });

  // -------------------------------------------------------------------------
  // POST /:caseId/graph/edges
  // -------------------------------------------------------------------------

  describe("POST /:caseId/graph/edges", () => {
    const validEdgeBody = {
      from_entity_type: "vg_metric",
      from_entity_id: "metric-001",
      to_entity_type: "vg_value_driver",
      to_entity_id: "driver-001",
      edge_type: "target_quantifies_driver",
      confidence_score: 0.8,
      created_by_agent: "human",
    };

    it("creates a valid edge and returns 201", async () => {
      const res = await request(app).post("/case-001/graph/edges").send(validEdgeBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.edge_type).toBe("target_quantifies_driver");
    });

    it("returns 422 for invalid edge triple (wrong from_entity_type)", async () => {
      const res = await request(app)
        .post("/case-001/graph/edges")
        .send({
          ...validEdgeBody,
          from_entity_type: "evidence", // wrong — target_quantifies_driver requires vg_metric
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("EdgeConstraintViolation");
    });

    it("returns 422 for invalid edge triple (wrong to_entity_type)", async () => {
      const res = await request(app)
        .post("/case-001/graph/edges")
        .send({
          ...validEdgeBody,
          to_entity_type: "vg_metric", // wrong — target_quantifies_driver requires vg_value_driver
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it("returns 422 for unknown edge_type", async () => {
      const res = await request(app)
        .post("/case-001/graph/edges")
        .send({
          ...validEdgeBody,
          edge_type: "nonexistent_edge_type",
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await request(app)
        .post("/case-001/graph/edges")
        .send({ edge_type: "target_quantifies_driver" }); // missing from/to fields

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 404 when case not found", async () => {
      mockGetById.mockResolvedValue(null);

      const res = await request(app).post("/case-999/graph/edges").send(validEdgeBody);

      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:caseId/graph/integrity
  // -------------------------------------------------------------------------

  describe("GET /:caseId/graph/integrity", () => {
    it("returns gap report with uncovered claims", async () => {
      // MOCK_GRAPH has hypothesis_claims_value_driver edge but no evidence_supports_metric
      const res = await request(app).get("/case-001/graph/integrity");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_claims).toBe(1);
      expect(res.body.data.gap_count).toBe(1);
      expect(res.body.data.covered_claims).toBe(0);
      expect(res.body.data.gaps[0].gap_type).toBe("no_evidence_supports_metric");
    });

    it("reports zero gaps when all claims have evidence-backed metric paths", async () => {
      // Add evidence_supports_metric + metric_maps_to_value_driver edges
      mockGetGraph.mockResolvedValue({
        ...MOCK_GRAPH,
        edges: [
          ...MOCK_GRAPH.edges,
          {
            id: "edge-004", organization_id: "org-456", opportunity_id: "case-001",
            from_entity_type: "evidence", from_entity_id: "ev-001",
            to_entity_type: "vg_metric", to_entity_id: "metric-001",
            edge_type: "evidence_supports_metric", confidence_score: 0.9,
            evidence_ids: [], created_by_agent: "RealizationAgent", ontology_version: "1.0",
            created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "edge-005", organization_id: "org-456", opportunity_id: "case-001",
            from_entity_type: "vg_metric", from_entity_id: "metric-001",
            to_entity_type: "vg_value_driver", to_entity_id: "driver-001",
            edge_type: "metric_maps_to_value_driver", confidence_score: 0.85,
            evidence_ids: [], created_by_agent: "FinancialModelingAgent", ontology_version: "1.0",
            created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      });

      const res = await request(app).get("/case-001/graph/integrity");

      expect(res.status).toBe(200);
      expect(res.body.data.gap_count).toBe(0);
      expect(res.body.data.covered_claims).toBe(1);
    });
  });
});
