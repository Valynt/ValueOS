import { beforeEach, describe, expect, it, vi } from "vitest";

const { agentCacheGetMock, agentCacheSetMock, agentCacheConfigs } = vi.hoisted(() => ({
  agentCacheGetMock: vi.fn().mockResolvedValue(null),
  agentCacheSetMock: vi.fn().mockResolvedValue(undefined),
  agentCacheConfigs: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../cache/AgentCache.js", () => ({
  AgentCache: class MockAgentCache {
    constructor(config?: Record<string, unknown>) {
      if (config) {
        agentCacheConfigs.push(config);
      }
    }
    get = agentCacheGetMock;
    set = agentCacheSetMock;
    shutdown = vi.fn();
  },
}));

vi.mock("../../CircuitBreaker", () => ({
  CircuitBreakerManager: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation((_key, fn) => fn()),
    getState: vi.fn().mockReturnValue({ state: "closed" }),
    reset: vi.fn(),
    exportState: vi.fn().mockReturnValue({}),
  })),
}));

vi.mock("../../AgentRegistry", () => ({
  AgentRegistry: vi.fn().mockImplementation(() => ({
    registerAgent: vi.fn(),
    getAgent: vi.fn().mockReturnValue(null),
  })),
}));

vi.mock("../AgentAuditLogger.js", () => ({
  getAuditLogger: vi.fn().mockReturnValue(null),
  logAgentResponse: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../ReadThroughCacheService.js", () => ({
  ReadThroughCacheService: {
    getOrLoad: vi.fn(async (_config: unknown, loader: () => Promise<unknown>) => loader()),
  },
}));

import { UnifiedAgentAPI } from "../UnifiedAgentAPI";

vi.mock("../../../lib/supabase.js");

describe("UnifiedAgentAPI distributed idempotency cache", () => {
  beforeEach(() => {
    agentCacheGetMock.mockReset();
    agentCacheSetMock.mockReset();
    agentCacheGetMock.mockResolvedValue(null);
    agentCacheSetMock.mockResolvedValue(undefined);
    agentCacheConfigs.length = 0;
  });

  it("stores idempotency responses with tenant-scoped keys and TTL", async () => {
    const api = new UnifiedAgentAPI();

    await (api as unknown as {
      storeIdempotencyResponse: (
        tenantId: string,
        key: string,
        response: { success: boolean }
      ) => Promise<void>;
    }).storeIdempotencyResponse("tenant-42", "idem-1", { success: true });

    expect(agentCacheSetMock).toHaveBeenCalledWith(
      "tenant-42:idem-1",
      { success: true },
      {
        ttl: 300,
        metadata: { tenantId: "tenant-42" },
      }
    );
  });

  it("reads idempotency responses with the same tenant-scoped key", async () => {
    agentCacheGetMock.mockResolvedValueOnce({ success: true });
    const api = new UnifiedAgentAPI();

    const result = await (api as unknown as {
      checkIdempotency: (
        tenantId: string,
        key: string
      ) => Promise<{ success: boolean } | null>;
    }).checkIdempotency("tenant-42", "idem-1");

    expect(agentCacheGetMock).toHaveBeenCalledWith("tenant-42:idem-1");
    expect(result).toEqual({ success: true });
  });

  it("disables process-local near-cache for idempotency responses", () => {
    new UnifiedAgentAPI();

    expect(agentCacheConfigs[0]).toMatchObject({
      namespace: "unified-agent-idempotency",
      nearCacheEnabled: false,
    });
  });
});
