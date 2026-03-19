import type { Request, Response } from "express";

import { describe, expect, it, vi } from "vitest";

import type { AcademyContext } from "../trpc.js";
import { analyticsRouter } from "./analytics.router.js";

const ORGANIZATION_ID = "11111111-1111-1111-1111-111111111111";

function createCallerContext(rpcImpl: AcademyContext["supabase"]) {
  return analyticsRouter.createCaller({
    req: {} as Request,
    res: {} as Response,
    user: {
      id: "user-1",
      organizationId: ORGANIZATION_ID,
    },
    tenantId: ORGANIZATION_ID,
    supabase: rpcImpl,
    accessToken: undefined,
  });
}

describe("analyticsRouter SQL aggregates", () => {
  it("delegates quizStats to the quiz RPC and preserves the response contract", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
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
      },
      error: null,
    });

    const caller = createCallerContext({ rpc } as unknown as NonNullable<AcademyContext["supabase"]>);
    const result = await caller.quizStats({ dateRange: "7d", pillarId: 2 });

    expect(rpc).toHaveBeenCalledWith("get_academy_quiz_stats", {
      p_organization_id: ORGANIZATION_ID,
      p_since: expect.any(String),
      p_pillar_id: 2,
    });
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
    const rpc = vi.fn().mockResolvedValue({
      data: {
        totalCertifications: 7,
        tierBreakdown: [
          { tier: "bronze", count: 3 },
          { tier: "silver", count: 2 },
          { tier: "gold", count: 2 },
        ],
      },
      error: null,
    });

    const caller = createCallerContext({ rpc } as unknown as NonNullable<AcademyContext["supabase"]>);
    const result = await caller.certificationStats({ dateRange: "30d" });

    expect(rpc).toHaveBeenCalledWith("get_academy_certification_stats", {
      p_organization_id: ORGANIZATION_ID,
      p_since: expect.any(String),
    });
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
    const rpc = vi.fn().mockResolvedValue({
      data: {
        totalAttempts: 19,
        averageScore: 84,
        passRate: 74,
      },
      error: null,
    });

    const caller = createCallerContext({ rpc } as unknown as NonNullable<AcademyContext["supabase"]>);
    const result = await caller.simulationStats({ dateRange: "all" });

    expect(rpc).toHaveBeenCalledWith("get_academy_simulation_stats", {
      p_organization_id: ORGANIZATION_ID,
      p_since: null,
    });
    expect(result).toEqual({
      totalAttempts: 19,
      averageScore: 84,
      passRate: 74,
    });
  });
});
