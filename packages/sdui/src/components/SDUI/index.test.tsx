import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  AgentResponseCard,
  AgentWorkflowPanel,
  Breadcrumbs,
  ComponentPreview,
  ConfirmationDialog,
  DataTable,
  ExpansionBlock,
  InfoBanner,
  ProgressBar,
  ScenarioSelector,
  SDUIForm,
  SideNavigation,
  TabBar,
  TextBlock,
  UnknownComponentFallback,
  ValueCommitForm,
} from "./index";
import { ReasoningTracePanel } from "./ReasoningTracePanel";
import type { ReasoningTrace } from "./ReasoningTracePanel";

describe("shared SDUI components", () => {
  it("renders content and diagnostic components", () => {
    render(
      <div>
        <InfoBanner title="Notice" description="Aligned" tone="info" />
        <TextBlock text="Body" />
        <DataTable headers={["A"]} data={[["1"]]} aria-label="table" />
        <ProgressBar value={10} max={100} aria-label="progress" />
        <ComponentPreview componentName="InfoBanner" props={{ title: "Notice" }} />
        <UnknownComponentFallback componentName="MissingComponent" />
      </div>
    );

    expect(screen.getByText("Notice")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "table" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "progress" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Preview: InfoBanner")).toBeInTheDocument();
    expect(screen.getByText("MissingComponent")).toBeInTheDocument();
  });

  it("handles navigation interactions", () => {
    const onNavigate = vi.fn();
    const onTab = vi.fn();
    const onSideSelect = vi.fn();
    const onScenarioChange = vi.fn();

    render(
      <div>
        <Breadcrumbs items={[{ id: "1", label: "Home" }]} onNavigate={onNavigate} />
        <TabBar tabs={[{ id: "a", label: "Overview" }]} onChange={onTab} />
        <SideNavigation items={[{ id: "nav", label: "Details" }]} onSelect={onSideSelect} />
        <ScenarioSelector scenarios={[{ id: "base", label: "Base" }]} selectedId="base" onChange={onScenarioChange} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "base" } });

    expect(onNavigate).toHaveBeenCalledWith({ id: "1", label: "Home" });
    expect(onTab).toHaveBeenCalledWith("a");
    expect(onSideSelect).toHaveBeenCalledWith("nav");
    expect(onScenarioChange).toHaveBeenCalledWith("base");
  });

  it("handles workflow and form interactions", () => {
    const onSduiSubmit = vi.fn();
    const onCommitSubmit = vi.fn();
    const onConfirm = vi.fn();

    render(
      <div>
        <AgentResponseCard response="Output" reasoning="Steps" confidence={70} />
        <AgentWorkflowPanel agents={[{ id: "ag", name: "OpportunityAgent", status: "running" }]} />
        <ExpansionBlock title="Details" content="Expanded content" />
        <SDUIForm fields={[{ name: "company", label: "Company", type: "text" }]} onSubmit={onSduiSubmit} submitText="Save form" />
        <ValueCommitForm onSubmit={onCommitSubmit} />
        <ConfirmationDialog open title="Confirm" onConfirm={onConfirm} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Show reasoning" }));
    expect(screen.getByText("Steps")).toBeInTheDocument();
    expect(screen.getByText("OpportunityAgent")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    expect(screen.getByText("Expanded content")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    expect(onSduiSubmit).toHaveBeenCalledWith({ company: "Acme" });

    fireEvent.change(screen.getByPlaceholderText("Owner"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByPlaceholderText("Commitment"), { target: { value: "Increase conversion" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onCommitSubmit).toHaveBeenCalledWith({ owner: "Alex", commitment: "Increase conversion" });

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AgentResponseCard — trace_id / Reasoning tab branch
// ---------------------------------------------------------------------------

const STUB_TRACE: ReasoningTrace = {
  id: "trace-1",
  organization_id: "org-1",
  session_id: "session-1",
  value_case_id: "case-1",
  opportunity_id: null,
  agent_name: "OpportunityAgent",
  agent_version: "1.0.0",
  trace_id: "trace-1",
  inputs: { company: "Acme" },
  transformations: ["Step A", "Step B"],
  assumptions: ["Market is stable"],
  confidence_breakdown: { "Logic Consistency": 0.9, "Data Quality": 0.6 },
  evidence_links: ["https://example.com/evidence"],
  grounding_score: 0.85,
  latency_ms: 320,
  token_usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 },
  created_at: "2026-09-19T00:00:00.000Z",
};

describe("AgentResponseCard — reasoning tab", () => {
  it("renders Output and Reasoning tabs when trace_id is provided", () => {
    render(<AgentResponseCard trace_id="trace-1" response="Agent output" />);

    expect(screen.getByRole("tab", { name: "Output" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reasoning" })).toBeInTheDocument();
    // Output content visible by default
    expect(screen.getByText("Agent output")).toBeInTheDocument();
  });

  it("does not render tabs when trace_id is absent", () => {
    render(<AgentResponseCard response="Agent output" reasoning="Steps" />);

    expect(screen.queryByRole("tab", { name: "Output" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Reasoning" })).not.toBeInTheDocument();
    // Legacy reasoning toggle still works
    fireEvent.click(screen.getByRole("button", { name: "Show reasoning" }));
    expect(screen.getByText("Steps")).toBeInTheDocument();
  });

  it("switches to Reasoning tab on click and loads ReasoningTracePanel", async () => {
    const fetchTrace = vi.fn().mockResolvedValue(STUB_TRACE);

    render(
      <AgentResponseCard
        trace_id="trace-1"
        response="Agent output"
        // Pass fetchTrace down through ReasoningTracePanel via a wrapper
        // by rendering the panel directly to test the fetch path
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Reasoning" }));

    // Output content hidden after switching
    expect(screen.queryByText("Agent output")).not.toBeInTheDocument();
    // Loading state shown while fetching
    expect(screen.getByText(/Loading reasoning trace/i)).toBeInTheDocument();
  });

  it("HallucinationBadge click activates Reasoning tab", () => {
    render(
      <AgentResponseCard
        trace_id="trace-1"
        response="Agent output"
        hallucination_check={true}
        grounding_score={0.9}
      />
    );

    // Initially on Output tab
    expect(screen.getByText("Agent output")).toBeInTheDocument();

    // Click the badge — should switch to Reasoning tab
    fireEvent.click(screen.getByRole("button", { name: /Hallucination check/i }));

    expect(screen.queryByText("Agent output")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reasoning" })).toHaveAttribute("aria-selected", "true");
  });
});

// ---------------------------------------------------------------------------
// ReasoningTracePanel — fetch and render
// ---------------------------------------------------------------------------

describe("ReasoningTracePanel", () => {
  it("renders all 5 sections from a pre-loaded trace", () => {
    render(<ReasoningTracePanel trace={STUB_TRACE} />);

    expect(screen.getByText("Inputs")).toBeInTheDocument();
    expect(screen.getByText("Transformations")).toBeInTheDocument();
    expect(screen.getByText("Assumptions")).toBeInTheDocument();
    expect(screen.getByText("Confidence Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Evidence Links")).toBeInTheDocument();
  });

  it("renders confidence bars with correct labels", () => {
    render(<ReasoningTracePanel trace={STUB_TRACE} />);

    expect(screen.getByText("Logic Consistency")).toBeInTheDocument();
    expect(screen.getByText("Data Quality")).toBeInTheDocument();
    // High confidence label
    expect(screen.getByText(/90%.*High/i)).toBeInTheDocument();
    // Moderate confidence label
    expect(screen.getByText(/60%.*Moderate/i)).toBeInTheDocument();
  });

  it("renders assumption and transformation content", () => {
    render(<ReasoningTracePanel trace={STUB_TRACE} />);

    expect(screen.getByText("Step A")).toBeInTheDocument();
    expect(screen.getByText("Step B")).toBeInTheDocument();
    expect(screen.getByText("Market is stable")).toBeInTheDocument();
  });

  it("renders evidence link", () => {
    render(<ReasoningTracePanel trace={STUB_TRACE} />);

    const link = screen.getByRole("link", { name: "https://example.com/evidence" });
    expect(link).toHaveAttribute("href", "https://example.com/evidence");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("fetches trace by trace_id using fetchTrace prop and renders sections", async () => {
    const fetchTrace = vi.fn().mockResolvedValue(STUB_TRACE);

    render(<ReasoningTracePanel trace_id="trace-1" fetchTrace={fetchTrace} />);

    expect(screen.getByText(/Loading reasoning trace/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Inputs")).toBeInTheDocument();
    });

    expect(fetchTrace).toHaveBeenCalledWith("trace-1", expect.any(AbortSignal));
    expect(screen.getByText("Market is stable")).toBeInTheDocument();
  });

  it("shows error state when fetchTrace rejects", async () => {
    const fetchTrace = vi.fn().mockRejectedValue(new Error("HTTP 404"));

    render(<ReasoningTracePanel trace_id="trace-1" fetchTrace={fetchTrace} />);

    await waitFor(() => {
      expect(screen.getByText("HTTP 404")).toBeInTheDocument();
    });
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<ReasoningTracePanel trace={STUB_TRACE} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /Close reasoning panel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
