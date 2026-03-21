import { describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

const { ValueCasesRepository, NotFoundError } = await import("../repository.js");

type Row = { id: string; tenant_id: string; name: string; created_at: string; updated_at: string };

type Filter = { column: string; value: unknown };

function createUserScopedClient(rows: Row[], tenantId: string) {
  const applyFilters = (filters: Filter[]) => {
    const visibleRows = rows.filter((row) => row.tenant_id === tenantId);
    const filtered = visibleRows.filter((row) => filters.every((filter) => (row as Record<string, unknown>)[filter.column] === filter.value));
    return filtered;
  };

  const buildQuery = (filters: Filter[] = []) => ({
    select: () => buildQuery(filters),
    eq: (column: string, value: unknown) => buildQuery([...filters, { column, value }]),
    order: () => buildQuery(filters),
    range: async () => {
      const filtered = applyFilters(filters);
      return { data: filtered, error: null, count: filtered.length };
    },
    maybeSingle: async () => {
      const filtered = applyFilters(filters);
      return { data: filtered[0] ?? null, error: null };
    },
    single: async () => {
      const filtered = applyFilters(filters);
      if (filtered.length === 0) {
        return { data: null, error: { code: "PGRST116", message: "No rows" } };
      }
      return { data: filtered[0], error: null };
    },
  });

  return {
    from: () => buildQuery(),
  };
}

describe("user-scoped client cross-tenant protection", () => {
  const rows: Row[] = [
    { id: "case-a", tenant_id: "tenant-a", name: "Tenant A Case", created_at: "2026-01-01", updated_at: "2026-01-01" },
    { id: "case-b", tenant_id: "tenant-b", name: "Tenant B Case", created_at: "2026-01-01", updated_at: "2026-01-01" },
  ];

  it("raw user-scoped reads still deny cross-tenant data when tenant filters are omitted", async () => {
    const userClient = createUserScopedClient(rows, "tenant-a");

    const result = await userClient.from("value_cases").select("*").eq("id", "case-b").maybeSingle();

    expect(result.data).toBeNull();
  });

  it("repository lookups cannot read another tenant even if the caller supplies a foreign tenant id", async () => {
    const userClient = createUserScopedClient(rows, "tenant-a") as never;
    const repo = new ValueCasesRepository(userClient);

    await expect(repo.getById("tenant-a", "case-a")).resolves.toMatchObject({ id: "case-a" });
    await expect(repo.getById("tenant-b", "case-b")).rejects.toBeInstanceOf(NotFoundError);
  });
});
