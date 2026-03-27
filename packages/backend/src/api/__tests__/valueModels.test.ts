import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock ScenarioBuilder so tests don't need a real DB or LLM
// ---------------------------------------------------------------------------

const mockBuildScenarios = vi.fn();

vi.mock("../../services/value/ScenarioBuilder.js", () => ({
  ScenarioBuilder: vi.fn().mockImplementation(() => ({
    buildScenarios: mockBuildScenarios,
  })),
}));

// ---------------------------------------------------------------------------
// Mock Supabase for the repository layer
// ---------------------------------------------------------------------------

type ScenarioRecord = {
  id: string;
  organization_id: string;
  case_id: string;
  scenario_type: "base";
  assumptions_snapshot_json: {
    // Metadata stored under __meta to avoid collisions with assumption keys.
    __meta?: { name?: string | null; description?: string | null };
    assumptions: Array<{ key: string; value: number; unit?: string }>;
    annualSavings: number;
  };
  roi: number;
  npv?: number | null;
  payback_months: number;
  cost_input_usd?: number | null;
  timeline_years?: number | null;
  investment_source?: "explicit" | "assumptions_register" | "default" | null;
  created_at: string;
};

type QueryLogEntry = {
  type: "select" | "insert";
  table: string;
  filters: Array<{ column: string; value: string }>;
};

class MockScenariosTableQuery {
  private filters: Array<{ column: string; value: string }> = [];
  private selected = "*";

  constructor(
    private readonly store: ScenarioRecord[],
    private readonly queryLog: QueryLogEntry[],
    private readonly mode: "select" | "insert",
    private readonly insertPayload?: Omit<ScenarioRecord, "id" | "created_at">
  ) {}

  select(columns: string) {
    this.selected = columns;
    return this;
  }

  eq(column: string, value: string) {
    this.filters.push({ column, value });
    return this;
  }

  order() {
    return Promise.resolve(this.buildSelectResponse());
  }

  async single() {
    if (this.mode === "insert" && this.insertPayload) {
      const id = `00000000-0000-4000-8000-${String(this.store.length + 1).padStart(12, "0")}`;
      const created_at = new Date(`2026-03-26T00:00:${String(this.store.length).padStart(2, "0")}.000Z`).toISOString();
      const row: ScenarioRecord = { id, created_at, ...this.insertPayload };
      this.store.push(row);
      this.queryLog.push({ type: "insert", table: "scenarios", filters: [] });
      return this.selected === "id"
        ? { data: { id }, error: null }
        : { data: row, error: null };
    }

    const response = this.buildSelectResponse();
    return {
      data: response.data[0] ?? null,
      error: response.data[0] ? null : { message: "not found" },
    };
  }

  private buildSelectResponse() {
    let rows = [...this.store];
    for (const filter of this.filters) {
      rows = rows.filter((row) => {
        const rowValue = row[filter.column as keyof ScenarioRecord];
        return String(rowValue) === filter.value;
      });
    }
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    this.queryLog.push({ type: "select", table: "scenarios", filters: [...this.filters] });
    return { data: rows, error: null };
  }
}

class MockSupabaseClient {
  constructor(
    private readonly store: ScenarioRecord[],
    private readonly queryLog: QueryLogEntry[]
  ) {}

  from(table: string) {
    if (table !== "scenarios") throw new Error(`Unexpected table: ${table}`);
    return {
      select: (columns: string) =>
        new MockScenariosTableQuery(this.store, this.queryLog, "select").select(columns),
      insert: (payload: Omit<ScenarioRecord, "id" | "created_at">) =>
        new MockScenariosTableQuery(this.store, this.queryLog, "insert", payload),
    };
  }
}

const persistentStore: ScenarioRecord[] = [];
const queryLog: QueryLogEntry[] = [];

async function buildTestApp() {
  vi.resetModules();

  const supabase = new MockSupabaseClient(persistentStore, queryLog);

  vi.doMock("../../middleware/auth.js", () => ({
    requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.tenantId = req.header("x-tenant-id") ?? "tenant-a";
      req.supabase = supabase as never;
      next();
    },
  }));

  vi.doMock("../../middleware/rbac.js", () => ({
    requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  }));

  vi.doMock("../../middleware/tenantContext.js", () => ({
    tenantContextMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  }));

  const { valueModelsRouter } = await import("../valueModels.js");

  const app = express();
  app.use(express.json());
  app.use("/api/value-models", valueModelsRouter);

  return app;
}

describe("valueModelsRouter", () => {
  beforeEach(() => {
    persistentStore.length = 0;
    queryLog.length = 0;
    mockBuildScenarios.mockReset();
  });

  // ---------------------------------------------------------------------------
  // ScenarioBuilder delegation
  // ---------------------------------------------------------------------------

  describe("POST /scenarios — delegates to ScenarioBuilder", () => {
    it("calls ScenarioBuilder.buildScenarios, not inline math", async () => {
      const builtScenario = {
        id: "built-scenario-id",
        organization_id: "tenant-a",
        case_id: "model-1",
        scenario_type: "base",
        roi: 1.5,
        npv: 250_000,
        payback_months: 18,
        cost_input_usd: 100_000,
        timeline_years: 3,
        investment_source: "explicit",
        assumptions_snapshot_json: {},
        evf_decomposition_json: { revenue_uplift: 0, cost_reduction: 0, risk_mitigation: 0, efficiency_gain: 0 },
        sensitivity_results_json: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Pre-seed the store so loadById succeeds.
      // Simulate what ScenarioBuilder writes: name/description stored under
      // __meta to avoid collisions with user-supplied assumption keys.
      persistentStore.push({
        id: "built-scenario-id",
        organization_id: "tenant-a",
        case_id: "model-1",
        scenario_type: "base",
        assumptions_snapshot_json: { __meta: { name: "Base case" }, assumptions: [], annualSavings: 0 },
        roi: 1.5,
        payback_months: 18,
        created_at: new Date().toISOString(),
      });

      mockBuildScenarios.mockResolvedValue({
        conservative: { ...builtScenario, scenario_type: "conservative" },
        base: builtScenario,
        upside: { ...builtScenario, scenario_type: "upside" },
      });

      const app = await buildTestApp();

      const response = await request(app)
        .post("/api/value-models/model-1/scenarios")
        .set("x-tenant-id", "tenant-a")
        .send({
          name: "Base case",
          assumptions: [{ key: "headcount", value: 125_000 }],
          estimatedCostUsd: 100_000,
        });

      expect(response.status).toBe(201);
      expect(mockBuildScenarios).toHaveBeenCalledOnce();

      // Verify name and organizationId are forwarded to ScenarioBuilder
      const callArgs = mockBuildScenarios.mock.calls[0][0];
      expect(callArgs.organizationId).toBe("tenant-a");
      expect(callArgs.estimatedCostUsd).toBe(100_000);
      expect(callArgs.name).toBe("Base case");

      // Verify the name round-trips through the repository to the response
      expect(response.body.scenario.name).toBe("Base case");
    });

    it("does not contain roiPercent = annualSavings / 10000 logic", async () => {
      // This test verifies the service file no longer contains the old formula
      // by importing it and checking the create method delegates to ScenarioBuilder
      const { ValueModelScenariosService } = await import("../valueModels/service.js");
      const serviceSource = ValueModelScenariosService.toString();

      expect(serviceSource).not.toContain("annualSavings / 10000");
      expect(serviceSource).not.toContain("36 - Math.min");
    });
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation
  // ---------------------------------------------------------------------------

  describe("tenant isolation", () => {
    it("enforces organization_id filter on list", async () => {
      const app = await buildTestApp();

      persistentStore.push({
        id: "s-tenant-a",
        organization_id: "tenant-a",
        case_id: "model-iso",
        scenario_type: "base",
        assumptions_snapshot_json: { __meta: { name: "Tenant A" }, assumptions: [], annualSavings: 0 },
        roi: 1.0,
        payback_months: 12,
        created_at: new Date().toISOString(),
      });

      persistentStore.push({
        id: "s-tenant-b",
        organization_id: "tenant-b",
        case_id: "model-iso",
        scenario_type: "base",
        assumptions_snapshot_json: { __meta: { name: "Tenant B" }, assumptions: [], annualSavings: 0 },
        roi: 2.0,
        payback_months: 6,
        created_at: new Date().toISOString(),
      });

      const tenantAList = await request(app)
        .get("/api/value-models/model-iso/scenarios")
        .set("x-tenant-id", "tenant-a")
        .expect(200);

      expect(tenantAList.body.scenarios).toHaveLength(1);
      expect(tenantAList.body.scenarios[0].name).toBe("Tenant A");

      const orgFilterHits = queryLog.filter((entry) =>
        entry.type === "select" &&
        entry.filters.some((f) => f.column === "organization_id")
      );
      expect(orgFilterHits.length).toBeGreaterThan(0);
    });
  });
});
