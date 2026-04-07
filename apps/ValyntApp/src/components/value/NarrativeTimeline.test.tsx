/**
 * TDD tests for NarrativeTimeline — Phase 2 Narrative Mode
 *
 * Tests the horizontal version timeline component.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { NarrativeTimeline } from "./NarrativeTimeline";

function buildVersions() {
  return [
    { id: "v1", label: "Baseline established", timestamp: "2026-03-01T10:00:00Z", isCurrent: false },
    { id: "v2", label: "Growth forecast added", timestamp: "2026-03-15T14:00:00Z", isCurrent: false },
    { id: "v3", label: "Refined with evidence", timestamp: "2026-04-01T09:00:00Z", isCurrent: true },
  ];
}

describe("NarrativeTimeline", () => {
  it("renders version points along horizontal timeline", () => {
    render(<NarrativeTimeline versions={buildVersions()} onVersionSelect={vi.fn()} />);

    expect(screen.getByText("Baseline established")).toBeInTheDocument();
    expect(screen.getByText("Growth forecast added")).toBeInTheDocument();
    expect(screen.getByText("Refined with evidence")).toBeInTheDocument();
  });

  it("highlights the current version", () => {
    render(<NarrativeTimeline versions={buildVersions()} onVersionSelect={vi.fn()} />);

    const current = screen.getByText("Refined with evidence");
    // Current version should have distinctive styling (bold, highlighted, active)
    expect(current.closest("[aria-current]") ?? current.closest("[data-current]")).toBeTruthy();
  });

  it("calls onVersionSelect when a point is clicked", async () => {
    const user = userEvent.setup();
    const onVersionSelect = vi.fn();

    render(<NarrativeTimeline versions={buildVersions()} onVersionSelect={onVersionSelect} />);

    await user.click(screen.getByText("Baseline established"));
    expect(onVersionSelect).toHaveBeenCalledWith("v1");
  });

  it("renders appropriately for single-version narratives", () => {
    const singleVersion = [
      { id: "v1", label: "Initial draft", timestamp: "2026-04-01T09:00:00Z", isCurrent: true },
    ];

    render(<NarrativeTimeline versions={singleVersion} onVersionSelect={vi.fn()} />);

    expect(screen.getByText("Initial draft")).toBeInTheDocument();
  });
});
