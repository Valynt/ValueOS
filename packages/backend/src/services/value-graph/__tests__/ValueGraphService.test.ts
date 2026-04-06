import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: { from: vi.fn() },
}));

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import { ValueGraphService } from "../ValueGraphService.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const OPP_ID = "00000000-0000-0000-0000-000000000002";
const OTHER_ORG = "00000000-0000-0000-0000-000000000099";

const CAP_ID = "00000000-0000-0000-0000-000000000010";
const METRIC_ID = "00000000-0000-0000-0000-000000000020";
const DRIVER_ID = "00000000-0000-0000-0000-000000000030";
const USE_CASE_ID = "00000000-0000-0000-0000-000000000040";

const SAMPLE_CAPABILITY = {
  id: CAP_ID,
  organization_id: ORG_ID,
  opportunity_id: OPP_ID,
  name: "Automated invoice reconciliation",
  description: "Eliminates manual PO-to-invoice matching",
  category: "automation",
  ontology_version: "1.0",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const SAMPLE_METRIC = {
  id: METRIC_ID,
  organization_id: ORG_ID,
  opportunity_id: OPP_ID,
  name: "Days Sales Outstanding",
  unit: "days",
  baseline_value: 45,
  target_value: 33,
  measurement_method: "ERP export average",
  impact_timeframe_months: 6,
  ontology_version: "1.0",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const SAMPLE_DRIVER = {
  id: DRIVER_ID,
  organization_id: ORG_ID,
  opportunity_id: OPP_ID,
  type: "cost_reduction",
  name: "Reduce AP processing cost",
  description: "AP team spends 40% of time on manual reconciliation",
  estimated_impact_usd: 120000,
  ontology_version: "1.0",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const EDGE_UC_CAP = {
  id: "edge-1",
  organization_id: ORG_ID,
  opportunity_id: OPP_ID,
  from_entity_type: "use_case",
  from_entity_id: USE_CASE_ID,
  to_entity_type: "vg_capability",
  to_entity_id: CAP_ID,
  edge_type: "use_case_enabled_by_capability",
  confidence_score: 0.9,
  evidence_ids: [],
  created_by_agent: "OpportunityAgent",
  ontology_version: "1.0",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const EDGE_CAP_METRIC = {
  id: "edge-2",
  organization_id: ORG_ID,
  opportunity_id: OPP_ID,
  from_entity_type: "vg_capability",
  from_entity_id: CAP_ID,
  to_entity_type: "vg_metric",
  to_entity_id: METRIC_ID,
  edge_type: "capability_impacts_metric",
  confidence_score: 0.8,
  evidence_ids: [],
  created_by_agent: "FinancialModelingAgent",
  ontology_version: "1.0",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const EDGE_METRIC_DRIVER = {
  id: "edge-3",
  organization_id: ORG_ID,
  opportunity_id: OPP_ID,
  from_entity_type: "vg_metric",
  from_entity_id: METRIC_ID,
  to_entity_type: "vg_value_driver",
  to_entity_id: DRIVER_ID,
  edge_type: "metric_maps_to_value_driver",
  confidence_score: 0.85,
  evidence_ids: [],
  created_by_agent: "FinancialModelingAgent",
  ontology_version: "1.0",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Creates a Supabase query chain that is properly thenable.
 * Promise.all awaits the chain by calling chain.then(resolve, reject).
 */
function makeQueryChain(result: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => void, _reject: (e: unknown) => void) => {
      resolve(result);
    },
  };
  return chain;
}

/**
 * Creates a Supabase from() mock where each table returns pre-configured data.
 * Tables not in the map return empty data.
 */
function makeFromMock(tableData: Record<string, unknown>) {
  return vi.fn((table: string) => {
    const result = tableData[table] ?? { data: [], error: null };
    return makeQueryChain(result);
  });
}

/**
 * Creates a write chain (insert/upsert → select → single).
 */
function makeWriteChain(result: unknown) {
  return {
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ValueGraphService", () => {
  describe("getGraphForOpportunity", () => {
    it("returns nodes and edges for a seeded opportunity", async () => {
      const fromMock = makeFromMock({
        vg_capabilities: { data: [SAMPLE_CAPABILITY], error: null },
        vg_metrics: { data: [SAMPLE_METRIC], error: null },
        vg_value_drivers: { data: [SAMPLE_DRIVER], error: null },
        value_graph_edges: {
          data: [EDGE_UC_CAP, EDGE_CAP_METRIC, EDGE_METRIC_DRIVER],
          error: null,
        },
      });

      const svc = new ValueGraphService({ from: fromMock } as never);
      const graph = await svc.getGraphForOpportunity(OPP_ID, ORG_ID);

      expect(graph.opportunity_id).toBe(OPP_ID);
      expect(graph.organization_id).toBe(ORG_ID);
      // 1 capability + 1 metric + 1 value driver
      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(3);
      expect(graph.ontology_version).toBe("1.0");
    });

    it("returns empty graph when no data exists", async () => {
      const fromMock = makeFromMock({});
      const svc = new ValueGraphService({ from: fromMock } as never);

      const graph = await svc.getGraphForOpportunity(OPP_ID, ORG_ID);

      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
      expect(graph.ontology_version).toBe("1.0");
    });

    it("scopes all queries to organization_id (tenant isolation)", async () => {
      const eqCalls: Array<[string, string]> = [];
      const trackingFrom = vi.fn((table: string) => {
        const result = { data: [], error: null };
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((col: string, val: string) => {
            eqCalls.push([col, val]);
            return chain;
          }),
          then: (resolve: (v: unknown) => void) => resolve(result),
        };
        return chain;
      });

      const svc = new ValueGraphService({ from: trackingFrom } as never);
      await svc.getGraphForOpportunity(OPP_ID, ORG_ID);

      const orgIdCalls = eqCalls.filter(([col]) => col === "organization_id");
      // 4 tables × 1 org_id filter each = 4 calls minimum
      expect(orgIdCalls.length).toBeGreaterThanOrEqual(4);
      orgIdCalls.forEach(([, val]) => {
        expect(val).toBe(ORG_ID);
      });
    });

    it("throws when a supabase query fails", async () => {
      const fromMock = makeFromMock({
        vg_capabilities: { data: null, error: { message: "db error" } },
        vg_metrics: { data: [], error: null },
        vg_value_drivers: { data: [], error: null },
        value_graph_edges: { data: [], error: null },
      });

      const svc = new ValueGraphService({ from: fromMock } as never);

      await expect(svc.getGraphForOpportunity(OPP_ID, ORG_ID)).rejects.toMatchObject({
        message: "db error",
      });
    });
  });

  describe("getValuePaths", () => {
    it("returns a deterministic path for a fully connected graph", async () => {
      const fromMock = makeFromMock({
        vg_capabilities: { data: [SAMPLE_CAPABILITY], error: null },
        vg_metrics: { data: [SAMPLE_METRIC], error: null },
        vg_value_drivers: { data: [SAMPLE_DRIVER], error: null },
        value_graph_edges: {
          data: [EDGE_UC_CAP, EDGE_CAP_METRIC, EDGE_METRIC_DRIVER],
          error: null,
        },
      });

      const svc = new ValueGraphService({ from: fromMock } as never);
      const paths = await svc.getValuePaths(OPP_ID, ORG_ID);

      expect(paths).toHaveLength(1);
      const path = paths[0];
      expect(path.use_case_id).toBe(USE_CASE_ID);
      expect(path.value_driver.id).toBe(DRIVER_ID);
      expect(path.value_driver.type).toBe("cost_reduction");
      expect(path.capabilities).toHaveLength(1);
      expect(path.capabilities[0].id).toBe(CAP_ID);
      expect(path.metrics).toHaveLength(1);
      expect(path.metrics[0].id).toBe(METRIC_ID);
      expect(path.edges).toHaveLength(3);
    });

    it("computes path_confidence as product of edge confidence_scores", async () => {
      const fromMock = makeFromMock({
        vg_capabilities: { data: [SAMPLE_CAPABILITY], error: null },
        vg_metrics: { data: [SAMPLE_METRIC], error: null },
        vg_value_drivers: { data: [SAMPLE_DRIVER], error: null },
        value_graph_edges: {
          data: [EDGE_UC_CAP, EDGE_CAP_METRIC, EDGE_METRIC_DRIVER],
          error: null,
        },
      });

      const svc = new ValueGraphService({ from: fromMock } as never);
      const paths = await svc.getValuePaths(OPP_ID, ORG_ID);

      // 0.9 * 0.8 * 0.85 = 0.612
      expect(paths[0].path_confidence).toBeCloseTo(0.612, 3);
    });

    it("returns empty array when graph has no edges", async () => {
      const fromMock = makeFromMock({});
      const svc = new ValueGraphService({ from: fromMock } as never);

      const paths = await svc.getValuePaths(OPP_ID, ORG_ID);
      expect(paths).toHaveLength(0);
    });

    it("returns empty array when capability node is missing (dangling edge)", async () => {
      const fromMock = makeFromMock({
        vg_capabilities: { data: [], error: null }, // no capability nodes
        vg_metrics: { data: [SAMPLE_METRIC], error: null },
        vg_value_drivers: { data: [SAMPLE_DRIVER], error: null },
        value_graph_edges: {
          data: [EDGE_UC_CAP, EDGE_CAP_METRIC, EDGE_METRIC_DRIVER],
          error: null,
        },
      });

      const svc = new ValueGraphService({ from: fromMock } as never);
      const paths = await svc.getValuePaths(OPP_ID, ORG_ID);

      expect(paths).toHaveLength(0);
    });

    it("sorts paths by path_confidence descending", async () => {
      const CAP_ID_2 = "00000000-0000-0000-0000-000000000011";
      const METRIC_ID_2 = "00000000-0000-0000-0000-000000000021";

      const cap2 = { ...SAMPLE_CAPABILITY, id: CAP_ID_2, name: "Cap 2" };
      const metric2 = { ...SAMPLE_METRIC, id: METRIC_ID_2, name: "Metric 2" };

      // Second path: 0.5 * 0.5 * 0.5 = 0.125
      const edgeUcCap2 = { ...EDGE_UC_CAP, id: "edge-4", to_entity_id: CAP_ID_2, confidence_score: 0.5 };
      const edgeCapMetric2 = { ...EDGE_CAP_METRIC, id: "edge-5", from_entity_id: CAP_ID_2, to_entity_id: METRIC_ID_2, confidence_score: 0.5 };
      const edgeMetricDriver2 = { ...EDGE_METRIC_DRIVER, id: "edge-6", from_entity_id: METRIC_ID_2, confidence_score: 0.5 };

      const fromMock = makeFromMock({
        vg_capabilities: { data: [SAMPLE_CAPABILITY, cap2], error: null },
        vg_metrics: { data: [SAMPLE_METRIC, metric2], error: null },
        vg_value_drivers: { data: [SAMPLE_DRIVER], error: null },
        value_graph_edges: {
          data: [EDGE_UC_CAP, EDGE_CAP_METRIC, EDGE_METRIC_DRIVER, edgeUcCap2, edgeCapMetric2, edgeMetricDriver2],
          error: null,
        },
      });

      const svc = new ValueGraphService({ from: fromMock } as never);
      const paths = await svc.getValuePaths(OPP_ID, ORG_ID);

      expect(paths).toHaveLength(2);
      expect(paths[0].path_confidence).toBeGreaterThan(paths[1].path_confidence);
      expect(paths[0].capabilities[0].id).toBe(CAP_ID);   // 0.612
      expect(paths[1].capabilities[0].id).toBe(CAP_ID_2); // 0.125
    });
  });

  describe("writeCapability", () => {
    it("inserts and returns the persisted capability", async () => {
      const chain = makeWriteChain({ data: SAMPLE_CAPABILITY, error: null });
      const fromMock = vi.fn().mockReturnValue(chain);
      const svc = new ValueGraphService({ from: fromMock } as never);

      const result = await svc.writeCapability({
        opportunity_id: OPP_ID,
        organization_id: ORG_ID,
        name: "Automated invoice reconciliation",
        description: "Eliminates manual PO-to-invoice matching",
        category: "automation",
      });

      expect(result.id).toBe(CAP_ID);
      expect(result.organization_id).toBe(ORG_ID);
      expect(fromMock).toHaveBeenCalledWith("vg_capabilities");
    });

    it("throws when supabase returns an error", async () => {
      const chain = makeWriteChain({ data: null, error: { message: "insert failed" } });
      const fromMock = vi.fn().mockReturnValue(chain);
      const svc = new ValueGraphService({ from: fromMock } as never);

      await expect(
        svc.writeCapability({
          opportunity_id: OPP_ID,
          organization_id: ORG_ID,
          name: "Test",
          description: "Test description",
          category: "other",
        })
      ).rejects.toMatchObject({ message: "insert failed" });
    });
  });

  describe("writeMetric", () => {
    it("inserts and returns the persisted metric", async () => {
      const chain = makeWriteChain({ data: SAMPLE_METRIC, error: null });
      const fromMock = vi.fn().mockReturnValue(chain);
      const svc = new ValueGraphService({ from: fromMock } as never);

      const result = await svc.writeMetric({
        opportunity_id: OPP_ID,
        organization_id: ORG_ID,
        name: "Days Sales Outstanding",
        unit: "days",
        baseline_value: 45,
        target_value: 33,
      });

      expect(result.id).toBe(METRIC_ID);
      expect(fromMock).toHaveBeenCalledWith("vg_metrics");
    });
  });

  describe("writeValueDriver", () => {
    it("inserts and returns the persisted value driver", async () => {
      const chain = makeWriteChain({ data: SAMPLE_DRIVER, error: null });
      const fromMock = vi.fn().mockReturnValue(chain);
      const svc = new ValueGraphService({ from: fromMock } as never);

      const result = await svc.writeValueDriver({
        opportunity_id: OPP_ID,
        organization_id: ORG_ID,
        type: "cost_reduction",
        name: "Reduce AP processing cost",
        description: "AP team spends 40% of time on manual reconciliation",
      });

      expect(result.id).toBe(DRIVER_ID);
      expect(result.type).toBe("cost_reduction");
      expect(fromMock).toHaveBeenCalledWith("vg_value_drivers");
    });
  });

  describe("writeEdge", () => {
    it("upserts an edge and returns the persisted record", async () => {
      const chain = makeWriteChain({ data: EDGE_UC_CAP, error: null });
      const fromMock = vi.fn().mockReturnValue(chain);
      const svc = new ValueGraphService({ from: fromMock } as never);

      const result = await svc.writeEdge({
        opportunity_id: OPP_ID,
        organization_id: ORG_ID,
        from_entity_type: "use_case",
        from_entity_id: USE_CASE_ID,
        to_entity_type: "vg_capability",
        to_entity_id: CAP_ID,
        edge_type: "use_case_enabled_by_capability",
        confidence_score: 0.9,
        created_by_agent: "OpportunityAgent",
      });

      expect(result.edge_type).toBe("use_case_enabled_by_capability");
      expect(result.confidence_score).toBe(0.9);
      expect(fromMock).toHaveBeenCalledWith("value_graph_edges");
    });

    it("uses onConflict upsert to prevent duplicate edges", async () => {
      const chain = makeWriteChain({ data: EDGE_UC_CAP, error: null });
      const fromMock = vi.fn().mockReturnValue(chain);
      const svc = new ValueGraphService({ from: fromMock } as never);

      await svc.writeEdge({
        opportunity_id: OPP_ID,
        organization_id: ORG_ID,
        from_entity_type: "use_case",
        from_entity_id: USE_CASE_ID,
        to_entity_type: "vg_capability",
        to_entity_id: CAP_ID,
        edge_type: "use_case_enabled_by_capability",
        created_by_agent: "OpportunityAgent",
      });

      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: ORG_ID,
          edge_type: "use_case_enabled_by_capability",
        }),
        expect.objectContaining({
          onConflict: expect.stringContaining("organization_id"),
          ignoreDuplicates: false,
        })
      );
    });

    it("throws when supabase returns an error (simulates RLS violation)", async () => {
      const chain = makeWriteChain({ data: null, error: { message: "RLS violation" } });
      const fromMock = vi.fn().mockReturnValue(chain);
      const svc = new ValueGraphService({ from: fromMock } as never);

      await expect(
        svc.writeEdge({
          opportunity_id: OPP_ID,
          organization_id: OTHER_ORG,
          from_entity_type: "use_case",
          from_entity_id: USE_CASE_ID,
          to_entity_type: "vg_capability",
          to_entity_id: CAP_ID,
          edge_type: "use_case_enabled_by_capability",
          created_by_agent: "OpportunityAgent",
        })
      ).rejects.toMatchObject({ message: "RLS violation" });
    });
  });
});
