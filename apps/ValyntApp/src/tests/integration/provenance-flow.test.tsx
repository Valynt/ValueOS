/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { ProvenanceNode, ProvenancePanel } from "@valueos/components/components/ProvenancePanel";
import { ArtifactPreview } from "../../components/canvas/widgets/ArtifactPreview";

describe("Integration: Provenance Panel Flow", () => {
  const mockArtifact = {
    id: "art-1",
    type: "executive-memo" as const,
    status: "ready" as const,
    title: "Q1 Assessment",
    content: '<p>ROI: <strong data-claim-id="claim-1">150%</strong></p>',
    claimIds: ["claim-1"],
    generatedAt: "2024-01-15",
    readinessAtGeneration: 0.85,
  };

  const mockNodes: ProvenanceNode[] = [
    { id: "n1", type: "source", label: "CRM", value: "Salesforce", sourceBadge: "CRM-derived", timestamp: "2024-01-01" },
    { id: "n2", type: "formula", label: "ROI Calculation", value: "(Gain-Cost)/Cost" },
    { id: "n3", type: "agent", label: "FinancialAgent", value: "v2.1" },
    { id: "n4", type: "confidence", label: "Confidence", value: "0.85", confidence: 0.85 },
  ];

  it("opens provenance panel when clicking financial figure", () => {
    const onShowProvenance = vi.fn();

    render(
      <ArtifactPreview
        id="artifact-preview"
        data={{ artifact: mockArtifact }}
        onAction={onShowProvenance}
      />
    );

    // 150% is inside dangerouslySetInnerHTML, let's find by role or testid if possible, or just the parent
    const claimEl = document.querySelector('[data-claim-id="claim-1"]');
    if (claimEl) {
      fireEvent.click(claimEl);
    }
    expect(onShowProvenance).toHaveBeenCalledWith("showProvenance", { claimId: "claim-1" });
  });

  it("displays provenance chain in panel", () => {
    render(
      <ProvenancePanel
        isOpen={true}
        onClose={vi.fn()}
        claimValue="150%"
        nodes={mockNodes}
      />
    );

    expect(screen.getByText("Data Lineage")).toBeInTheDocument();
    // 150% is part of the mock nodes
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
    expect(screen.getByText("ROI Calculation")).toBeInTheDocument();
    expect(screen.getByText("FinancialAgent")).toBeInTheDocument();
  });

  it("closes panel on escape key", () => {
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

  it("closes panel on click outside", () => {
    const onClose = vi.fn();
    render(
      <>
        <div data-testid="outside">Outside</div>
        <ProvenancePanel
          isOpen={true}
          onClose={onClose}
          nodes={mockNodes}
        />
      </>
    );

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(onClose).toHaveBeenCalled();
  });
});
