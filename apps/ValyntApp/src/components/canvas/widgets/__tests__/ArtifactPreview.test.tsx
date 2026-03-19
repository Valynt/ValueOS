/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { ArtifactPreview } from "../ArtifactPreview";

describe("ArtifactPreview", () => {
  const mockArtifact = {
    id: "art-1",
    type: "executive-memo" as const,
    status: "ready" as const,
    title: "Q1 Value Assessment",
    content: "<p>The projected ROI is <strong data-claim-id=\"claim-1\">150%</strong> with an NPV of <strong data-claim-id=\"claim-2\">$750,000</strong>.</p>",
    claimIds: ["claim-1", "claim-2"],
    generatedAt: "2024-01-15T10:00:00Z",
    readinessAtGeneration: 0.85,
  };

  it("renders artifact content", () => {
    render(<ArtifactPreview id="artifact-preview" data={{ artifact: mockArtifact }} />);

    expect(screen.getByText("Q1 Value Assessment")).toBeInTheDocument();
    // Content is HTML and gets rendered with proper encoding
    expect(screen.getByText(/150%/)).toBeInTheDocument();
    expect(screen.getByText(/\$750,000/)).toBeInTheDocument();
  });

  it("includes data-claim-id attributes on financial figures", () => {
    render(<ArtifactPreview id="artifact-preview" data={{ artifact: mockArtifact }} />);

    // Use regex matcher since content may be HTML-encoded
    const claimElement = screen.getByText(/150%/).closest("[data-claim-id]");
    expect(claimElement).toHaveAttribute("data-claim-id", "claim-1");
  });

  it("emits provenance action when financial figure is clicked", () => {
    const onAction = vi.fn();
    render(
      <ArtifactPreview
        id="artifact-preview"
        data={{ artifact: mockArtifact }}
        onAction={onAction}
      />
    );

    // Use regex matcher since content may be HTML-encoded
    fireEvent.click(screen.getByText(/150%/));
    expect(onAction).toHaveBeenCalledWith("showProvenance", { claimId: "claim-1" });
  });

  it("shows DRAFT watermark when readiness < 0.8", () => {
    const draftArtifact = { ...mockArtifact, readinessAtGeneration: 0.75 };
    render(<ArtifactPreview id="artifact-preview" data={{ artifact: draftArtifact }} />);

    expect(screen.getByText("DRAFT")).toBeInTheDocument();
  });

  it("does not show DRAFT watermark when readiness >= 0.8", () => {
    render(<ArtifactPreview id="artifact-preview" data={{ artifact: mockArtifact }} />);

    expect(screen.queryByText("DRAFT")).not.toBeInTheDocument();
  });
});
