import { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { DiffExplainabilityService } from "../DiffExplainabilityService.js";

const makeInsertChain = (row: Record<string, unknown>) => ({
  insert: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: row, error: null }),
    }),
  }),
});

describe("DiffExplainabilityService", () => {
  it("computes run and decision-path diffs and persists snapshot", async () => {
    const persistedRow = {
      id: "3ad3e4e0-2267-49a5-93e9-1df97f1a5f0f",
      stable_id: "dxs_20260405_abcd1234efgh",
      organization_id: "902edff6-d3f0-4082-89ea-d759eba64712",
      case_id: "30f3dc7d-a4eb-4559-b43e-ee76174f7a9e",
      run_a_id: "run-a",
      run_b_id: "run-b",
      human_decision_path_id: "human-path-1",
      agent_decision_path_id: "agent-path-1",
      created_by_user_id: "ad3f4402-fd84-41af-a227-95f328a6ff10",
      created_at: new Date().toISOString(),
      diff_payload: {
        schema_version: 1,
        compared: {
          run_a_id: "run-a",
          run_b_id: "run-b",
          human_decision_path_id: "human-path-1",
          agent_decision_path_id: "agent-path-1",
        },
        generated_at: new Date().toISOString(),
        diffs: [
          {
            id: "b9493921-4632-4710-9556-6940206bcd18",
            change_type: "added",
            entity_type: "evidence_link",
            entity_key: "ev-2",
            what_changed: "Added evidence_link \"ev-2\".",
            why_changed: "evidence",
            confidence_impact: { delta: 0.06, direction: "increased", rationale: "reason=evidence" },
            expected_business_impact: { direction: "positive", magnitude: "medium", rationale: "impact" },
            semantic_similarity: 0,
            structural_change_score: 1,
            source: { comparison_axis: "run_output" },
            metadata: {},
          },
        ],
        aggregates: {
          total_items: 1,
          semantic_change_mean: 0,
          structural_change_mean: 1,
          confidence_delta_net: 0.06,
        },
      },
      narrative_summary: {
        executive_summary: "summary",
        auditor_summary: "summary",
        top_changes: ["change"],
        counts_by_entity: { evidence_link: 1 },
        counts_by_reason: { evidence: 1 },
      },
      references_json: [{ type: "handoff_card", id: "handoff-42" }],
    };

    const tableChain = makeInsertChain(persistedRow);
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        expect(table).toBe("diff_explainability_snapshots");
        return tableChain;
      }),
    } as unknown as SupabaseClient;

    const service = new DiffExplainabilityService(supabase);

    const snapshot = await service.createSnapshot({
      organizationId: "902edff6-d3f0-4082-89ea-d759eba64712",
      caseId: "30f3dc7d-a4eb-4559-b43e-ee76174f7a9e",
      runA: {
        id: "run-a",
        output: {
          claims: [{ id: "claim-1", statement: "Uplift 5%" }],
          evidence_links: [{ id: "ev-1", source: "Gartner" }],
          approvals: [{ id: "ap-1", owner: "CFO" }],
          outcomes: [{ id: "out-1", metric: "ARR", value: 300000 }],
        },
      },
      runB: {
        id: "run-b",
        output: {
          claims: [{ id: "claim-1", statement: "Uplift 7%" }],
          evidence_links: [{ id: "ev-1", source: "Gartner" }, { id: "ev-2", source: "Forrester" }],
          approvals: [{ id: "ap-1", owner: "VP Finance" }],
          outcomes: [{ id: "out-1", metric: "ARR", value: 340000 }],
        },
      },
      humanDecisionPath: {
        id: "human-path-1",
        payload: {
          policy_checks: [{ id: "pc-1", policy: "RiskGate", status: "pass" }],
          approvals: [{ id: "ap-1", owner: "CFO" }],
        },
      },
      agentDecisionPath: {
        id: "agent-path-1",
        payload: {
          policy_checks: [{ id: "pc-1", policy: "RiskGate", status: "fail" }],
          approvals: [{ id: "ap-1", owner: "Controller" }],
        },
      },
      references: [{ type: "handoff_card", id: "handoff-42" }],
      createdByUserId: "ad3f4402-fd84-41af-a227-95f328a6ff10",
    });

    expect(snapshot.id).toBe(persistedRow.id);
    expect(snapshot.stable_id).toBe(persistedRow.stable_id);
    expect(snapshot.references).toEqual([{ type: "handoff_card", id: "handoff-42" }]);

    expect(supabase.from).toHaveBeenCalledWith("diff_explainability_snapshots");
    expect(tableChain.insert).toHaveBeenCalledTimes(1);

    const insertPayload = tableChain.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertPayload.organization_id).toBe("902edff6-d3f0-4082-89ea-d759eba64712");
    expect((insertPayload.diff_payload as { diffs: unknown[] }).diffs.length).toBeGreaterThan(0);
  });

  it("loads snapshots by stable id with tenant filter", async () => {
    const row = {
      id: "2111d347-369d-474c-b573-44cb9b6c8f5f",
      stable_id: "dxs_20260405_123456abcdef",
      organization_id: "f9f76855-a51f-4f7e-8ce3-36a14e8f53cf",
      case_id: null,
      run_a_id: "run-a",
      run_b_id: "run-b",
      human_decision_path_id: "human",
      agent_decision_path_id: "agent",
      created_by_user_id: null,
      created_at: new Date().toISOString(),
      diff_payload: {
        schema_version: 1,
        compared: {
          run_a_id: "run-a",
          run_b_id: "run-b",
          human_decision_path_id: "human",
          agent_decision_path_id: "agent",
        },
        generated_at: new Date().toISOString(),
        diffs: [],
        aggregates: {
          total_items: 0,
          semantic_change_mean: 1,
          structural_change_mean: 0,
          confidence_delta_net: 0,
        },
      },
      narrative_summary: {
        executive_summary: "none",
        auditor_summary: "none",
        top_changes: [],
        counts_by_entity: {},
        counts_by_reason: {},
      },
      references_json: [{ type: "approval_inbox_record", id: "approval-99" }],
    };

    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const eqStable = vi.fn().mockReturnValue({ maybeSingle });
    const eqOrg = vi.fn().mockReturnValue({ eq: eqStable });
    const supabase = {
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: eqOrg }) }),
    } as unknown as SupabaseClient;

    const service = new DiffExplainabilityService(supabase);
    const snapshot = await service.getSnapshotByStableId(
      "f9f76855-a51f-4f7e-8ce3-36a14e8f53cf",
      "dxs_20260405_123456abcdef"
    );

    expect(snapshot?.references[0]).toEqual({ type: "approval_inbox_record", id: "approval-99" });
    expect(eqOrg).toHaveBeenCalledWith("organization_id", "f9f76855-a51f-4f7e-8ce3-36a14e8f53cf");
    expect(eqStable).toHaveBeenCalledWith("stable_id", "dxs_20260405_123456abcdef");
  });
});
