import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { AcademyContext } from "../trpc.js";
import { analyticsRouter } from "./analytics.router.js";

const ORGANIZATION_ID = "11111111-1111-1111-1111-111111111111";

function createCallerContext(supabase: AcademyContext["supabase"]) {
  return analyticsRouter.createCaller({
    req: {} as Request,
    res: {} as Response,
    user: {
      id: "user-1",
      organizationId: ORGANIZATION_ID,
    },
    tenantId: ORGANIZATION_ID,
    supabase,
    accessToken: undefined,
  });
}

function createSupabaseDouble(rpcResult: unknown) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: rpcResult,
      error: null,
    }),
    from: vi.fn(),
  } as unknown as NonNullable<AcademyContext["supabase"]>;
}

describe("analyticsRouter SQL aggregates", () => {
  it("delegates quizStats to the quiz RPC, preserves filters, and avoids tenant-wide row selects", async () => {
    const supabase = createSupabaseDouble({
      totalQuizzes: 42,
      passedAttempts: 34,
      averageScore: 87,
      passRate: 81,
      distinctUserCompletionCount: 19,
      completionRate: 63,
      pillarBreakdown: [
        {
          pillarId: 2,
          pillarName: "Discovery",
          attempts: 15,
          averageScore: 89,
          passRate: 80,
        },
      ],
    });

    const caller = createCallerContext(supabase);
    const result = await caller.quizStats({ dateRange: "7d", pillarId: 2 });

    expect(supabase.rpc).toHaveBeenCalledWith("get_academy_quiz_stats", {
      p_organization_id: ORGANIZATION_ID,
      p_since: expect.any(String),
      p_pillar_id: 2,
    });
    expect((supabase as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalQuizzes: 42,
      passedAttempts: 34,
      averageScore: 87,
      passRate: 81,
      distinctUserCompletionCount: 19,
      completionRate: 63,
      pillarBreakdown: [
        {
          pillarId: 2,
          pillarName: "Discovery",
          attempts: 15,
          averageScore: 89,
          passRate: 80,
        },
      ],
    });
  });

  it("passes null quiz filters through to the RPC for full-range aggregates", async () => {
    const supabase = createSupabaseDouble({
      totalQuizzes: 3,
      passedAttempts: 1,
      averageScore: 72,
      passRate: 33,
      distinctUserCompletionCount: 2,
      completionRate: 50,
      pillarBreakdown: [],
    });

    const caller = createCallerContext(supabase);
    await caller.quizStats({ dateRange: "all" });

    expect(supabase.rpc).toHaveBeenCalledWith("get_academy_quiz_stats", {
      p_organization_id: ORGANIZATION_ID,
      p_since: null,
      p_pillar_id: null,
    });
    expect((supabase as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
  });

  it("delegates certificationStats to the certification RPC without fallback table scans", async () => {
    const supabase = createSupabaseDouble({
      totalCertifications: 7,
      tierBreakdown: [
        { tier: "bronze", count: 3 },
        { tier: "silver", count: 2 },
        { tier: "gold", count: 2 },
      ],
    });

    const caller = createCallerContext(supabase);
    const result = await caller.certificationStats({ dateRange: "30d" });

    expect(supabase.rpc).toHaveBeenCalledWith("get_academy_certification_stats", {
      p_organization_id: ORGANIZATION_ID,
      p_since: expect.any(String),
    });
    expect((supabase as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalCertifications: 7,
      tierBreakdown: [
        { tier: "bronze", count: 3 },
        { tier: "silver", count: 2 },
        { tier: "gold", count: 2 },
      ],
    });
  });

  it("delegates simulationStats to the simulation RPC without fallback table scans", async () => {
    const supabase = createSupabaseDouble({
      totalAttempts: 19,
      passedAttempts: 14,
      averageScore: 84,
      passRate: 74,
    });

    const caller = createCallerContext(supabase);
    const result = await caller.simulationStats({ dateRange: "all" });

    expect(supabase.rpc).toHaveBeenCalledWith("get_academy_simulation_stats", {
      p_organization_id: ORGANIZATION_ID,
      p_since: null,
    });
    expect((supabase as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalAttempts: 19,
      passedAttempts: 14,
      averageScore: 84,
      passRate: 74,
    });
  });
});
