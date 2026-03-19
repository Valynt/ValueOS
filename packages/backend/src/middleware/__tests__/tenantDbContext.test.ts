import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDatabaseUrl } from "../../config/database.js";
import { tenantDbContextMiddleware } from "../tenantDbContext.js";

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

const mockConnect = vi.fn();
const mockPool = { connect: mockConnect, on: vi.fn(), end: vi.fn().mockResolvedValue(undefined) };
const mockPoolConstructor = vi.fn(function MockPool() {
  return mockPool;
});

vi.mock("../../config/database", () => ({
  getDatabaseUrl: vi.fn(),
}));

vi.mock("../../config/settings.js", () => ({
  settings: {
    databasePool: {
      appEnv: "prod",
      role: "api",
      expectedConcurrency: 8,
      max: 4,
      maxSource: "derived",
      idleTimeoutMs: 30_000,
      connectionTimeoutMs: 5_000,
      statementTimeoutMs: 30_000,
      queryTimeoutMs: 30_000,
    },
  },
}));

vi.mock("pg", () => ({
  Pool: mockPoolConstructor,
}));

const buildResponse = () => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const res = {
    statusCode: 200,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { res, handlers };
};

describe("tenantDbContextMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [] });
  });

  it("rejects requests without tenant context", async () => {
    const req = {};
    const { res } = buildResponse();
    const next = vi.fn();

    await tenantDbContextMiddleware()(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "tenant_required",
      message: "Tenant context is required for database access.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns an error when DATABASE_URL is missing", async () => {
    vi.mocked(getDatabaseUrl).mockReturnValue(undefined as unknown as string);

    const req = { tenantId: "tenant-123" };
    const { res } = buildResponse();
    const next = vi.fn();

    await tenantDbContextMiddleware()(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "tenant_db_unavailable",
      message: "Tenant database connection is not configured.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("pins the request to a transaction, sets the tenant id, and uses the derived pool size", async () => {
    vi.mocked(getDatabaseUrl).mockReturnValue("postgres://localhost:5432/db");

    const req = { tenantId: "tenant-123" };
    const { res, handlers } = buildResponse();
    const next = vi.fn();

    await tenantDbContextMiddleware()(req as never, res as never, next);

    expect(mockPoolConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: "postgres://localhost:5432/db",
        max: 4,
      })
    );
    expect(mockConnect).toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
    expect(mockClient.query).toHaveBeenCalledWith("SET LOCAL app.tenant_id = $1", ["tenant-123"]);
    expect((req as { db?: { client: typeof mockClient } }).db?.client).toBe(mockClient);
    expect(next).toHaveBeenCalled();

    handlers.finish?.();
    await Promise.resolve();

    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("rolls back transaction when response fails", async () => {
    vi.mocked(getDatabaseUrl).mockReturnValue("postgres://localhost:5432/db");

    const req = { tenantId: "tenant-123" };
    const { res, handlers } = buildResponse();
    const next = vi.fn();

    await tenantDbContextMiddleware()(req as never, res as never, next);

    res.statusCode = 500;
    handlers.finish?.();
    await Promise.resolve();

    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClient.release).toHaveBeenCalled();
  });
});
