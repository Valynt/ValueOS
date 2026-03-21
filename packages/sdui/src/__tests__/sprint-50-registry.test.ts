/**
 * Sprint 50 — Value Graph UI: registry presence tests
 *
 * Verifies that MetricCard and ValuePathCard are wired into both the
 * baseRegistry (legacy lookup) and the versionedRegistry (SDUI rendering).
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";

// vi.mock is hoisted — use vi.fn() directly in factory, not a variable
vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@shared/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const makeStub = (name: string) => {
  const fn = () => React.createElement("div");
  fn.displayName = name;
  return fn;
};

vi.mock("../components/Agent/ConfidenceDisplay", () => ({ ConfidenceDisplay: () => React.createElement("div") }));
vi.mock("../components/Agent/IntegrityVetoPanel", () => ({ IntegrityVetoPanel: () => React.createElement("div") }));
vi.mock("../components/SDUI/ArtifactPreview", () => ({ ArtifactPreview: () => React.createElement("div") }));
vi.mock("../components/SDUI/AssumptionRegister", () => ({ AssumptionRegister: () => React.createElement("div") }));
vi.mock("../components/SDUI/CanvasLayout", () => ({
  DashboardPanel: () => React.createElement("div"),
  Grid: () => React.createElement("div"),
  HorizontalSplit: () => React.createElement("div"),
  VerticalSplit: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/CheckpointTimeline", () => ({ CheckpointTimeline: () => React.createElement("div") }));
vi.mock("../components/SDUI/DiscoveryCard", () => ({ DiscoveryCard: () => React.createElement("div") }));
vi.mock("../components/SDUI/EvidenceGapList", () => ({ EvidenceGapList: () => React.createElement("div") }));
vi.mock("../components/SDUI/GapResolution", () => ({ GapResolution: () => React.createElement("div") }));
vi.mock("../components/SDUI/HallucinationBadge", () => ({ HallucinationBadge: () => React.createElement("div") }));
vi.mock("../components/SDUI/HypothesisCard", () => ({ HypothesisCard: () => React.createElement("div") }));
vi.mock("../components/SDUI/InlineEditor", () => ({ InlineEditor: () => React.createElement("div") }));
vi.mock("../components/SDUI/InteractiveChart", () => ({ InteractiveChart: () => React.createElement("div") }));
vi.mock("../components/SDUI/KPIForm", () => ({ KPIForm: () => React.createElement("div") }));
vi.mock("../components/SDUI/KPITargetCard", () => ({ KPITargetCard: () => React.createElement("div") }));
vi.mock("../components/SDUI/NarrativeBlock", () => ({ NarrativeBlock: () => React.createElement("div") }));
vi.mock("../components/SDUI/PlanComparison", () => ({ PlanComparison: () => React.createElement("div") }));
vi.mock("../components/SDUI/ReadinessGauge", () => ({ ReadinessGauge: () => React.createElement("div") }));
vi.mock("../components/SDUI/ScenarioComparison", () => ({ ScenarioComparison: () => React.createElement("div") }));
vi.mock("../components/SDUI/SensitivityTornado", () => ({ SensitivityTornado: () => React.createElement("div") }));
vi.mock("../components/SDUI/StakeholderMap", () => ({ StakeholderMap: () => React.createElement("div") }));
vi.mock("../components/SDUI/UsageMeter", () => ({ UsageMeter: () => React.createElement("div") }));
vi.mock("../components/SDUI/ValueTreeCard", () => ({ ValueTreeCard: () => React.createElement("div") }));
vi.mock("../components/Workflow/HumanCheckpoint", () => ({ HumanCheckpoint: () => React.createElement("div") }));
vi.mock("../components/Workflow/WorkflowStatusBar", () => ({ WorkflowStatusBar: () => React.createElement("div") }));
vi.mock("../components/SDUI", () => ({
  AgentResponseCard: () => React.createElement("div"),
  AgentWorkflowPanel: () => React.createElement("div"),
  Breadcrumbs: () => React.createElement("div"),
  ConfidenceIndicator: () => React.createElement("div"),
  ConfirmationDialog: () => React.createElement("div"),
  DataTable: () => React.createElement("div"),
  ExpansionBlock: () => React.createElement("div"),
  InfoBanner: () => React.createElement("div"),
  IntegrityReviewPanel: () => React.createElement("div"),
  JsonViewer: () => React.createElement("div"),
  LifecyclePanel: () => React.createElement("div"),
  MetricBadge: () => React.createElement("div"),
  ProgressBar: () => React.createElement("div"),
  RealizationDashboard: () => React.createElement("div"),
  ScenarioSelector: () => React.createElement("div"),
  SDUIForm: () => React.createElement("div"),
  SectionErrorFallback: () => React.createElement("div"),
  SideNavigation: () => React.createElement("div"),
  TabBar: () => React.createElement("div"),
  TextBlock: () => React.createElement("div"),
  UnknownComponentFallback: () => React.createElement("div"),
  ValueCommitForm: () => React.createElement("div"),
  ValueHypothesisCard: () => React.createElement("div"),
  ComponentPreview: () => React.createElement("div"),
}));

// Import the real Sprint 50 components — their displayName must be preserved
import { MetricCard } from "../components/SDUI/MetricCard";
import { ValuePathCard } from "../components/SDUI/ValuePathCard";

import {
  baseRegistry,
  versionedRegistry,
  listRegisteredComponents,
} from "../registry";

describe("Sprint 50 — registry presence", () => {
  describe("baseRegistry (legacy string-keyed lookup)", () => {
    it("contains MetricCard entry", () => {
      expect(baseRegistry).toHaveProperty("MetricCard");
      expect(baseRegistry["MetricCard"]!.versions).toContain(1);
    });

    it("MetricCard entry has required prop 'metric'", () => {
      expect(baseRegistry["MetricCard"]!.requiredProps).toContain("metric");
    });

    it("contains ValuePathCard entry", () => {
      expect(baseRegistry).toHaveProperty("ValuePathCard");
      expect(baseRegistry["ValuePathCard"]!.versions).toContain(1);
    });

    it("ValuePathCard entry has required prop 'path'", () => {
      expect(baseRegistry["ValuePathCard"]!.requiredProps).toContain("path");
    });
  });

  describe("versionedRegistry (component-name keyed)", () => {
    it("resolves MetricCard at version 1 without fallback", () => {
      const result = versionedRegistry.resolve("MetricCard", 1);
      expect(result.isFallback).toBe(false);
      expect(result.version).toBe(1);
      expect(result.component).toBe(MetricCard);
    });

    it("resolves ValuePathCard at version 1 without fallback", () => {
      const result = versionedRegistry.resolve("ValuePathCard", 1);
      expect(result.isFallback).toBe(false);
      expect(result.version).toBe(1);
      expect(result.component).toBe(ValuePathCard);
    });

    it("MetricCard metadata has requiredProps", () => {
      const meta = versionedRegistry.getMetadata("MetricCard");
      expect(meta).not.toBeNull();
      expect(meta!.requiredProps).toContain("metric");
    });

    it("ValuePathCard metadata has requiredProps", () => {
      const meta = versionedRegistry.getMetadata("ValuePathCard");
      expect(meta).not.toBeNull();
      expect(meta!.requiredProps).toContain("path");
    });
  });

  describe("listRegisteredComponents", () => {
    it("returns at least 27 components (pre-Sprint-50 count + 2 new)", () => {
      const all = listRegisteredComponents();
      expect(all.length).toBeGreaterThanOrEqual(27);
    });

    it("baseRegistry keys include both new components", () => {
      const keys = Object.keys(baseRegistry);
      expect(keys).toContain("MetricCard");
      expect(keys).toContain("ValuePathCard");
    });
  });
});
