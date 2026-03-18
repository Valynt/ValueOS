/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { ExecutiveOutputStudio } from "../../views/ExecutiveOutputStudio";

// Mock hooks
vi.mock("@/hooks/useExecutiveOutput", () => ({
  useArtifacts: () => ({
    data: [
      { id: "art-1", type: "executive-memo", status: "ready", title: "Q1 Assessment", content: "<p>ROI: <strong data-claim-id=\"c1\">150%</strong></p>", claimIds: ["c1"], generatedAt: "2024-01-15", readinessAtGeneration: 0.85 },
    ],
    isLoading: false,
  }),
  useArtifact: () => ({
    data: { id: "art-1", type: "executive-memo", status: "ready", title: "Q1 Assessment", content: "<p>ROI: 150%</p>", claimIds: ["c1"], generatedAt: "2024-01-15", readinessAtGeneration: 0.85 },
  }),
  useEditArtifact: () => ({ mutate: vi.fn() }),
  useGenerateArtifacts: () => ({ mutate: vi.fn() }),
  useProvenance: () => ({
    data: { claimId: "c1", claimValue: "150%", nodes: [{ id: "n1", type: "source", label: "CRM", value: "Salesforce" }] },
  }),
}));

vi.mock("@/hooks/useIntegrity", () => ({
  useReadiness: () => ({
    data: { compositeScore: 0.85, status: "presentation-ready", blockers: [], components: {}, confidenceDistribution: { high: 5, medium: 3, low: 2 } },
  }),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ caseId: "case-123" }),
}));

describe("ExecutiveOutputStudio", () => {
  it("renders artifact tabs", () => {
    render(<ExecutiveOutputStudio />);

    expect(screen.getByText("Executive Memo")).toBeInTheDocument();
    expect(screen.getByText("CFO Recommendation")).toBeInTheDocument();
    expect(screen.getByText("Customer Narrative")).toBeInTheDocument();
    expect(screen.getByText("Internal Case")).toBeInTheDocument();
  });

  it("displays artifact content", () => {
    render(<ExecutiveOutputStudio />);

    expect(screen.getByText("Q1 Assessment")).toBeInTheDocument();
    expect(screen.getByText("150%")).toBeInTheDocument();
  });

  it("has data-claim-id attributes on financial figures", () => {
    render(<ExecutiveOutputStudio />);

    const claimElement = screen.getByText("150%").closest("[data-claim-id]");
    expect(claimElement).toHaveAttribute("data-claim-id", "c1");
  });

  it("shows inline editor on section click", () => {
    render(<ExecutiveOutputStudio />);

    fireEvent.click(screen.getByText("150%"));
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("shows generate button when no artifacts", () => {
    // Mock with empty artifacts
    vi.mocked(require("@/hooks/useExecutiveOutput").useArtifacts).mockReturnValue({ data: [], isLoading: false });
    render(<ExecutiveOutputStudio />);
    expect(screen.getByText("Generate Artifacts")).toBeInTheDocument();
  });
});
