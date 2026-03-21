/**
 * BaseGraphWriter — unit tests
 *
 * Covers:
 *   - resolveOpportunityId: value_case_id present, fallback to workspace_id, both absent
 *   - safeWrite: returns result on success, swallows errors and returns undefined
 */

import { describe, expect, it, vi } from "vitest";

import { BaseGraphWriter } from "../BaseGraphWriter.js";
import type { ValueGraphService } from "../ValueGraphService.js";
import type { LifecycleContext } from "../../../types/agent.js";

// ---------------------------------------------------------------------------
// Concrete subclass to expose protected methods for testing
// ---------------------------------------------------------------------------

class TestWriter extends BaseGraphWriter {
  public testResolveOpportunityId(ctx: LifecycleContext) {
    return this.resolveOpportunityId(ctx);
  }

  public testNewEntityId() {
    return this.newEntityId();
  }

  public testSafeWrite<T>(
    op: () => Promise<T>,
    ctx: { opportunityId: string; organizationId: string; agentName: string },
  ) {
    return this.safeWrite(op, ctx);
  }
}

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeWriter() {
  const logger = makeLogger();
  const vgs = {} as unknown as ValueGraphService;
  const writer = new TestWriter(vgs, logger as never);
  return { writer, logger };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-001",
    organization_id: "org-001",
    user_id: "user-001",
    lifecycle_stage: "opportunity",
    workspace_data: {},
    user_inputs: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveOpportunityId
// ---------------------------------------------------------------------------

describe("BaseGraphWriter.resolveOpportunityId", () => {
  it("returns value_case_id when present in user_inputs", () => {
    const { writer } = makeWriter();
    const ctx = makeContext({ user_inputs: { value_case_id: "case-abc" } });
    expect(writer.testResolveOpportunityId(ctx)).toBe("case-abc");
  });

  it("falls back to workspace_id when value_case_id is absent", () => {
    const { writer } = makeWriter();
    const ctx = makeContext({ user_inputs: {}, workspace_id: "ws-fallback" });
    expect(writer.testResolveOpportunityId(ctx)).toBe("ws-fallback");
  });

  it("returns undefined when both value_case_id and workspace_id are absent", () => {
    const { writer } = makeWriter();
    const ctx = makeContext({ user_inputs: {}, workspace_id: undefined as never });
    expect(writer.testResolveOpportunityId(ctx)).toBeUndefined();
  });

  it("prefers value_case_id over workspace_id when both are present", () => {
    const { writer } = makeWriter();
    const ctx = makeContext({
      user_inputs: { value_case_id: "case-priority" },
      workspace_id: "ws-secondary",
    });
    expect(writer.testResolveOpportunityId(ctx)).toBe("case-priority");
  });
});

// ---------------------------------------------------------------------------
// newEntityId
// ---------------------------------------------------------------------------

describe("BaseGraphWriter.newEntityId", () => {
  it("returns a valid UUID", () => {
    const { writer } = makeWriter();
    const id = writer.testNewEntityId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("returns a different UUID on each call", () => {
    const { writer } = makeWriter();
    expect(writer.testNewEntityId()).not.toBe(writer.testNewEntityId());
  });
});

// ---------------------------------------------------------------------------
// safeWrite
// ---------------------------------------------------------------------------

describe("BaseGraphWriter.safeWrite", () => {
  const safeCtx = { opportunityId: "opp-1", organizationId: "org-1", agentName: "TestAgent" };

  it("returns the operation result on success", async () => {
    const { writer } = makeWriter();
    const result = await writer.testSafeWrite(() => Promise.resolve("ok"), safeCtx);
    expect(result).toBe("ok");
  });

  it("returns undefined when the operation throws", async () => {
    const { writer } = makeWriter();
    const result = await writer.testSafeWrite(
      () => Promise.reject(new Error("DB down")),
      safeCtx,
    );
    expect(result).toBeUndefined();
  });

  it("logs a warning with context when the operation throws", async () => {
    const { writer, logger } = makeWriter();
    await writer.testSafeWrite(
      () => Promise.reject(new Error("timeout")),
      safeCtx,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "TestAgent: graph write failed",
      expect.objectContaining({
        opportunityId: "opp-1",
        organizationId: "org-1",
        error: "timeout",
      }),
    );
  });

  it("does not propagate the error", async () => {
    const { writer } = makeWriter();
    await expect(
      writer.testSafeWrite(() => Promise.reject(new Error("boom")), safeCtx),
    ).resolves.toBeUndefined();
  });
});
