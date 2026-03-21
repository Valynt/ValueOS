/**
 * BaseGraphWriter unit tests
 *
 * Covers the three invariants:
 *   1. getSafeContext — throws LifecycleContextError on missing/invalid UUIDs
 *   2. generateNodeId — always returns a valid UUID v4
 *   3. safeWriteBatch — one failed write does not abort the rest
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/value-graph/ValueGraphService.js", () => ({
  valueGraphService: {
    writeCapability: vi.fn(),
    writeMetric: vi.fn(),
    writeValueDriver: vi.fn(),
    writeEdge: vi.fn(),
  },
  ValueGraphService: class MockValueGraphService {},
}));

import { BaseGraphWriter, LifecycleContextError } from "../BaseGraphWriter.js";
import type { LifecycleContext } from "../../../types/agent.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_ORG_ID = "660e8400-e29b-41d4-a716-446655440001";
const VALID_OPP_ID = "770e8400-e29b-41d4-a716-446655440002";

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-1",
    organization_id: VALID_ORG_ID,
    user_id: "user-1",
    lifecycle_stage: "drafting",
    workspace_data: {},
    user_inputs: { opportunity_id: VALID_OPP_ID },
    ...overrides,
  } as LifecycleContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BaseGraphWriter", () => {
  let writer: BaseGraphWriter;

  beforeEach(() => {
    writer = new BaseGraphWriter();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Invariant 1 — getSafeContext
  // -------------------------------------------------------------------------

  describe("getSafeContext", () => {
    it("returns opportunityId and organizationId when both are valid UUIDs", () => {
      const ctx = makeContext();
      const result = writer.getSafeContext(ctx);
      expect(result.opportunityId).toBe(VALID_OPP_ID);
      expect(result.organizationId).toBe(VALID_ORG_ID);
    });

    it("reads opportunity_id from context.metadata when user_inputs is absent", () => {
      const ctx = makeContext({
        user_inputs: {},
        metadata: { opportunity_id: VALID_OPP_ID },
      });
      const result = writer.getSafeContext(ctx);
      expect(result.opportunityId).toBe(VALID_OPP_ID);
    });

    it("throws LifecycleContextError when opportunity_id is missing", () => {
      const ctx = makeContext({ user_inputs: {} });
      expect(() => writer.getSafeContext(ctx)).toThrow(LifecycleContextError);
      expect(() => writer.getSafeContext(ctx)).toThrow(/opportunity_id/);
    });

    it("throws LifecycleContextError when opportunity_id is not a UUID", () => {
      const ctx = makeContext({ user_inputs: { opportunity_id: "cost_reduction-Optimization" } });
      expect(() => writer.getSafeContext(ctx)).toThrow(LifecycleContextError);
      expect(() => writer.getSafeContext(ctx)).toThrow(/not a valid UUID/);
    });

    it("throws LifecycleContextError when organization_id is missing", () => {
      const ctx = makeContext({ organization_id: "" });
      expect(() => writer.getSafeContext(ctx)).toThrow(LifecycleContextError);
      expect(() => writer.getSafeContext(ctx)).toThrow(/organization_id/);
    });

    it("throws LifecycleContextError when organization_id is not a UUID", () => {
      const ctx = makeContext({ organization_id: "not-a-uuid" });
      expect(() => writer.getSafeContext(ctx)).toThrow(LifecycleContextError);
    });

    it("does not fall back to workspace_id when opportunity_id is absent", () => {
      const ctx = makeContext({ user_inputs: { workspace_id: VALID_UUID } });
      expect(() => writer.getSafeContext(ctx)).toThrow(LifecycleContextError);
    });
  });

  // -------------------------------------------------------------------------
  // Invariant 2 — generateNodeId
  // -------------------------------------------------------------------------

  describe("generateNodeId", () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    it("returns the input unchanged when it is already a valid UUID v4", () => {
      expect(writer.generateNodeId(VALID_UUID)).toBe(VALID_UUID);
    });

    it("generates a fresh UUID when no input is provided", () => {
      const id = writer.generateNodeId();
      expect(id).toMatch(UUID_RE);
    });

    it("generates a fresh UUID when input is a non-UUID string", () => {
      const id = writer.generateNodeId("cost_reduction-Optimization");
      expect(id).toMatch(UUID_RE);
    });

    it("generates a fresh UUID when input is an empty string", () => {
      const id = writer.generateNodeId("");
      expect(id).toMatch(UUID_RE);
    });

    it("never returns a non-UUID string", () => {
      const inputs = [undefined, "", "plain-string", "123", "abc-def"];
      for (const input of inputs) {
        expect(writer.generateNodeId(input)).toMatch(UUID_RE);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Invariant 3 — safeWriteBatch
  // -------------------------------------------------------------------------

  describe("safeWriteBatch", () => {
    it("returns succeeded=N when all writes succeed", async () => {
      const writes = [
        vi.fn().mockResolvedValue("ok-1"),
        vi.fn().mockResolvedValue("ok-2"),
        vi.fn().mockResolvedValue("ok-3"),
      ];
      const result = await writer.safeWriteBatch(writes);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("commits remaining writes when one fails", async () => {
      const writes = [
        vi.fn().mockResolvedValue("ok-1"),
        vi.fn().mockRejectedValue(new Error("DB constraint violation")),
        vi.fn().mockResolvedValue("ok-3"),
      ];
      const result = await writer.safeWriteBatch(writes);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors[0].message).toBe("DB constraint violation");
      // All three thunks were still called
      expect(writes[0]).toHaveBeenCalled();
      expect(writes[1]).toHaveBeenCalled();
      expect(writes[2]).toHaveBeenCalled();
    });

    it("returns succeeded=0 when all writes fail", async () => {
      const writes = [
        vi.fn().mockRejectedValue(new Error("fail-1")),
        vi.fn().mockRejectedValue(new Error("fail-2")),
      ];
      const result = await writer.safeWriteBatch(writes);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    it("wraps non-Error rejections in an Error", async () => {
      const writes = [vi.fn().mockRejectedValue("string rejection")];
      const result = await writer.safeWriteBatch(writes);
      expect(result.errors[0]).toBeInstanceOf(Error);
      expect(result.errors[0].message).toBe("string rejection");
    });

    it("returns succeeded=0 and no errors for an empty batch", async () => {
      const result = await writer.safeWriteBatch([]);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Convenience write methods — delegate to ValueGraphService with context
  // -------------------------------------------------------------------------

  describe("writeCapability", () => {
    it("injects opportunity_id and organization_id from context", async () => {
      const { valueGraphService } = await import(
        "../../../services/value-graph/ValueGraphService.js"
      );
      const mockWrite = vi.mocked(valueGraphService.writeCapability);
      mockWrite.mockResolvedValue({ id: VALID_UUID } as never);

      const ctx = makeContext();
      await writer.writeCapability(ctx, {
        name: "Automated reconciliation",
        description: "Eliminates manual matching",
        category: "automation",
      });

      expect(mockWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunity_id: VALID_OPP_ID,
          organization_id: VALID_ORG_ID,
          name: "Automated reconciliation",
        }),
      );
    });

    it("throws LifecycleContextError when context is invalid", async () => {
      const ctx = makeContext({ user_inputs: {} });
      await expect(
        writer.writeCapability(ctx, {
          name: "test",
          description: "test",
          category: "automation",
        }),
      ).rejects.toThrow(LifecycleContextError);
    });
  });
});
