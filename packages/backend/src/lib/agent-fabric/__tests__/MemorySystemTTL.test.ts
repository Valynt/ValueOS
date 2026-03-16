import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemorySystem } from "../MemorySystem.js";
import type { MemorySystemConfig } from "../MemorySystem.js";

const ORG_ID = "org-ttl-test";
const AGENT_ID = "TestAgent";

function makeConfig(ttl_seconds: number): MemorySystemConfig {
  return {
    max_memories: 100,
    ttl_seconds,
    enable_persistence: false,
  };
}

describe("MemorySystem TTL enforcement on reads", () => {
  let system: MemorySystem;

  beforeEach(() => {
    system = new MemorySystem(makeConfig(60)); // 60s TTL
  });

  it("returns a fresh entry within TTL", async () => {
    await system.store({
      agent_id: AGENT_ID,
      organization_id: ORG_ID,
      workspace_id: "ws-1",
      content: "fresh memory",
      memory_type: "episodic",
      importance: 0.8,
    });

    const results = await system.retrieve({
      agent_id: AGENT_ID,
      organization_id: ORG_ID,
    });

    expect(results.length).toBe(1);
    expect(results[0].content).toBe("fresh memory");
  });

  it("does not return an expired entry on read", async () => {
    // Store with a 1-second TTL system
    const shortTtlSystem = new MemorySystem(makeConfig(1));

    await shortTtlSystem.store({
      agent_id: AGENT_ID,
      organization_id: ORG_ID,
      workspace_id: "ws-2",
      content: "soon-to-expire memory",
      memory_type: "episodic",
      importance: 0.8,
    });

    // Advance time past TTL by mocking Date.now
    const realNow = Date.now;
    vi.spyOn(Date, "now").mockReturnValue(realNow() + 2000); // +2s

    const results = await shortTtlSystem.retrieve({
      agent_id: AGENT_ID,
      organization_id: ORG_ID,
    });

    vi.spyOn(Date, "now").mockRestore();

    expect(results.length).toBe(0);
  });

  it("evicts expired entry from cache on read (not just skips)", async () => {
    const shortTtlSystem = new MemorySystem(makeConfig(1));

    await shortTtlSystem.store({
      agent_id: AGENT_ID,
      organization_id: ORG_ID,
      workspace_id: "ws-3",
      content: "evictable memory",
      memory_type: "episodic",
      importance: 0.8,
    });

    const realNow = Date.now;
    vi.spyOn(Date, "now").mockReturnValue(realNow() + 2000);

    // First read — should evict
    await shortTtlSystem.retrieve({ agent_id: AGENT_ID, organization_id: ORG_ID });

    vi.spyOn(Date, "now").mockRestore();

    // Second read without time mock — entry should be gone from cache
    const results = await shortTtlSystem.retrieve({ agent_id: AGENT_ID, organization_id: ORG_ID });
    expect(results.length).toBe(0);
  });
});

describe("MemorySystem cross-workspace gate", () => {
  it("throws when allow_cross_workspace is true without cross_workspace_reason", async () => {
    const system = new MemorySystem(makeConfig(3600));

    await expect(
      system.retrieve({
        agent_id: AGENT_ID,
        organization_id: ORG_ID,
        allow_cross_workspace: true,
        // cross_workspace_reason intentionally omitted
      })
    ).rejects.toThrow("cross_workspace_reason is required");
  });

  it("proceeds when allow_cross_workspace is true with a reason", async () => {
    const system = new MemorySystem(makeConfig(3600));

    // Should not throw — returns empty since no memories stored
    const results = await system.retrieve({
      agent_id: AGENT_ID,
      organization_id: ORG_ID,
      allow_cross_workspace: true,
      cross_workspace_reason: "compliance audit",
    });

    expect(Array.isArray(results)).toBe(true);
  });
});
