import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOrLoadMock, invalidateEndpointMock } = vi.hoisted(() => ({
  getOrLoadMock: vi.fn(),
  invalidateEndpointMock: vi.fn(),
}));

vi.mock("../../cache/ReadThroughCacheService.js", () => ({
  ReadThroughCacheService: {
    getOrLoad: getOrLoadMock,
    invalidateEndpoint: invalidateEndpointMock,
    clearNearCacheForTesting: vi.fn(),
  },
}));

import { ValueFabricService } from "../ValueFabricService";

describe("ValueFabricService distributed cache configuration", () => {
  const organizationId = "tenant-123";

  beforeEach(() => {
    getOrLoadMock.mockReset();
    invalidateEndpointMock.mockReset();
  });

  it("routes capability list reads through tenant-scoped Redis caching with a short near-cache", async () => {
    getOrLoadMock.mockImplementation(async (_config, loader) => loader());
    const selectMock = vi.fn().mockReturnThis();
    const service = new ValueFabricService({
      from: vi.fn().mockReturnValue({
        select: selectMock,
        eq: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as never);

    await service.getCapabilities(organizationId, { category: "ai", page: 2, pageSize: 25 });

    expect(selectMock).toHaveBeenCalledWith(
      "id, name, description, tags, category, is_active, created_at, updated_at"
    );

    expect(getOrLoadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "value-fabric/capabilities",
        namespace: "value-fabric-capabilities",
        tenantId: organizationId,
        scope: "list",
        tier: "warm",
        nearCache: {
          enabled: true,
          ttlSeconds: 15,
          maxEntries: 64,
        },
      }),
      expect.any(Function)
    );
  });

  it("routes use-case composition reads through tenant-scoped Redis caching", async () => {
    getOrLoadMock.mockImplementation(async (_config, loader) => loader());
    const service = new ValueFabricService({
      from: vi.fn((table: string) => {
        if (table === "use_cases") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: "uc-1", is_template: false }, error: null }),
          };
        }

        if (table === "use_case_capabilities") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [{ capability_id: "cap-1" }], error: null }),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [{ id: "cap-1" }], error: null }),
        };
      }),
    } as never);

    await service.getUseCaseWithCapabilities(organizationId, "uc-1");

    expect(getOrLoadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "value-fabric/use-cases",
        namespace: "value-fabric-use-cases",
        tenantId: organizationId,
        scope: "with-capabilities",
        tier: "warm",
      }),
      expect.any(Function)
    );
  });

  it("invalidates shared capability and dependent use-case caches after capability writes", async () => {
    const update = {
      organization_id: organizationId,
      id: "cap-1",
      name: "Capability 1",
    };
    const service = new ValueFabricService({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: update, error: null }),
      }),
    } as never);

    await service.updateCapability(organizationId, "cap-1", { name: "Capability 1" });

    expect(invalidateEndpointMock).toHaveBeenNthCalledWith(
      1,
      organizationId,
      "value-fabric/capabilities"
    );
    expect(invalidateEndpointMock).toHaveBeenNthCalledWith(
      2,
      organizationId,
      "value-fabric/use-cases"
    );
  });
});
