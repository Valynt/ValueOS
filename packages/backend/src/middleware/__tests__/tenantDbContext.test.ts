import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConnect = vi.fn();
const mockPool = vi.fn(() => ({
  connect: mockConnect,
}));

vi.mock("pg", () => ({
  Pool: mockPool,
}));

describe("tenantDbContextMiddleware", () => {
  let tenantDbContextMiddleware: typeof import("../tenantDbContext").tenantDbContextMiddleware;

  beforeEach(async () => {
    ({ tenantDbContextMiddleware } = await import("../tenantDbContext"));
  });

  it("sets SET LOCAL tenant context and releases on finish", async () => {
    const query = vi.fn();
    const release = vi.fn();
    const client = { query, release };
    mockConnect.mockResolvedValueOnce(client);

    const handlers: Record<string, () => void> = {};
    const req: any = { tenantId: "tenant-123" };
    const res: any = {
      on: (event: string, handler: () => void) => {
        handlers[event] = handler;
      },
    };
    const next = vi.fn();

    await tenantDbContextMiddleware()(req, res, next);

    expect(query).toHaveBeenCalledWith("BEGIN");
    expect(query).toHaveBeenCalledWith("SET LOCAL app.tenant_id = $1", [
      "tenant-123",
    ]);
    expect(req.dbClient).toBe(client);
    expect(next).toHaveBeenCalled();

    handlers.finish();

    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalled();
  });

  it("skips when no tenant id is present", async () => {
    const req: any = {};
    const res: any = { on: vi.fn() };
    const next = vi.fn();

    await tenantDbContextMiddleware()(req, res, next);

    expect(mockConnect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
