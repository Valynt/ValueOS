import { beforeEach, describe, expect, it, vi } from "vitest";

describe("tenantDbContextMiddleware", () => {
  let tenantDbContextMiddleware: typeof import("../tenantDbContext").tenantDbContextMiddleware;

  beforeEach(async () => {
    ({ tenantDbContextMiddleware } = await import("../tenantDbContext"));
  });

  it("is a no-op for tenant context when disabled", async () => {
    const req: any = { tenantId: "tenant-123" };
    const res: any = { on: vi.fn() };
    const next = vi.fn();

    await tenantDbContextMiddleware()(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("still calls next when no tenant id is present", async () => {
    const req: any = {};
    const res: any = { on: vi.fn() };
    const next = vi.fn();

    await tenantDbContextMiddleware()(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
