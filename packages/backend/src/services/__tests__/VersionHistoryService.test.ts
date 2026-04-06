import { beforeEach, describe, expect, it, vi } from "vitest";

interface SettingsVersionRow {
  id: string;
  setting_key: string;
  old_value: unknown;
  new_value: unknown;
  scope: "user" | "team" | "organization";
  scope_id: string;
  changed_by: string;
  change_description?: string;
  change_type: "create" | "update" | "delete";
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  rolled_back: boolean;
  rolled_back_at?: string;
  rolled_back_by?: string;
  organization_id: string;
}

interface QueryResult {
  data: SettingsVersionRow[] | SettingsVersionRow | null;
  error: null | { message: string };
}

const dbRows: SettingsVersionRow[] = [];

class MockQueryBuilder implements PromiseLike<QueryResult> {
  private filters: Array<{ field: string; value: unknown }> = [];
  private updatePayload: Partial<SettingsVersionRow> | null = null;
  private isMutation = false;

  eq(field: string, value: unknown): this {
    this.filters.push({ field, value });
    return this;
  }

  gte(): this {
    return this;
  }

  lte(): this {
    return this;
  }

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  range(): this {
    return this;
  }

  update(payload: Partial<SettingsVersionRow>): this {
    this.updatePayload = payload;
    this.isMutation = true;
    return this;
  }

  select(): this {
    return this;
  }

  single(): Promise<QueryResult> {
    const matching = dbRows.filter((row) =>
      this.filters.every((filter) => row[filter.field as keyof SettingsVersionRow] === filter.value)
    );

    if (this.isMutation) {
      if (matching.length === 0) {
        return Promise.resolve({
          data: null,
          error: { message: "No rows updated" },
        });
      }

      matching.forEach((row) => Object.assign(row, this.updatePayload));
      return Promise.resolve({ data: matching[0], error: null });
    }

    if (matching.length === 0) {
      return Promise.resolve({
        data: null,
        error: { message: "No rows" },
      });
    }

    return Promise.resolve({ data: matching[0], error: null });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const matching = dbRows.filter((row) =>
      this.filters.every((filter) => row[filter.field as keyof SettingsVersionRow] === filter.value)
    );
    const result: QueryResult = { data: matching, error: null };
    return Promise.resolve(result).then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

vi.mock("../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: null,
  getSupabaseClient: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("../utils/BaseService.js", () => {
  class BaseService {
    protected supabase = {
      from: vi.fn(() => new MockQueryBuilder()),
    };

    protected log = vi.fn();
    protected validateRequired = vi.fn();
    protected clearCache = vi.fn();

    protected async executeRequest<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    }
  }

  return { BaseService };
});

import { VersionHistoryService } from "../auth/VersionHistoryService.js";

const makeRow = (overrides: Partial<SettingsVersionRow>): SettingsVersionRow => ({
  id: "v1",
  setting_key: "theme",
  old_value: { mode: "light" },
  new_value: { mode: "dark" },
  scope: "organization",
  scope_id: "org-1",
  changed_by: "user-1",
  change_type: "update",
  created_at: "2026-01-01T00:00:00Z",
  rolled_back: false,
  organization_id: "org-1",
  ...overrides,
});

describe("VersionHistoryService tenant isolation", () => {
  let service: VersionHistoryService;

  beforeEach(() => {
    dbRows.splice(0, dbRows.length);
    service = new VersionHistoryService();
  });

  it("returns history for the same tenant", async () => {
    dbRows.push(
      makeRow({ id: "v1", organization_id: "org-1" }),
      makeRow({ id: "v2", organization_id: "org-2" })
    );

    const history = await service.getHistory({ organizationId: "org-1" });

    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("v1");
  });

  it("returns not found for cross-tenant version lookup", async () => {
    dbRows.push(makeRow({ id: "v1", organization_id: "org-2" }));

    await expect(service.getVersion("v1", "org-1")).rejects.toThrow();
  });

  it("does not mutate another tenant row during rollback", async () => {
    dbRows.push(makeRow({ id: "v1", organization_id: "org-2", rolled_back: false }));

    await expect(service.rollback("v1", "user-1", "org-1")).rejects.toThrow();

    expect(dbRows[0].rolled_back).toBe(false);
    expect(dbRows[0].organization_id).toBe("org-2");
  });
});
