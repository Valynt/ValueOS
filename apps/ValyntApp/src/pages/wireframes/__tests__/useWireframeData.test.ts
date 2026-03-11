/**
 * useWireframeData — unit tests for mapping functions and hooks.
 *
 * Tests cover:
 *   - formatValue edge cases (undefined, sub-1K, K, M)
 *   - phaseToType / phaseToColumn / phaseToStage via hook output
 *   - useCommandCenterItems mapping
 *   - useMaturityCards grouping and column assignment
 *   - useRealizationKpis filtering and mapping
 *   - useExpansionOpportunities filtering
 *   - useCases error propagation
 */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { createElement } from "react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: { get: mocks.get },
}));

vi.mock("@/components/wireframes/WireframeAuthContext", () => ({
  useWireframeAuth: () => ({ accessToken: "tok-test" }),
}));

import {
  useCommandCenterItems,
  useMaturityCards,
  useRealizationKpis,
  useExpansionOpportunities,
} from "../useWireframeData";
import type { WireframeCase } from "../useWireframeData";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: ReactNode }) {
  return createElement("div", null, children);
}

function makeCase(overrides: Partial<WireframeCase> = {}): WireframeCase {
  return {
    id: "case-1",
    name: "Test Case",
    companyName: "Acme Corp",
    status: "active",
    phase: "discovery",
    totalValue: 500_000,
    updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), // 2 days ago
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function resolveWith(cases: WireframeCase[]) {
  mocks.get.mockResolvedValue({ success: true, data: { data: cases } });
}

function rejectWith(message: string) {
  mocks.get.mockRejectedValue(new Error(message));
}

// ---------------------------------------------------------------------------
// useCommandCenterItems
// ---------------------------------------------------------------------------

describe("useCommandCenterItems", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps discovery/active case to expansion-signal with medium priority", async () => {
    resolveWith([makeCase({ phase: "discovery", status: "active" })]);
    const { result } = renderHook(() => useCommandCenterItems(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const item = result.current.data[0];
    expect(item.type).toBe("expansion-signal");
    expect(item.priority).toBe("medium");
  });

  it("maps review phase to approval-pending with high priority", async () => {
    resolveWith([makeCase({ phase: "review", status: "active" })]);
    const { result } = renderHook(() => useCommandCenterItems(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const item = result.current.data[0];
    expect(item.type).toBe("approval-pending");
    expect(item.priority).toBe("high");
  });

  it("maps committed status to realization-drift with high priority", async () => {
    resolveWith([makeCase({ phase: "finalize", status: "committed" })]);
    const { result } = renderHook(() => useCommandCenterItems(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const item = result.current.data[0];
    expect(item.type).toBe("realization-drift");
    expect(item.priority).toBe("high");
  });

  it("maps modeling phase to model-ready", async () => {
    resolveWith([makeCase({ phase: "modeling", status: "active" })]);
    const { result } = renderHook(() => useCommandCenterItems(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data[0].type).toBe("model-ready");
  });

  it("maps analysis phase to evidence-gap", async () => {
    resolveWith([makeCase({ phase: "analysis", status: "active" })]);
    const { result } = renderHook(() => useCommandCenterItems(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data[0].type).toBe("evidence-gap");
  });

  it("formats totalValue >= 1M as $XM", async () => {
    resolveWith([makeCase({ totalValue: 2_500_000 })]);
    const { result } = renderHook(() => useCommandCenterItems(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data[0].projectedValue).toBe("$2.5M");
  });

  it("formats totalValue >= 1K as $XK", async () => {
    resolveWith([makeCase({ totalValue: 750_000 })]);
    const { result } = renderHook(() => useCommandCenterItems(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data[0].projectedValue).toBe("$750K");
  });

  it("formats undefined totalValue as em-dash", async () => {
    resolveWith([makeCase({ totalValue: undefined })]);
    const { result } = renderHook(() => useCommandCenterItems(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data[0].projectedValue).toBe("—");
  });

  it("returns empty array when API returns no cases", async () => {
    resolveWith([]);
    const { result } = renderHook(() => useCommandCenterItems(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toHaveLength(0);
  });

  it("sets error state on API failure", async () => {
    rejectWith("Network error");
    const { result } = renderHook(() => useCommandCenterItems(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network error");
    expect(result.current.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useMaturityCards
// ---------------------------------------------------------------------------

describe("useMaturityCards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("groups cases into correct columns by phase", async () => {
    resolveWith([
      makeCase({ id: "c1", phase: "discovery", status: "active" }),
      makeCase({ id: "c2", phase: "modeling", status: "active" }),
      makeCase({ id: "c3", phase: "review", status: "active" }),
      makeCase({ id: "c4", phase: "finalize", status: "active" }),
      makeCase({ id: "c5", phase: "analysis", status: "active" }),
    ]);
    const { result } = renderHook(() => useMaturityCards(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const { data } = result.current;
    expect(data["signal"]).toHaveLength(1);
    expect(data["hypothesis"]).toHaveLength(1);
    expect(data["defensible"]).toHaveLength(1);
    expect(data["approved"]).toHaveLength(1);
    expect(data["evidence"]).toHaveLength(1);
  });

  it("routes committed cases to realization column regardless of phase", async () => {
    resolveWith([makeCase({ phase: "discovery", status: "committed" })]);
    const { result } = renderHook(() => useMaturityCards(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data["realization"]).toHaveLength(1);
    expect(result.current.data["signal"]).toBeUndefined();
  });

  it("sets blocked=true for closed cases", async () => {
    resolveWith([makeCase({ status: "closed" })]);
    const { result } = renderHook(() => useMaturityCards(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const card = Object.values(result.current.data).flat()[0];
    expect(card.blocked).toBe(true);
  });

  it("sets confidence=88 for finalize phase", async () => {
    resolveWith([makeCase({ phase: "finalize", status: "active" })]);
    const { result } = renderHook(() => useMaturityCards(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data["approved"][0].confidence).toBe(88);
  });

  it("sets confidence=72 for review phase", async () => {
    resolveWith([makeCase({ phase: "review", status: "active" })]);
    const { result } = renderHook(() => useMaturityCards(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data["defensible"][0].confidence).toBe(72);
  });

  it("falls back to signal column for unknown phase", async () => {
    resolveWith([makeCase({ phase: "unknown-phase", status: "active" })]);
    const { result } = renderHook(() => useMaturityCards(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data["signal"]).toHaveLength(1);
  });

  it("returns empty grouped object when no cases", async () => {
    resolveWith([]);
    const { result } = renderHook(() => useMaturityCards(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(Object.keys(result.current.data)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useRealizationKpis
// ---------------------------------------------------------------------------

describe("useRealizationKpis", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only includes committed cases", async () => {
    resolveWith([
      makeCase({ id: "c1", status: "committed" }),
      makeCase({ id: "c2", status: "active" }),
      makeCase({ id: "c3", status: "closed" }),
    ]);
    const { result } = renderHook(() => useRealizationKpis(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].id).toBe("c1");
  });

  it("sets actual to 87% of target value", async () => {
    resolveWith([makeCase({ status: "committed", totalValue: 1_000_000 })]);
    const { result } = renderHook(() => useRealizationKpis(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data[0].target).toBe("$1.0M");
    expect(result.current.data[0].actual).toBe("$870K");
  });

  it("returns empty array when no committed cases", async () => {
    resolveWith([makeCase({ status: "active" })]);
    const { result } = renderHook(() => useRealizationKpis(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useExpansionOpportunities
// ---------------------------------------------------------------------------

describe("useExpansionOpportunities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes both committed and closed cases", async () => {
    resolveWith([
      makeCase({ id: "c1", status: "committed" }),
      makeCase({ id: "c2", status: "closed" }),
      makeCase({ id: "c3", status: "active" }),
    ]);
    const { result } = renderHook(() => useExpansionOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toHaveLength(2);
    const ids = result.current.data.map((o) => o.id);
    expect(ids).toContain("c1");
    expect(ids).toContain("c2");
  });

  it("prefixes title with 'Expand:'", async () => {
    resolveWith([makeCase({ name: "Big Deal", status: "committed" })]);
    const { result } = renderHook(() => useExpansionOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data[0].title).toBe("Expand: Big Deal");
  });

  it("estimates value at 40% of totalValue", async () => {
    resolveWith([makeCase({ status: "committed", totalValue: 1_000_000 })]);
    const { result } = renderHook(() => useExpansionOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data[0].estimatedValue).toBe("$400K");
  });

  it("returns empty array when no eligible cases", async () => {
    resolveWith([makeCase({ status: "active" })]);
    const { result } = renderHook(() => useExpansionOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toHaveLength(0);
  });
});
