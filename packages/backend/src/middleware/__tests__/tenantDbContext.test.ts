import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantDbContextMiddleware } from "../tenantDbContext";
import { getDatabaseUrl } from "../../config/database";

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

const mockConnect = vi.fn();
const mockPool = { connect: mockConnect };

vi.mock("../../config/database", () => ({
  getDatabaseUrl: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: vi.fn(() => mockPool),
}));

const buildResponse = () => {
  const handlers: Record<string, (...args: any[]) => void> = {};
  const res = {
    statusCode: 200,
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
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
    const req: any = {};
    const { res } = buildResponse();
    const next = vi.fn();

    await tenantDbContextMiddleware()(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "tenant_required",
      message: "Tenant context is required for database access.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns an error when DATABASE_URL is missing", async () => {
    (getDatabaseUrl as unknown as { mockReturnValue: (value: string | undefined) => void }).mockReturnValue(undefined);

    const req: any = { tenantId: "tenant-123" };
    const { res } = buildResponse();
    const next = vi.fn();

    await tenantDbContextMiddleware()(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "tenant_db_unavailable",
      message: "Tenant database connection is not configured.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("pins the request to a transaction and sets the tenant id", async () => {
    (getDatabaseUrl as unknown as { mockReturnValue: (value: string | undefined) => void }).mockReturnValue(
      "postgres://localhost:5432/db"
    );

    const req: any = { tenantId: "tenant-123" };
    const { res, handlers } = buildResponse();
    const next = vi.fn();

    await tenantDbContextMiddleware()(req, res as any, next);

    expect(mockConnect).toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
    expect(mockClient.query).toHaveBeenCalledWith("SET LOCAL app.tenant_id = $1", ["tenant-123"]);
    expect(req.db?.client).toBe(mockClient);
    expect(next).toHaveBeenCalled();

    handlers.finish?.();

    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mockClient.release).toHaveBeenCalled();
  });
});
