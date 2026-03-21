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

function createSupabaseMock(rpcResult: unknown) {
  const rpc = vi.fn().mockResolvedValue({
    data: rpcResult,
    error: null,
  });
  const from = vi.fn(() => {
    throw new Error("Unexpected row scan via .from() in analytics RPC test");
  });

  return {
    rpc,
    from,
  };
}

describe("analyticsRouter SQL aggregates", () => {
  it("delegates quizStats to the quiz RPC, preserves filters, and avoids tenant-wide row scans", async () => {
    const supabase = createSupabaseMock({
      totalQuizzes: 42,
      averageScore: 87,
      passRate: 81,
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

    const caller = createCallerContext(supabase as unknown as NonNullable<AcademyContext["supabase"]>);
    const result = await caller.quizStats({ dateRange: "7d", pillarId: 2 });

    expect(supabase.rpc).toHaveBeenCalledWith("get_academy_quiz_stats", {
      p_organization_id: ORGANIZATION_ID,
      p_since: expect.any(String),
      p_pillar_id: 2,
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalQuizzes: 42,
      averageScore: 87,
      passRate: 81,
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

  it("delegates certificationStats to the certification RPC", async () => {
    const supabase = createSupabaseMock({
      totalCertifications: 7,
      tierBreakdown: [
        { tier: "bronze", count: 3 },
        { tier: "silver", count: 2 },
        { tier: "gold", count: 2 },
      ],
    });

    const caller = createCallerContext(supabase as unknown as NonNullable<AcademyContext["supabase"]>);
    const result = await caller.certificationStats({ dateRange: "30d" });

    expect(supabase.rpc).toHaveBeenCalledWith("get_academy_certification_stats", {
      p_organization_id: ORGANIZATION_ID,
      p_since: expect.any(String),
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalCertifications: 7,
      tierBreakdown: [
        { tier: "bronze", count: 3 },
        { tier: "silver", count: 2 },
        { tier: "gold", count: 2 },
      ],
    });
  });

  it("delegates simulationStats to the simulation RPC", async () => {
    const supabase = createSupabaseMock({
      totalAttempts: 19,
      averageScore: 84,
      passRate: 74,
    });

    const caller = createCallerContext(supabase as unknown as NonNullable<AcademyContext["supabase"]>);
    const result = await caller.simulationStats({ dateRange: "all" });

    expect(supabase.rpc).toHaveBeenCalledWith("get_academy_simulation_stats", {
      p_organization_id: ORGANIZATION_ID,
      p_since: null,
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalAttempts: 19,
      averageScore: 84,
      passRate: 74,
    });
  });
});
