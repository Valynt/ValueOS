/**
 * ValueIntegrityService — DB-dependent method tests
 *
 * Tests for recomputeScore and checkHardBlocks using a mocked Supabase client.
 * Kept in a separate file so vi.mock hoisting works correctly (the mock must
 * be declared before any module that imports the real Supabase client).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Supabase mock — hoisted before any service import
// ---------------------------------------------------------------------------

const fromMock = vi.fn();

vi.mock("../../../lib/supabase.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/supabase.js")>();
  return {
    assertNotTestEnv: vi.fn(),
    ...actual,
    createRequestSupabaseClient: () => ({ from: fromMock }),
  };
});

// Also mock MessageBus so emitContradictionEvent doesn't throw
vi.mock("../../realtime/MessageBus.js", () => ({
  getMessageBus: () => ({ publishMessage: vi.fn().mockResolvedValue(undefined) }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fluent Supabase query chain that resolves to `result` at the leaf. */
function makeChain(result: unknown): Record<string, unknown> {
  const leaf = () => Promise.resolve(result);
  const chain: Record<string, unknown> = {};
  const proxy: Record<string, unknown> = new Proxy(chain, {
    get(_t, prop: string) {
      if (prop === "then") return undefined; // not a thenable
      if (prop === "single" || prop === "in") return leaf;
      return () => proxy;
    },
  });
  return proxy;
}

// ---------------------------------------------------------------------------
// Import service after mock declarations
// ---------------------------------------------------------------------------

import { ValueIntegrityService } from "../ValueIntegrityService.js";

const CASE_ID = "00000000-0000-0000-0000-000000000001";
const ORG_ID = "00000000-0000-0000-0000-000000000002";
const ACCESS_TOKEN = "test-token";

const NOW = new Date().toISOString();

function makeViolation(severity: "critical" | "warning" | "info", id = "v1") {
  return {
    id,
    severity,
    type: "SCALAR_CONFLICT",
    status: "OPEN",
    description: "test",
    agent_ids: ["AgentA", "AgentB"],
    case_id: CASE_ID,
    organization_id: ORG_ID,
    resolved_by: null,
    resolution_metadata: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

// ---------------------------------------------------------------------------
// recomputeScore
// ---------------------------------------------------------------------------

describe("recomputeScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 1.0 when defense_readiness_score is 1.0 and no violations exist", async () => {
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) {
        // business_cases .select().eq().eq().single()
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { defense_readiness_score: 1.0, integrity_score: null },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (call === 2) {
        // violations .select().eq().eq().in()
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      // .update().eq().eq()
      return {
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    });

    const svc = new ValueIntegrityService();
    const score = await svc.recomputeScore(CASE_ID, ORG_ID, ACCESS_TOKEN);
    expect(score).toBe(1.0);
  });

  it("reduces score by 0.20 per open critical violation", async () => {
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { defense_readiness_score: 1.0, integrity_score: null },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (call === 2) {
        // Two open critical violations → penalty = 2 × 0.20 = 0.40
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () =>
                  Promise.resolve({
                    data: [
                      { severity: "critical", status: "OPEN" },
                      { severity: "critical", status: "OPEN" },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return {
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    });

    const svc = new ValueIntegrityService();
    const score = await svc.recomputeScore(CASE_ID, ORG_ID, ACCESS_TOKEN);
    // integrity_component = 1.0 - 0.40 = 0.60
    // score = 0.5 * 1.0 + 0.5 * 0.60 = 0.80
    expect(score).toBeCloseTo(0.8, 3);
  });

  it("applies transparency penalty for dismissed violations", async () => {
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { defense_readiness_score: 1.0, integrity_score: null },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (call === 2) {
        // One dismissed critical → transparency penalty = 0.05
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () =>
                  Promise.resolve({
                    data: [{ severity: "critical", status: "DISMISSED" }],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return {
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    });

    const svc = new ValueIntegrityService();
    const score = await svc.recomputeScore(CASE_ID, ORG_ID, ACCESS_TOKEN);
    // integrity_component = 1.0 - 0.05 = 0.95
    // score = 0.5 * 1.0 + 0.5 * 0.95 = 0.975
    expect(score).toBeCloseTo(0.975, 3);
  });

  it("clamps score to 0 when penalties exceed 1.0", async () => {
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { defense_readiness_score: 0.0, integrity_score: null },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (call === 2) {
        // 6 critical violations → penalty = 1.20 > 1.0; clamped to 0
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () =>
                  Promise.resolve({
                    data: Array.from({ length: 6 }, () => ({
                      severity: "critical",
                      status: "OPEN",
                    })),
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return {
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    });

    const svc = new ValueIntegrityService();
    const score = await svc.recomputeScore(CASE_ID, ORG_ID, ACCESS_TOKEN);
    expect(score).toBe(0);
  });

  it("applies warning penalty (0.05) correctly", async () => {
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { defense_readiness_score: 1.0, integrity_score: null },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (call === 2) {
        // One open warning → penalty = 0.05
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () =>
                  Promise.resolve({
                    data: [{ severity: "warning", status: "OPEN" }],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return {
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    });

    const svc = new ValueIntegrityService();
    const score = await svc.recomputeScore(CASE_ID, ORG_ID, ACCESS_TOKEN);
    // integrity_component = 1.0 - 0.05 = 0.95
    // score = 0.5 * 1.0 + 0.5 * 0.95 = 0.975
    expect(score).toBeCloseTo(0.975, 3);
  });
});

// ---------------------------------------------------------------------------
// checkHardBlocks
// ---------------------------------------------------------------------------

describe("checkHardBlocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns blocked=false when no open violations exist", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    });

    const svc = new ValueIntegrityService();
    const result = await svc.checkHardBlocks(CASE_ID, ORG_ID, ACCESS_TOKEN);
    expect(result.blocked).toBe(false);
    expect(result.violations).toHaveLength(0);
    expect(result.soft_warnings).toHaveLength(0);
  });

  it("returns blocked=true when open critical violations exist", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                data: [makeViolation("critical", "v1")],
                error: null,
              }),
          }),
        }),
      }),
    });

    const svc = new ValueIntegrityService();
    const result = await svc.checkHardBlocks(CASE_ID, ORG_ID, ACCESS_TOKEN);
    expect(result.blocked).toBe(true);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]!.severity).toBe("critical");
    expect(result.soft_warnings).toHaveLength(0);
  });

  it("returns blocked=false but populates soft_warnings for warning-only violations", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                data: [makeViolation("warning", "v2")],
                error: null,
              }),
          }),
        }),
      }),
    });

    const svc = new ValueIntegrityService();
    const result = await svc.checkHardBlocks(CASE_ID, ORG_ID, ACCESS_TOKEN);
    expect(result.blocked).toBe(false);
    expect(result.violations).toHaveLength(0);
    expect(result.soft_warnings).toHaveLength(1);
    expect(result.soft_warnings[0]!.severity).toBe("warning");
  });

  it("separates critical and warning violations correctly when both are present", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  makeViolation("critical", "v1"),
                  makeViolation("warning", "v2"),
                ],
                error: null,
              }),
          }),
        }),
      }),
    });

    const svc = new ValueIntegrityService();
    const result = await svc.checkHardBlocks(CASE_ID, ORG_ID, ACCESS_TOKEN);
    expect(result.blocked).toBe(true);
    expect(result.violations).toHaveLength(1);
    expect(result.soft_warnings).toHaveLength(1);
  });
});
