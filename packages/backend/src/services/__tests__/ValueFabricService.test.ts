import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValueFabricService } from "../../services/ValueFabricService.js";
import { createBoltClientMock } from "../utils/mockSupabaseClient.js";

const baseTables = {
  capabilities: [
    {
      id: "cap-1",
      name: "Automation",
      is_active: true,
      tags: ["automation", "workflow"],
      category: "platform",
    },
    { id: "cap-2", name: "Analytics", is_active: true, tags: ["analytics"], category: "insights" },
    {
      id: "cap-3",
      name: "Workflow Automation Suite",
      is_active: true,
      tags: ["automation", "orchestration"],
      category: "platform",
    },
    {
      id: "cap-4",
      name: "Automation Insights",
      is_active: true,
      tags: ["automation", "analytics"],
      category: "insights",
    },
  ],
  benchmarks: [
    {
      id: "bench-1",
      kpi_name: "NPS",
      industry: "SaaS",
      percentile: 25,
      value: 20,
      data_date: "2024-01-01",
    },
    {
      id: "bench-2",
      kpi_name: "NPS",
      industry: "SaaS",
      percentile: 50,
      value: 35,
      data_date: "2024-01-01",
    },
    {
      id: "bench-3",
      kpi_name: "NPS",
      industry: "SaaS",
      percentile: 75,
      value: 55,
      data_date: "2024-01-01",
    },
    {
      id: "bench-4",
      kpi_name: "NPS",
      industry: "SaaS",
      percentile: 90,
      value: 70,
      data_date: "2024-01-01",
    },
  ],
};

let supabase: any;
let service: ValueFabricService;

beforeEach(() => {
  supabase = createBoltClientMock(baseTables);
  (global.fetch as any) = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
  });
  service = new ValueFabricService(supabase);
});

describe("ValueFabricService semantic search and ontology queries", () => {
  it("returns semantic search results when RPC succeeds", async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        { item: baseTables.capabilities[0], similarity: 0.9 },
        { item: baseTables.capabilities[1], similarity: 0.8 },
      ],
      error: null,
    });

    const results = await service.semanticSearchCapabilities("automate workflows", 2);
    expect(results).toHaveLength(2);
    expect(results[0].item.name).toBe("Automation");
  });

  it("falls back to text search when RPC fails", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: new Error("pgvector unavailable") });

    const results = await service.semanticSearchCapabilities("analytics", 1);
    expect(results[0].item.name).toBe("Analytics");
    expect(supabase.from).toHaveBeenCalled();
  });

  it("fills gaps with text search when semantic results are empty", async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    const results = await service.semanticSearchCapabilities("analytics", 1);
    expect(results).toHaveLength(1);
    expect(results[0].item.name).toBe("Analytics");
  });

  it("combines semantic and text matches to satisfy limit", async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ item: baseTables.capabilities[0], similarity: 0.92 }],
      error: null,
    });

    const results = await service.semanticSearchCapabilities("automation", 3);

    expect(results.map((r) => r.item.name)).toEqual([
      "Automation",
      "Automation Insights",
      "Workflow Automation Suite",
    ]);
  });

  it("calculates benchmark percentiles and comparison values", async () => {
    const percentiles = await service.getBenchmarkPercentiles("NPS", "SaaS");
    expect(percentiles).toEqual({ p25: 20, p50: 35, p75: 55, p90: 70 });
  });

  it("creates a benchmark without VMRT logging", async () => {
    const newBenchmark = {
      name: "Test Benchmark",
      description: "A test benchmark",
      industry: "Tech",
      metric_name: "Revenue",
      metric_value: 1000000,
      unit: "USD",
      source: "Internal",
      date_collected: "2024-01-01",
    };

    supabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "bench-new", ...newBenchmark },
            error: null,
          }),
        }),
      }),
    });

    const result = await service.createBenchmark(newBenchmark);
    expect(result.id).toBe("bench-new");
    expect(result.name).toBe("Test Benchmark");
  });

  it("creates a benchmark with VMRT logging", async () => {
    const newBenchmark = {
      name: "Test Benchmark",
      description: "A test benchmark",
      industry: "Tech",
      metric_name: "Revenue",
      metric_value: 1000000,
      unit: "USD",
      source: "Internal",
      date_collected: "2024-01-01",
    };

    const vmrtTrace = {
      trace_type: "benchmark_creation",
      reasoning_steps: [
        {
          step: 1,
          logic: "Calculated based on industry standards",
          formula: "value = baseline * multiplier",
          variables: { baseline: 500000, multiplier: 2 },
          outcome: "Revenue benchmark set to 1000000 USD",
        },
      ],
      outcome_category: "cost_savings",
      timestamp: new Date().toISOString(),
    };

    supabase.from
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "bench-new", ...newBenchmark },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

    const result = await service.createBenchmark(newBenchmark, vmrtTrace, "tenant-1", "user-1");
    expect(result.id).toBe("bench-new");
    expect(supabase.from).toHaveBeenCalledWith("audit_log");
  });

  it("updates a benchmark with VMRT logging", async () => {
    const updates = { metric_value: 1200000 };

    supabase.from
      .mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "bench-1", ...updates },
                error: null,
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

    const vmrtTrace = {
      trace_type: "benchmark_update",
      reasoning_steps: [
        {
          step: 1,
          logic: "Updated based on new data",
          variables: { old_value: 1000000, new_value: 1200000 },
          outcome: "Revenue benchmark updated",
        },
      ],
      outcome_category: "performance_improvement",
      timestamp: new Date().toISOString(),
    };

    const result = await service.updateBenchmark(
      "bench-1",
      updates,
      vmrtTrace,
      "tenant-1",
      "user-1"
    );
    expect(result.metric_value).toBe(1200000);
    expect(supabase.from).toHaveBeenCalledWith("audit_log");
  });
});
