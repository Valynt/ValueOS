/**
 * @jest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@testing-library/react";

import { ProvenanceNode, ProvenancePanel } from "../ProvenancePanel";

describe("ProvenancePanel", () => {
  const mockNodes: ProvenanceNode[] = [
    {
      id: "node-1",
      type: "source",
      label: "CRM Data",
      value: "Salesforce",
      sourceBadge: "CRM-derived",
      timestamp: "2024-01-15T10:00:00Z",
    },
    {
      id: "node-2",
      type: "formula",
      label: "Calculation",
      value: "ROI = (Gain - Cost) / Cost",
    },
    {
      id: "node-3",
      type: "agent",
      label: "FinancialModelingAgent",
      value: "v2.1.0",
    },
    {
      id: "node-4",
      type: "confidence",
      label: "Confidence Score",
      value: "0.85",
      confidence: 0.85,
    },
  ];

  it("renders nodes when open", () => {
    render(
      <ProvenancePanel
        isOpen={true}
        onClose={vi.fn()}
        claimValue={150000}
        nodes={mockNodes}
      />
    );

    expect(screen.getByText("Data Lineage")).toBeInTheDocument();
    expect(screen.getByText("150,000")).toBeInTheDocument();
    expect(screen.getByText("CRM Data")).toBeInTheDocument();
    expect(screen.getByText("FinancialModelingAgent")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <ProvenancePanel
        isOpen={false}
        onClose={vi.fn()}
        nodes={mockNodes}
      />
    );

    expect(screen.queryByText("Data Lineage")).not.toBeInTheDocument();
  });

  it("calls onClose when clicking close button", () => {
    const onClose = vi.fn();
    render(
      <ProvenancePanel
        isOpen={true}
        onClose={onClose}
        nodes={mockNodes}
      />
    );

    const closeButton = screen.getByLabelText("Close panel");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when pressing Escape", () => {
    const onClose = vi.fn();
    render(
      <ProvenancePanel
        isOpen={true}
        onClose={onClose}
        nodes={mockNodes}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows loading state", () => {
    render(
      <ProvenancePanel
        isOpen={true}
        onClose={vi.fn()}
        loading={true}
      />
    );

    expect(document.querySelector('[data-testid="loading-state"]')).toBeInTheDocument();
  });

  it("shows error state", () => {
    const errorMessage = "Failed to load provenance";
    render(
      <ProvenancePanel
        isOpen={true}
        onClose={vi.fn()}
        error={errorMessage}
        nodes={[]}
      />
    );

    // Component renders a hardcoded heading and the error prop value in separate <p> elements
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getAllByText(errorMessage).length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no nodes", () => {
    render(
      <ProvenancePanel
        isOpen={true}
        onClose={vi.fn()}
        nodes={[]}
      />
    );

    expect(screen.getByText("No provenance data available")).toBeInTheDocument();
  });

  it("renders source badge for source nodes", () => {
    render(
      <ProvenancePanel
        isOpen={true}
        onClose={vi.fn()}
        nodes={[mockNodes[0]]}
      />
    );

    expect(screen.getByText("CRM Derived")).toBeInTheDocument();
  });

  it("renders confidence badge for confidence nodes", () => {
    render(
      <ProvenancePanel
        isOpen={true}
        onClose={vi.fn()}
        nodes={[mockNodes[3]]}
      />
    );

    expect(screen.getByText("85%")).toBeInTheDocument();
  });
});
