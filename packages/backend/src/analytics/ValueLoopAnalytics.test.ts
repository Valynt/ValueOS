/**
 * ValueLoopAnalytics — unit tests
 *
 * Verifies that recommendation acceptance events are correctly recorded
 * and that getInsights aggregates them into acceptance rates.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Supabase before importing the module under test
const insertMock = vi.fn().mockResolvedValue({ error: null });
const selectMock = vi.fn();

vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn() })) },
  createServerSupabaseClient: () => ({
    from: (_table: string) => ({
      insert: insertMock,
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          gte: (_col2: string, _val2: string) => ({
            order: (_col3: string, _opts: unknown) => selectMock(),
          }),
        }),
      }),
    }),
  }),
}));

import { ValueLoopAnalytics } from "./ValueLoopAnalytics.js";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const SESSION_ID = "session-abc";
const ACTOR_ID = "00000000-0000-0000-0000-000000000002";
const HYPOTHESIS_ID = "00000000-0000-0000-0000-000000000003";

describe("ValueLoopAnalytics.record", () => {
  beforeEach(() => {
    insertMock.mockClear();
  });

  it("inserts a recommendation_accepted event with correct fields", async () => {
    await ValueLoopAnalytics.recordRecommendation({
      organizationId: ORG_ID,
      sessionId: SESSION_ID,
      accepted: true,
      agentName: "OpportunityAgent",
      hypothesisId: HYPOTHESIS_ID,
      confidence: 0.82,
      actorId: ACTOR_ID,
    });

    expect(insertMock).toHaveBeenCalledOnce();
    const inserted = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.organization_id).toBe(ORG_ID);
    expect(inserted.event_type).toBe("recommendation_accepted");
    expect(inserted.object_type).toBe("hypothesis");
    expect(inserted.object_id).toBe(HYPOTHESIS_ID);
    expect((inserted.payload as Record<string, unknown>).agentName).toBe("OpportunityAgent");
  });

  it("inserts a recommendation_dismissed event when accepted=false", async () => {
    await ValueLoopAnalytics.recordRecommendation({
      organizationId: ORG_ID,
      sessionId: SESSION_ID,
      accepted: false,
      agentName: "TargetAgent",
    });

    const inserted = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.event_type).toBe("recommendation_dismissed");
  });

  it("inserts an assumption_corrected event", async () => {
    await ValueLoopAnalytics.recordAssumptionCorrection({
      organizationId: ORG_ID,
      sessionId: SESSION_ID,
      assumptionId: HYPOTHESIS_ID,
      previousValue: 100_000,
      correctedValue: 120_000,
      actorId: ACTOR_ID,
    });

    const inserted = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.event_type).toBe("assumption_corrected");
    expect((inserted.payload as Record<string, unknown>).correctedValue).toBe(120_000);
  });

  it("silently drops events with invalid organizationId", async () => {
    await ValueLoopAnalytics.record({
      organizationId: "not-a-uuid",
      sessionId: SESSION_ID,
      eventType: "recommendation_accepted",
      payload: {},
    });

    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("ValueLoopAnalytics.getInsights", () => {
  it("computes acceptance rate from raw events", async () => {
    selectMock.mockResolvedValue({
      data: [
        { event_type: "recommendation_accepted", object_type: "hypothesis", object_id: null, payload: { agentName: "OpportunityAgent" }, created_at: new Date().toISOString() },
        { event_type: "recommendation_accepted", object_type: "hypothesis", object_id: null, payload: { agentName: "OpportunityAgent" }, created_at: new Date().toISOString() },
        { event_type: "recommendation_dismissed", object_type: "hypothesis", object_id: null, payload: { agentName: "OpportunityAgent" }, created_at: new Date().toISOString() },
      ],
      error: null,
    });

    const insights = await ValueLoopAnalytics.getInsights(ORG_ID, 30);

    expect(insights.organizationId).toBe(ORG_ID);
    expect(insights.recommendationAcceptance).toHaveLength(1);
    const rec = insights.recommendationAcceptance[0];
    expect(rec.agentName).toBe("OpportunityAgent");
    expect(rec.accepted).toBe(2);
    expect(rec.dismissed).toBe(1);
    expect(rec.acceptanceRate).toBeCloseTo(2 / 3);
  });

  it("returns empty arrays when no events exist", async () => {
    selectMock.mockResolvedValue({ data: [], error: null });

    const insights = await ValueLoopAnalytics.getInsights(ORG_ID, 30);
    expect(insights.recommendationAcceptance).toHaveLength(0);
    expect(insights.assumptionCorrections).toHaveLength(0);
    expect(insights.evidencePersuasiveness).toHaveLength(0);
  });
});
