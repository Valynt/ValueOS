import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Redis — getRedisClient is async and returns a client or null
const store: Record<string, string> = {};
const redisMock = {
  get: vi.fn(async (key: string) => store[key] ?? null),
  set: vi.fn(async (key: string, val: string) => {
    store[key] = val;
  }),
  del: vi.fn(async (key: string) => {
    delete store[key];
    return 1;
  }),
};
vi.mock("../../lib/redis.js", () => ({
  getRedisClient: vi.fn(async () => redisMock),
}));

// Mock AgentPolicyService
vi.mock("../policy/AgentPolicyService.js", () => ({
  getAgentPolicyService: () => ({
    getPolicy: (name: string) => ({ version: `v1-${name}` }),
  }),
}));

import { AgentKillSwitchService } from "./AgentKillSwitchService.js";

describe("AgentKillSwitchService", () => {
  let svc: AgentKillSwitchService;

  beforeEach(() => {
    svc = new AgentKillSwitchService();
    Object.keys(store).forEach((k) => delete store[k]);
    vi.clearAllMocks();
    // Re-attach mock after clearAllMocks
    redisMock.get.mockImplementation(async (key: string) => store[key] ?? null);
    redisMock.set.mockImplementation(async (key: string, val: string) => {
      store[key] = val;
    });
    redisMock.del.mockImplementation(async (key: string) => {
      delete store[key];
      return 1;
    });
  });

  it("isKilled returns false when key absent", async () => {
    expect(await svc.isKilled("opportunity-agent")).toBe(false);
  });

  it("setKilled(true) sets key to '1'", async () => {
    await svc.setKilled("opportunity-agent", true);
    expect(store["agent_kill_switch:opportunity-agent"]).toBe("1");
  });

  it("isKilled returns true after setKilled(true)", async () => {
    await svc.setKilled("opportunity-agent", true);
    expect(await svc.isKilled("opportunity-agent")).toBe(true);
  });

  it("setKilled(false) removes key", async () => {
    await svc.setKilled("opportunity-agent", true);
    await svc.setKilled("opportunity-agent", false);
    expect(store["agent_kill_switch:opportunity-agent"]).toBeUndefined();
    expect(await svc.isKilled("opportunity-agent")).toBe(false);
  });

  it("listAll returns status for all 8 known agents", async () => {
    await svc.setKilled("target-agent", true);
    const list = await svc.listAll();
    expect(list).toHaveLength(8);
    const target = list.find((a) => a.name === "target-agent");
    expect(target?.killed).toBe(true);
    const opp = list.find((a) => a.name === "opportunity-agent");
    expect(opp?.killed).toBe(false);
  });

  it("isKilled fails open when Redis throws", async () => {
    const { getRedisClient } = await import("../../lib/redis.js");
    vi.mocked(getRedisClient).mockRejectedValueOnce(new Error("Redis down"));
    expect(await svc.isKilled("opportunity-agent")).toBe(false);
  });

  it("setKilled throws when Redis is null", async () => {
    const { getRedisClient } = await import("../../lib/redis.js");
    vi.mocked(getRedisClient).mockResolvedValueOnce(null);
    await expect(svc.setKilled("opportunity-agent", true)).rejects.toThrow(
      "Redis unavailable",
    );
  });
});
