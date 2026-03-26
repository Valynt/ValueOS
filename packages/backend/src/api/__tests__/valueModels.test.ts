import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ScenarioRecord = {
  id: string;
  organization_id: string;
  case_id: string;
  scenario_type: "base";
  assumptions_snapshot_json: {
    name: string;
    description?: string;
    assumptions: Array<{ key: string; value: number; unit?: string }>;
    annualSavings: number;
  };
  roi: number;
  payback_months: number;
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
      const row: ScenarioRecord = {
        id,
        created_at,
        ...this.insertPayload,
      };
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
    if (table !== "scenarios") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      select: (columns: string) => new MockScenariosTableQuery(this.store, this.queryLog, "select").select(columns),
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
  });

  it("persists scenarios through Supabase and DB-generated IDs", async () => {
    const app = await buildTestApp();

    const createResponse = await request(app)
      .post("/api/value-models/model-1/scenarios")
      .set("x-tenant-id", "tenant-a")
      .send({
        name: "Base case",
        assumptions: [{ key: "headcount", value: 125000 }],
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.scenario.id).toMatch(/^00000000-0000-4000-8000-/);
    expect(createResponse.body.scenario.id).not.toMatch(/^scenario_/);

    const listResponse = await request(app)
      .get("/api/value-models/model-1/scenarios")
      .set("x-tenant-id", "tenant-a");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.scenarios).toHaveLength(1);
    expect(listResponse.body.scenarios[0].name).toBe("Base case");
  });

  it("is restart-safe by reading persisted records after router re-import", async () => {
    const app1 = await buildTestApp();

    await request(app1)
      .post("/api/value-models/model-9/scenarios")
      .set("x-tenant-id", "tenant-a")
      .send({
        name: "Restart test",
        assumptions: [{ key: "savings", value: 50000 }],
      })
      .expect(201);

    const app2 = await buildTestApp();
    const listResponse = await request(app2)
      .get("/api/value-models/model-9/scenarios")
      .set("x-tenant-id", "tenant-a");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.scenarios).toHaveLength(1);
    expect(listResponse.body.scenarios[0].name).toBe("Restart test");
  });

  it("enforces tenant isolation in filters for create verification and list", async () => {
    const app = await buildTestApp();

    await request(app)
      .post("/api/value-models/model-iso/scenarios")
      .set("x-tenant-id", "tenant-a")
      .send({
        name: "Tenant A",
        assumptions: [{ key: "a", value: 10000 }],
      })
      .expect(201);

    await request(app)
      .post("/api/value-models/model-iso/scenarios")
      .set("x-tenant-id", "tenant-b")
      .send({
        name: "Tenant B",
        assumptions: [{ key: "b", value: 20000 }],
      })
      .expect(201);

    const tenantAList = await request(app)
      .get("/api/value-models/model-iso/scenarios")
      .set("x-tenant-id", "tenant-a")
      .expect(200);

    expect(tenantAList.body.scenarios).toHaveLength(1);
    expect(tenantAList.body.scenarios[0].name).toBe("Tenant A");

    const tenantFilterHits = queryLog.filter((entry) =>
      entry.type === "select" && entry.filters.some((filter) => filter.column === "organization_id")
    );
    const caseFilterHits = queryLog.filter((entry) =>
      entry.type === "select" && entry.filters.some((filter) => filter.column === "case_id")
    );

    expect(tenantFilterHits.length).toBeGreaterThan(0);
    expect(caseFilterHits.length).toBeGreaterThan(0);
  });
});
