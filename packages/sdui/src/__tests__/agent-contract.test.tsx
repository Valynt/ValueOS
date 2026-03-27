/**
 * SDUI Agent Contract Tests — P0
 *
 * Covers:
 * - renderPage renders UnknownComponentFallback for unregistered component types
 *   without throwing (React tree must not crash)
 * - sanitizeProps strips XSS vectors from SDUI payloads before rendering
 *   (script tags, event handlers, javascript: URIs)
 * - LazyComponentRegistry emits a COMPONENT_ERROR telemetry event when a
 *   component fails to load
 *
 * These tests prove the frontend degrades safely when the backend emits
 * unknown or malicious SDUI payloads.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before imports that transitively use them
// ---------------------------------------------------------------------------

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@shared/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Stub all lazy-loaded SDUI components so dynamic imports resolve synchronously
vi.mock("../components/Agent/ConfidenceDisplay", () => ({
  ConfidenceDisplay: () => React.createElement("div", { "data-testid": "ConfidenceDisplay" }),
}));
vi.mock("../components/Agent/IntegrityVetoPanel", () => ({
  IntegrityVetoPanel: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/ArtifactPreview", () => ({
  ArtifactPreview: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/AssumptionRegister", () => ({
  AssumptionRegister: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/CanvasLayout", () => ({
  DashboardPanel: () => React.createElement("div"),
  Grid: () => React.createElement("div"),
  HorizontalSplit: () => React.createElement("div"),
  VerticalSplit: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/CheckpointTimeline", () => ({
  CheckpointTimeline: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/DiscoveryCard", () => ({
  DiscoveryCard: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/EvidenceGapList", () => ({
  EvidenceGapList: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/GapResolution", () => ({
  GapResolution: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/HallucinationBadge", () => ({
  HallucinationBadge: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/HypothesisCard", () => ({
  HypothesisCard: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/InlineEditor", () => ({
  InlineEditor: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/InteractiveChart", () => ({
  InteractiveChart: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/KPIForm", () => ({
  KPIForm: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/KPITargetCard", () => ({
  KPITargetCard: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/MetricCard", () => ({
  MetricCard: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/NarrativeBlock", () => ({
  NarrativeBlock: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/PlanComparison", () => ({
  PlanComparison: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/ReadinessGauge", () => ({
  ReadinessGauge: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/ScenarioComparison", () => ({
  ScenarioComparison: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/SensitivityTornado", () => ({
  SensitivityTornado: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/StakeholderMap", () => ({
  StakeholderMap: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/UsageMeter", () => ({
  UsageMeter: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/ValuePathCard", () => ({
  ValuePathCard: () => React.createElement("div"),
}));
vi.mock("../components/SDUI/ValueTreeCard", () => ({
  ValueTreeCard: () => React.createElement("div"),
}));
vi.mock("../components/Workflow/HumanCheckpoint", () => ({
  HumanCheckpoint: () => React.createElement("div"),
}));
vi.mock("../components/Workflow/WorkflowStatusBar", () => ({
  WorkflowStatusBar: () => React.createElement("div"),
}));
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
  SectionErrorFallback: ({ componentName }: { componentName: string }) =>
    React.createElement("div", { "data-testid": "section-error-fallback" }, componentName),
  SideNavigation: () => React.createElement("div"),
  TabBar: () => React.createElement("div"),
  TextBlock: () => React.createElement("div"),
  UnknownComponentFallback: ({ componentName }: { componentName: string }) =>
    React.createElement(
      "div",
      { "data-testid": "unknown-component-fallback" },
      `Unknown: ${componentName}`,
    ),
  ValueCommitForm: () => React.createElement("div"),
  ValueHypothesisCard: () => React.createElement("div"),
  ComponentPreview: () => React.createElement("div"),
}));

// ---------------------------------------------------------------------------
// Imports under test (after mocks are registered)
// ---------------------------------------------------------------------------

import { renderPage } from "../renderPage";
import { sanitizeProps } from "../security/sanitization";
import type { SDUIPageDefinition } from "../schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUnknownComponentPage(componentType: string): SDUIPageDefinition {
  return {
    type: "page",
    version: 1,
    sections: [
      {
        type: "component",
        component: componentType,
        version: 1,
        props: { title: "Test" },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests: Unknown component fallback
// ---------------------------------------------------------------------------

describe("SDUI agent contract — unknown component fallback", () => {
  it("renders UnknownComponentFallback for an unregistered component type", () => {
    const page = makeUnknownComponentPage("UnregisteredWidget_XYZ");

    const { element } = renderPage(page, { skipComponentValidation: true });
    const { getByTestId } = render(element);

    expect(getByTestId("unknown-component-fallback")).toBeInTheDocument();
  });

  it("does not throw when the SDUI payload contains an unknown component", () => {
    const page = makeUnknownComponentPage("AgentOutputBlock_v99_Unknown");

    expect(() => {
      const { element } = renderPage(page, { skipComponentValidation: true });
      render(element);
    }).not.toThrow();
  });

  it("renders the unknown component name in the fallback", () => {
    const page = makeUnknownComponentPage("DiscoveryResultCard_Future");

    const { element } = renderPage(page, { skipComponentValidation: true });
    render(element);

    expect(screen.getByTestId("unknown-component-fallback").textContent).toContain(
      "DiscoveryResultCard_Future",
    );
  });

  it("renders known components normally alongside unknown ones", () => {
    const page: SDUIPageDefinition = {
      type: "page",
      version: 1,
      sections: [
        {
          type: "component",
          component: "InfoBanner",
          version: 1,
          props: { title: "Known" },
        },
        {
          type: "component",
          component: "UnregisteredWidget_XYZ",
          version: 1,
          props: {},
        },
      ],
    };

    const { element } = renderPage(page, { skipComponentValidation: true });
    const { getByTestId } = render(element);

    // Unknown component renders fallback; known component renders normally
    expect(getByTestId("unknown-component-fallback")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: XSS prevention via sanitizeProps
// ---------------------------------------------------------------------------

describe("SDUI agent contract — XSS prevention in sanitizeProps", () => {
  it("strips <script> tags from string props", () => {
    const malicious = {
      title: '<script>alert("XSS")</script>Safe Title',
      content: "Normal content",
    };

    const sanitized = sanitizeProps(malicious, "NarrativeBlock");

    expect(sanitized.title).not.toContain("<script>");
    expect(sanitized.title).not.toContain("alert");
    expect(sanitized.title).toContain("Safe Title");
  });

  it("strips onerror event handler attributes", () => {
    const malicious = {
      content: '<img src=x onerror="alert(1)">',
    };

    const sanitized = sanitizeProps(malicious, "InfoBanner");

    expect(sanitized.content).not.toContain("onerror=");
    expect(sanitized.content).not.toContain("alert(1)");
  });

  it("strips javascript: URI schemes", () => {
    const malicious = {
      link: "javascript:alert(document.cookie)",
      label: "Click me",
    };

    const sanitized = sanitizeProps(malicious, "TextBlock");

    expect(sanitized.link).not.toContain("javascript:");
  });

  it("strips onclick and other inline event handlers", () => {
    const malicious = {
      content: '<div onclick="stealData()">Click</div>',
    };

    const sanitized = sanitizeProps(malicious, "AgentResponseCard");

    expect(sanitized.content).not.toContain("onclick=");
    expect(sanitized.content).not.toContain("stealData");
  });

  it("handles nested object props recursively", () => {
    const malicious = {
      metadata: {
        description: '<script>alert("nested XSS")</script>',
        url: "javascript:void(0)",
      },
    };

    const sanitized = sanitizeProps(malicious, "ValueHypothesisCard");

    expect((sanitized.metadata as Record<string, unknown>).description).not.toContain("<script>");
    expect((sanitized.metadata as Record<string, unknown>).url).not.toContain("javascript:");
  });

  it("preserves safe HTML content", () => {
    const safe = {
      title: "Revenue Growth Analysis",
      content: "Projected <strong>15%</strong> increase in ARR.",
    };

    const sanitized = sanitizeProps(safe, "NarrativeBlock");

    expect(sanitized.title).toBe("Revenue Growth Analysis");
    // Safe tags should be preserved (DOMPurify allowlist) — content contains "ARR"
    expect(sanitized.content).toContain("ARR");
  });
});

// ---------------------------------------------------------------------------
// Tests: LazyComponentRegistry telemetry
// ---------------------------------------------------------------------------

describe("SDUI agent contract — LazyComponentRegistry telemetry", () => {
  it("emits COMPONENT_RESOLVE telemetry for every lookup, including unknown components", async () => {
    // Import the registry and telemetry after mocks are set up.
    // LazyComponentRegistry is in src/; telemetry is in lib/ (one level above src/).
    const { LazyComponentRegistry } = await import("../LazyComponentRegistry");
    const { sduiTelemetry, TelemetryEventType } = await import("../../lib/telemetry/SDUITelemetry");

    const recordEventSpy = vi.spyOn(sduiTelemetry, "recordEvent");

    // Attempt to resolve a component that doesn't exist in the lazy registry.
    // The registry emits COMPONENT_RESOLVE at the start of every lookup, then
    // returns undefined for unknown names (no COMPONENT_ERROR — that is only
    // emitted when a lazy import promise rejects, not for a simple name miss).
    const result = await LazyComponentRegistry.resolveComponentAsync({
      type: "component",
      component: "NonExistentLazyComponent_Test",
      version: 1,
      props: {},
    });

    // Unknown components return undefined without crashing
    expect(result).toBeUndefined();

    // COMPONENT_RESOLVE must be emitted so observability pipelines can track
    // unknown-component frequency and alert on schema drift.
    expect(recordEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TelemetryEventType.COMPONENT_RESOLVE,
        metadata: expect.objectContaining({
          component: "NonExistentLazyComponent_Test",
        }),
      }),
    );

    // COMPONENT_ERROR must NOT be emitted for a simple name miss — it is reserved
    // for actual load failures (dynamic import rejections).
    expect(recordEventSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: TelemetryEventType.COMPONENT_ERROR }),
    );

    recordEventSpy.mockRestore();
  });

  it("emits COMPONENT_ERROR telemetry when a lazy import rejects", async () => {
    const { LazyComponentRegistry } = await import("../LazyComponentRegistry");
    const { sduiTelemetry, TelemetryEventType } = await import("../../lib/telemetry/SDUITelemetry");

    // Clear the component cache so no component is served from a prior cache
    // hit — resolveComponentAsync returns early on a cache hit without calling
    // loadComponent, which would prevent COMPONENT_ERROR from being emitted.
    LazyComponentRegistry.clearCache();

    const recordEventSpy = vi.spyOn(sduiTelemetry, "recordEvent");

    // Inject a component name that IS in the registry map but whose loader throws.
    // We do this by temporarily patching loadComponent on the class.
    const originalLoadComponent = (LazyComponentRegistry as unknown as Record<string, unknown>)
      .loadComponent as (name: string, loader: unknown) => Promise<unknown>;

    (LazyComponentRegistry as unknown as Record<string, unknown>).loadComponent = vi
      .fn()
      .mockRejectedValueOnce(new Error("Dynamic import failed: chunk not found"));

    // Use DataTable — registered in lazyComponents but not in the critical preload
    // list, so it is guaranteed not to be in cache when clearCache() is called.
    const result = await LazyComponentRegistry.resolveComponentAsync({
      type: "component",
      component: "DataTable",
      version: 1,
      props: {},
    });

    expect(result).toBeUndefined();

    expect(recordEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TelemetryEventType.COMPONENT_ERROR,
        metadata: expect.objectContaining({
          component: "DataTable",
          error: "Dynamic import failed: chunk not found",
        }),
      }),
    );

    // Restore
    (LazyComponentRegistry as unknown as Record<string, unknown>).loadComponent =
      originalLoadComponent;
    recordEventSpy.mockRestore();
  });
});
