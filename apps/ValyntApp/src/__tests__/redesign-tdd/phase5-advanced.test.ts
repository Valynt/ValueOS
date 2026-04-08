/**
 * TDD: Frontend Redesign — Phase 5 Contracts
 *
 * These tests encode the contracts from the redesign blueprint Section 5.
 * Each test asserts behavioral correctness, not just export existence.
 */

import { describe, expect, it, vi } from "vitest";

import type { Graph } from "@/features/living-value-graph/types/graph.types";
import { type WarmthOverrides, POST_SALE_WARMTH, deriveWarmth, SAGA_TO_WARMTH } from "@shared/domain/Warmth";

// Import implemented modules
import { computeForceLayout, shouldUseWebWorker } from "@/features/living-value-graph/utils/force-layout";
import { SNAP_COMPATIBILITY } from "@/features/living-value-graph/utils/snap-validation";
import { SIMPLIFIED_VIEW_THRESHOLD, shouldUseClusterView } from "@/features/living-value-graph/utils/cluster-view";
import { THRESHOLD_BOUNDS, resolveWarmthThresholds } from "@/lib/warmth-thresholds";
import { logThresholdChange } from "@/lib/analytics/warmth";
import { evaluateExpansionTriggers } from "@/hooks/queries/useExpansionSignals";
import { applyRealizationFeedback } from "@/hooks/useRealizationFeedback";
import { exportGraphData, exportGraphNodesAsCsv, exportGraphEdgesAsCsv, exportGraphAsJson } from "@/lib/export/graph-export";
import { generateGraphShareLink, parseGraphShareLink, encodeFilters, decodeFilters } from "@/lib/export/graph-sharing";

// Helper to create valid Graph mock
function createMockGraph(partial: Partial<Graph> & { nodes: Graph["nodes"]; edges: Graph["edges"] }): Graph {
  return {
    id: "test-graph",
    versionId: "v1",
    scenarioId: "scenario-1",
    computedAt: new Date().toISOString(),
    globalMetrics: {
      npv: 1000000,
      roi: 2.5,
      paybackMonths: 12,
      confidence: 0.8,
      defensibilityScore: 0.75,
    },
    evidenceCoverage: 0.85,
    ...partial,
  };
}

// ============================================================================
// §5.1 Canvas Physics — Magnetic Connections
// ============================================================================

describe("5.1 Canvas Physics", () => {
  it("5.1.1: Force layout engine computes positions for all nodes", () => {
    const mockGraph = createMockGraph({
      nodes: {
        "node-1": { id: "node-1", type: "driver", label: "Driver A", value: 1000000, confidence: 0.8 },
        "node-2": { id: "node-2", type: "input", label: "Input B", value: 500000, confidence: 0.6 },
      },
      edges: {
        "edge-1": { id: "edge-1", source: "node-2", target: "node-1", type: "input" },
      },
    });

    const positions = computeForceLayout(mockGraph, {
      valueGravity: true,
      confidenceRepulsion: true,
      warmthClustering: false,
    });

    expect(positions).toHaveProperty("node-1");
    expect(positions).toHaveProperty("node-2");
    const pos1 = positions["node-1"];
    const pos2 = positions["node-2"];
    expect(pos1).toBeDefined();
    expect(pos2).toBeDefined();
    expect(typeof pos1!.x).toBe("number");
    expect(typeof pos1!.y).toBe("number");
    expect(typeof pos2!.x).toBe("number");
    expect(typeof pos2!.y).toBe("number");
  });

  it("5.1.2: Snap compatibility matrix defines valid connections", () => {
    expect(SNAP_COMPATIBILITY).toHaveProperty("input");
    expect(SNAP_COMPATIBILITY).toHaveProperty("driver");
    expect(SNAP_COMPATIBILITY).toHaveProperty("metric");
    expect(SNAP_COMPATIBILITY).toHaveProperty("output");
    expect(SNAP_COMPATIBILITY).toHaveProperty("assumption");
    expect(SNAP_COMPATIBILITY.input).toContain("driver");
    expect(SNAP_COMPATIBILITY.input).toContain("metric");
    expect(SNAP_COMPATIBILITY.driver).toContain("output");
    expect(SNAP_COMPATIBILITY.driver).toContain("metric");
    expect(SNAP_COMPATIBILITY.output).toHaveLength(0);
  });

  it("5.1.3: Web Worker threshold configuration behaves correctly", () => {
    expect(typeof shouldUseWebWorker).toBe("function");
    expect(shouldUseWebWorker(51)).toBe(true);
    expect(shouldUseWebWorker(49)).toBe(false);
  });

  it("5.1.4: Cluster view toggle behaves correctly at threshold", () => {
    expect(typeof SIMPLIFIED_VIEW_THRESHOLD).toBe("number");
    expect(SIMPLIFIED_VIEW_THRESHOLD).toBeGreaterThanOrEqual(50);
    expect(SIMPLIFIED_VIEW_THRESHOLD).toBeLessThanOrEqual(200);
    expect(shouldUseClusterView(50)).toBe(false);
    expect(shouldUseClusterView(150)).toBe(true);
  });
});

// ============================================================================
// §5.2 Custom Warmth Thresholds
// ============================================================================

describe("5.2 Custom Warmth Thresholds", () => {
  it("5.2.1: Threshold bounds are within allowed ranges", () => {
    expect(THRESHOLD_BOUNDS.firmMinimum.min).toBe(0.5);
    expect(THRESHOLD_BOUNDS.firmMinimum.max).toBe(0.7);
    expect(THRESHOLD_BOUNDS.firmMinimum.default).toBe(0.6);
    expect(THRESHOLD_BOUNDS.verifiedMinimum.min).toBe(0.7);
    expect(THRESHOLD_BOUNDS.verifiedMinimum.max).toBe(0.9);
    expect(THRESHOLD_BOUNDS.verifiedMinimum.default).toBe(0.8);
  });

  it("5.2.2: Warmth overrides schema validates per-case overrides", () => {
    const validOverride: WarmthOverrides = {
      firmMinimum: 0.55,
      verifiedMinimum: 0.75,
      overriddenBy: "user-123",
      overriddenAt: "2026-01-15T10:00:00Z",
      reason: "Client requires lower threshold",
    };

    expect(validOverride.firmMinimum).toBeGreaterThanOrEqual(0.5);
    expect(validOverride.firmMinimum).toBeLessThanOrEqual(0.7);
    expect(validOverride.verifiedMinimum).toBeGreaterThanOrEqual(0.7);
    expect(validOverride.verifiedMinimum).toBeLessThanOrEqual(0.9);
    expect(validOverride.overriddenBy).toBeDefined();
    expect(validOverride.overriddenAt).toBeDefined();
  });

  it("5.2.3: deriveWarmth maps saga states to correct warmth levels", () => {
    // VALIDATING → firm
    expect(deriveWarmth("VALIDATING", 0.55).state).toBe("firm");
    // DRAFTING → forming
    expect(deriveWarmth("DRAFTING", 0.55).state).toBe("forming");
    // REFINING → verified
    expect(deriveWarmth("REFINING", 0.55).state).toBe("verified");
    // Unknown state defaults to forming
    expect(deriveWarmth("UNKNOWN" as never, 0.55).state).toBe("forming");
  });

  it("5.2.3: deriveWarmth applies custom override thresholds", () => {
    const overrides: WarmthOverrides = {
      firmMinimum: 0.5,
      verifiedMinimum: 0.7,
      overriddenBy: "u1",
      overriddenAt: "2026-01-01T00:00:00Z",
    };

    // With lower firmMinimum, high confidence in forming should get "firming" modifier
    const result = deriveWarmth("DRAFTING", 0.75, overrides);
    expect(result.modifier).toBe("firming");
  });

  it("5.2.3: Override precedence chain works (per-case > global > default)", () => {
    const perCaseOverride: WarmthOverrides = { firmMinimum: 0.55, verifiedMinimum: 0.85, overriddenBy: "u1", overriddenAt: "2026-01-01T00:00:00Z" };
    const globalPreference = { firmMinimum: 0.65, verifiedMinimum: 0.85, updatedAt: "2026-01-01T00:00:00Z" };

    const resolved = resolveWarmthThresholds(perCaseOverride, globalPreference);

    expect(resolved.firmMinimum).toBe(0.55);
    expect(resolved.verifiedMinimum).toBe(0.85);
  });

  it("5.2.4: logThresholdChange emits audit event with correct shape", () => {
    const emitted: Array<Record<string, unknown>> = [];
    const captureFn = (evt: Record<string, unknown>) => { emitted.push(evt); };

    logThresholdChange({
      caseId: "case-123",
      userId: "user-456",
      oldThresholds: { firmMinimum: 0.6 },
      newThresholds: { firmMinimum: 0.55 },
      reason: "Client preference",
    }, captureFn);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      action: "WARMTH_THRESHOLD_CHANGED",
      actor: "user-456",
      resource: "case:case-123",
    });
  });
});

// ============================================================================
// §5.3 Realization Tracker (Full Implementation)
// ============================================================================

describe("5.3 Realization Tracker", () => {
  it("5.3.1: Post-sale warmth states map to correct warmth levels", () => {
    // POST_SALE_WARMTH maps logical states to WarmthState values
    expect(POST_SALE_WARMTH.TRACKING).toBe("verified");
    expect(POST_SALE_WARMTH.REALIZED).toBe("verified");
    expect(POST_SALE_WARMTH.AT_RISK).toBe("firm");
    expect(POST_SALE_WARMTH.EXPANSION_READY).toBe("verified");

    // deriveWarmth should produce the expected warmth for these saga states
    expect(deriveWarmth("TRACKING", 0.9).state).toBe("verified");
    expect(deriveWarmth("REALIZED", 0.9).state).toBe("verified");
    expect(deriveWarmth("AT_RISK", 0.5).state).toBe("firm");
    expect(deriveWarmth("EXPANSION_READY", 0.85).state).toBe("verified");
  });

  it("5.3.3: evaluateExpansionTriggers returns null when no KPIs exceed targets", () => {
    const checkpoints = [
      { kpiName: "revenue", targetValue: 100, actualValue: 80, date: "2026-01-01" },
      { kpiName: "cost", targetValue: 50, actualValue: 45, date: "2026-01-01" },
    ];
    const kpiTargets = { revenue: 100, cost: 50 };

    const signal = evaluateExpansionTriggers(checkpoints, kpiTargets);
    expect(signal).toBeNull();
  });

  it("5.3.3: evaluateExpansionTriggers fires when multiple KPIs exceed targets consecutively", () => {
    const checkpoints = [
      { kpiName: "revenue", targetValue: 100, actualValue: 120, date: "2026-01-02" },
      { kpiName: "revenue", targetValue: 100, actualValue: 118, date: "2026-01-01" },
      { kpiName: "satisfaction", targetValue: 80, actualValue: 95, date: "2026-01-02" },
      { kpiName: "satisfaction", targetValue: 80, actualValue: 92, date: "2026-01-01" },
    ];
    const kpiTargets = { revenue: 100, satisfaction: 80 };

    const signal = evaluateExpansionTriggers(checkpoints, kpiTargets);
    expect(signal).not.toBeNull();
    expect(signal!.triggerType).toBe("kpi_exceeded");
    expect(signal!.kpis.length).toBeGreaterThanOrEqual(1);
  });

  it("5.3.5: Realization feedback increases confidence when actuals match projections", () => {
    const mockGraph = createMockGraph({
      nodes: {
        "driver-1": { id: "driver-1", type: "driver", label: "Driver A", value: 1000000, confidence: 0.7 },
      },
      edges: {},
    });

    const actuals = {
      "driver-1": { projected: 1000000, actual: 980000, accuracy: 0.98 },
    };

    const updatedGraph = applyRealizationFeedback(mockGraph, actuals);
    expect(updatedGraph.nodes["driver-1"]).toBeDefined();
    expect(updatedGraph.nodes["driver-1"]!.confidence).toBeCloseTo(0.8, 10);
    expect(updatedGraph.versionId).toContain("v1-feedback-");
  });

  it("5.3.5: Realization feedback decreases confidence when actuals diverge significantly", () => {
    const mockGraph = createMockGraph({
      nodes: {
        "driver-1": { id: "driver-1", type: "driver", label: "Driver A", value: 1000000, confidence: 0.8 },
      },
      edges: {},
    });

    const actuals = {
      "driver-1": { projected: 1000000, actual: 200000, accuracy: 0.2 },
    };

    const updatedGraph = applyRealizationFeedback(mockGraph, actuals);
    expect(updatedGraph.nodes["driver-1"]).toBeDefined();
    expect(updatedGraph.nodes["driver-1"]!.confidence).toBe(0.65);
    expect(updatedGraph.versionId).toContain("v1-feedback-");
  });

  it("5.3.5: Realization feedback honors confidence thresholds at boundaries", () => {
    const mockGraph = createMockGraph({
      nodes: {
        "excellent-95": { id: "excellent-95", type: "driver", label: "Excellent", value: 100, confidence: 0.6 },
        "good-85": { id: "good-85", type: "driver", label: "Good", value: 100, confidence: 0.6 },
        "fair-70": { id: "fair-70", type: "driver", label: "Fair", value: 100, confidence: 0.6 },
        "poor-below-70": { id: "poor-below-70", type: "driver", label: "Poor", value: 100, confidence: 0.6 },
        "floor-check": { id: "floor-check", type: "driver", label: "Floor", value: 100, confidence: 0.31 },
      },
      edges: {},
    });

    const updatedGraph = applyRealizationFeedback(mockGraph, {
      "excellent-95": { projected: 100, actual: 95, accuracy: 0.95 },
      "good-85": { projected: 100, actual: 85, accuracy: 0.85 },
      "fair-70": { projected: 100, actual: 70, accuracy: 0.7 },
      "poor-below-70": { projected: 100, actual: 69, accuracy: 0.69 },
      "floor-check": { projected: 100, actual: 10, accuracy: 0.1 },
    });

    expect(updatedGraph.nodes["excellent-95"]!.confidence).toBeCloseTo(0.7, 10);
    expect(updatedGraph.nodes["good-85"]!.confidence).toBeCloseTo(0.65, 10);
    expect(updatedGraph.nodes["fair-70"]!.confidence).toBeCloseTo(0.6, 10);
    expect(updatedGraph.nodes["poor-below-70"]!.confidence).toBeCloseTo(0.45, 10);
    expect(updatedGraph.nodes["floor-check"]!.confidence).toBeCloseTo(0.3, 10);
  });
});

// ============================================================================
// §5.4 Value Graph Polish
// ============================================================================

describe("5.4 Value Graph Polish", () => {
  it("5.4.4: Graph JSON export includes nodes, edges, and metadata", () => {
    const mockGraph = createMockGraph({
      nodes: {
        "n1": { id: "n1", type: "driver", label: "Node 1", value: 100, confidence: 0.8 },
        "n2": { id: "n2", type: "input", label: "Node 2", value: 50, confidence: 0.6 },
      },
      edges: {
        "e1": { id: "e1", source: "n2", target: "n1", type: "input" },
      },
    });

    const result = exportGraphData(mockGraph, { format: "json" });
    expect(result.mimeType).toBe("application/json");
    expect(result.filename).toContain(".json");

    const parsed = JSON.parse(result.data);
    expect(Object.keys(parsed.nodes)).toHaveLength(2);
    expect(Object.keys(parsed.edges)).toHaveLength(1);
    expect(parsed.exportMetadata).toBeDefined();
    expect(parsed.exportMetadata.version).toBe("1.0");
  });

  it("5.4.4: Node CSV export includes header and data rows", () => {
    const mockGraph = createMockGraph({
      nodes: {
        "n1": { id: "n1", type: "driver", label: "Node 1", value: 100, confidence: 0.8 },
      },
      edges: {},
    });

    const csv = exportGraphNodesAsCsv(mockGraph);
    expect(typeof csv).toBe("string");
    expect(csv).toContain("id,type,label,value,confidence");
    expect(csv).toContain("n1");
    expect(csv).toContain("driver");
  });

  it("5.4.4: Edge CSV export includes header and data rows", () => {
    const mockGraph = createMockGraph({
      nodes: {
        "n1": { id: "n1", type: "driver", label: "Node 1", value: 100, confidence: 0.8 },
        "n2": { id: "n2", type: "input", label: "Node 2", value: 50, confidence: 0.6 },
      },
      edges: {
        "e1": { id: "e1", source: "n2", target: "n1", type: "input" },
      },
    });

    const csv = exportGraphEdgesAsCsv(mockGraph);
    expect(typeof csv).toBe("string");
    expect(csv).toContain("id,source,target,type,formula");
    expect(csv).toContain("e1");
    expect(csv).toContain("n2");
    expect(csv).toContain("n1");
  });

  it("5.4.4: Shareable link encodes case ID and view params", () => {
    const link = generateGraphShareLink("case-abc", { view: "canvas" });
    expect(typeof link).toBe("string");
    expect(link).toContain("case-abc");
    // View is encoded in the 'v' param as JSON
    expect(link).toContain("v=");
    expect(link).toContain("t="); // Token param
  });

  it("5.4.4: Shareable link can be parsed back to original config", () => {
    const link = generateGraphShareLink("case-xyz", { view: "narrative" });
    const parsed = parseGraphShareLink(link);

    expect(parsed).not.toBeNull();
    expect(parsed!.caseId).toBe("case-xyz");
    expect(parsed!.view.view).toBe("narrative");
    expect(parsed!.isValid).toBe(true);
  });

  it("5.4.4: Expired share token is rejected", () => {
    // Create a token that expired 1 hour ago
    const expiredPayload = {
      caseId: "case-expired",
      view: { view: "canvas" as const },
      exp: Date.now() - 3600000,
      auth: false,
      perm: "read",
    };
    const expiredToken = btoa(JSON.stringify(expiredPayload));

    const fakeUrl = `https://app.valueos.app/share/graph/case-expired?v=${encodeURIComponent(JSON.stringify({ view: "canvas" }))}&t=${expiredToken}`;
    const parsed = parseGraphShareLink(fakeUrl);
    expect(parsed).toBeNull();
  });

  it("5.4.4: Filter encoding/decoding round-trips correctly", () => {
    const filters = {
      warmth: "verified" as const,
      defensibilityMin: 0.7,
      view: "canvas" as const,
      valueMin: 1000,
    };

    const encoded = encodeFilters(filters);
    const decoded = decodeFilters(encoded);

    expect(decoded.warmth).toBe("verified");
    expect(decoded.defensibilityMin).toBe(0.7);
    expect(decoded.view).toBe("canvas");
    expect(decoded.valueMin).toBe(1000);
  });
});

// ============================================================================
// §5 Phase 5 Integration Tests
// ============================================================================

describe("5.x Phase 5 Integration", () => {
  it("threshold changes emit audit events with before/after values", () => {
    const mockAuditLog = vi.fn();
    logThresholdChange({
      caseId: "case-123",
      userId: "user-456",
      oldThresholds: { firmMinimum: 0.6 },
      newThresholds: { firmMinimum: 0.55 },
      reason: "Client preference",
    }, mockAuditLog);

    expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "WARMTH_THRESHOLD_CHANGED",
      actor: "user-456",
      resource: "case:case-123",
    }));
  });

  it("SAGA_TO_WARMTH mapping covers all known saga states", () => {
    const expectedStates = [
      "INITIATED", "DRAFTING", "VALIDATING", "COMPOSING",
      "REFINING", "FINALIZED", "TRACKING", "REALIZED",
      "AT_RISK", "EXPANSION_READY",
    ];

    for (const state of expectedStates) {
      expect(SAGA_TO_WARMTH).toHaveProperty(state);
      const warmth = SAGA_TO_WARMTH[state as keyof typeof SAGA_TO_WARMTH];
      expect(["forming", "firm", "verified"]).toContain(warmth);
    }
  });

  it("deriveWarmth returns consistent results for same inputs", () => {
    const result1 = deriveWarmth("VALIDATING", 0.6);
    const result2 = deriveWarmth("VALIDATING", 0.6);

    expect(result1.state).toBe(result2.state);
    expect(result1.modifier).toBe(result2.modifier);
    expect(result1.confidence).toBe(result2.confidence);
  });
});
