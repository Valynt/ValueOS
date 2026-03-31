import { describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/supabase.js", () => ({
  createServerSupabaseClient: () => ({ from: () => ({}) }),
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
}));

import { SecurityAnomalyService } from "../SecurityAnomalyService.js";

function makeLog(params: {
  id: string;
  tenantId: string;
  userId?: string;
  action: string;
  status?: "success" | "failed";
  timestamp: string;
  resourceType?: string;
}) {
  return {
    id: params.id,
    tenant_id: params.tenantId,
    organization_id: params.tenantId,
    user_id: params.userId ?? "actor-1",
    action: params.action,
    status: params.status ?? "success",
    details: null,
    timestamp: params.timestamp,
    resource_type: params.resourceType ?? "api",
  };
}

describe("SecurityAnomalyService detector fixtures", () => {
  it("flags anomaly window fixtures", async () => {
    const service = new SecurityAnomalyService() as any;
    const createAlertSpy = vi.spyOn(service, "createAlert").mockResolvedValue({ id: "alert" });

    const windowStart = new Date("2026-04-01T00:00:00.000Z");
    const windowEnd = new Date("2026-04-01T00:15:00.000Z");
    const logs = [
      ...Array.from({ length: 60 }).map((_, idx) =>
        makeLog({
          id: `export-${idx}`,
          tenantId: "tenant-a",
          action: "project.export.bulk",
          timestamp: "2026-04-01T00:03:00.000Z",
        })
      ),
      ...Array.from({ length: 10 }).map((_, idx) =>
        makeLog({
          id: `fail-${idx}`,
          tenantId: "tenant-a",
          action: "api.access.denied",
          status: "failed",
          userId: "actor-fail",
          timestamp: "2026-04-01T00:06:00.000Z",
        })
      ),
      ...Array.from({ length: 220 }).map((_, idx) =>
        makeLog({
          id: `api-${idx}`,
          tenantId: "tenant-a",
          action: "api.request",
          userId: "actor-burst",
          timestamp: "2026-04-01T00:07:00.000Z",
        })
      ),
      makeLog({
        id: "priv-1",
        tenantId: "tenant-a",
        action: "admin.privilege.grant",
        userId: "actor-admin",
        timestamp: "2026-04-01T00:05:00.000Z",
      }),
    ];

    const baseline = {
      exportThreshold: 50,
      failedThreshold: 8,
      burstThreshold: 200,
    };

    await service.detectForTenant("tenant-a", logs, baseline, windowStart, windowEnd);

    expect(createAlertSpy).toHaveBeenCalledTimes(4);
  });

  it("does not flag non-anomaly fixtures", async () => {
    const service = new SecurityAnomalyService() as any;
    const createAlertSpy = vi.spyOn(service, "createAlert").mockResolvedValue({ id: "alert" });

    const windowStart = new Date("2026-04-01T12:00:00.000Z");
    const windowEnd = new Date("2026-04-01T12:15:00.000Z");
    const logs = [
      ...Array.from({ length: 10 }).map((_, idx) =>
        makeLog({
          id: `export-lite-${idx}`,
          tenantId: "tenant-a",
          action: "project.export.single",
          timestamp: "2026-04-01T12:03:00.000Z",
        })
      ),
      ...Array.from({ length: 3 }).map((_, idx) =>
        makeLog({
          id: `fail-lite-${idx}`,
          tenantId: "tenant-a",
          action: "api.request.failed",
          status: "failed",
          userId: "actor-fail",
          timestamp: "2026-04-01T12:06:00.000Z",
        })
      ),
      ...Array.from({ length: 40 }).map((_, idx) =>
        makeLog({
          id: `api-lite-${idx}`,
          tenantId: "tenant-a",
          action: "api.request",
          userId: "actor-a",
          timestamp: "2026-04-01T12:07:00.000Z",
        })
      ),
    ];

    const baseline = {
      exportThreshold: 50,
      failedThreshold: 8,
      burstThreshold: 200,
    };

    await service.detectForTenant("tenant-a", logs, baseline, windowStart, windowEnd);

    expect(createAlertSpy).not.toHaveBeenCalled();
  });
});
