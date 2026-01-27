import { describe, expect, it, vi } from "vitest";
import { InitiativesRepository } from "../repository.js"
import { DbConflictError } from "../../../lib/db/errors.js"

const buildDb = (query: ReturnType<typeof vi.fn>) => ({
  client: {} as any,
  query,
});

describe("InitiativesRepository", () => {
  it("scopes list queries by tenant", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repo = new InitiativesRepository(buildDb(query));

    await repo.list("tenant-123", {
      limit: 10,
      sortBy: "created_at",
      sortDirection: "desc",
    });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("tenant_id = $1");
    expect(sql).toContain("deleted_at IS NULL");
    expect(params).toContain("tenant-123");
  });

  it("maps unique violations to conflicts", async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql.startsWith("SAVEPOINT")) {
        return Promise.resolve({});
      }
      if (sql.includes("INSERT INTO initiatives")) {
        return Promise.reject({ code: "23505", message: "duplicate" });
      }
      if (sql.startsWith("ROLLBACK TO SAVEPOINT")) {
        return Promise.resolve({});
      }
      return Promise.resolve({ rows: [] });
    });

    const repo = new InitiativesRepository(buildDb(query));

    await expect(
      repo.create("tenant-123", "user-1", {
        name: "Launch",
        ownerEmail: "owner@example.com",
        status: "draft",
        category: "growth",
        priority: 3,
        tags: [],
      })
    ).rejects.toBeInstanceOf(DbConflictError);

    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("ROLLBACK TO SAVEPOINT initiative_create")
      )
    ).toBe(true);
  });

  it("rolls back when update fails", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({});

    const repo = new InitiativesRepository(buildDb(query));

    await expect(
      repo.update("tenant-123", "user-1", "initiative-1", {
        name: "Updated",
      })
    ).rejects.toThrow("boom");

    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("ROLLBACK TO SAVEPOINT initiative_update")
      )
    ).toBe(true);
  });
});
