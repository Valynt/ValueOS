import { describe, expect, it, vi } from "vitest";

import { VectorSearchService } from "../memory/VectorSearchService.js";

// Supabase is not needed — we test the filter-building logic, not DB execution
vi.mock("../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

describe("VectorSearchService — SQL injection safety", () => {
  const service = new VectorSearchService();

  it("rejects invalid memory types to prevent SQL injection via type parameter", () => {
    // buildFilterClause validates type against a known enum before interpolating
    const buildFilter = (service as unknown as {
      buildFilterClause: (type?: string, filters?: Record<string, unknown>) => string;
    }).buildFilterClause.bind(service);

    expect(() => buildFilter("'; DROP TABLE semantic_memory; --" as any)).toThrow(/Invalid memory type/);
    expect(() => buildFilter("value_proposition")).not.toThrow();
  });

  it("escapes single quotes in string values to prevent SQL injection", () => {
    const escape = (service as unknown as {
      escapeSqlLiteral: (v: string) => string;
    }).escapeSqlLiteral.bind(service);

    expect(escape("safe")).toBe("safe");
    expect(escape("it's")).toBe("it''s");
    expect(escape("'; DROP TABLE foo; --")).toBe("''; DROP TABLE foo; --");
  });

  it("rejects non-identifier filter keys to prevent SQL injection via column names", () => {
    const isSafe = (service as unknown as {
      isSafeIdentifier: (k: string) => boolean;
    }).isSafeIdentifier.bind(service);

    expect(isSafe("valid_column")).toBe(true);
    expect(isSafe("column123")).toBe(true);
    expect(isSafe("'; DROP TABLE--")).toBe(false);
    expect(isSafe("col name")).toBe(false);
    expect(isSafe("col-name")).toBe(false);
  });
});
