/**
 * TDD tests for ModeSelector — Phase 2 Mode System
 *
 * Tests the horizontal tab bar for workspace mode switching.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { WarmthState, WorkspaceMode } from "@shared/domain/Warmth";

// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { ModeSelector } from "./ModeSelector";

const ALL_MODES: WorkspaceMode[] = ["canvas", "narrative", "copilot", "evidence"];

describe("ModeSelector", () => {
  it("renders four mode tabs: Canvas, Narrative, Copilot, Evidence", () => {
    render(
      <ModeSelector
        activeMode="canvas"
        onModeChange={vi.fn()}
        availableModes={ALL_MODES}
        warmthState={"firm" as WarmthState}
      />,
    );

    expect(screen.getByText(/canvas/i)).toBeInTheDocument();
    expect(screen.getByText(/narrative/i)).toBeInTheDocument();
    expect(screen.getByText(/copilot/i)).toBeInTheDocument();
    expect(screen.getByText(/evidence/i)).toBeInTheDocument();
  });

  it("highlights the active mode tab", () => {
    render(
      <ModeSelector
        activeMode="narrative"
        onModeChange={vi.fn()}
        availableModes={ALL_MODES}
        warmthState={"firm" as WarmthState}
      />,
    );

    const narrativeTab = screen.getByRole("tab", { name: /narrative/i });
    expect(narrativeTab).toHaveAttribute("aria-selected", "true");
  });

  it("calls onModeChange when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();

    render(
      <ModeSelector
        activeMode="canvas"
        onModeChange={onModeChange}
        availableModes={ALL_MODES}
        warmthState={"firm" as WarmthState}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /copilot/i }));
    expect(onModeChange).toHaveBeenCalledWith("copilot");
  });

  it("disables unavailable modes", () => {
    render(
      <ModeSelector
        activeMode="canvas"
        onModeChange={vi.fn()}
        availableModes={["canvas", "narrative"]}
        warmthState={"firm" as WarmthState}
      />,
    );

    const copilotTab = screen.getByRole("tab", { name: /copilot/i });
    expect(copilotTab).toBeDisabled();

    const evidenceTab = screen.getByRole("tab", { name: /evidence/i });
    expect(evidenceTab).toBeDisabled();
  });

  it("applies warmth-appropriate styling: amber for forming", () => {
    const { container } = render(
      <ModeSelector
        activeMode="canvas"
        onModeChange={vi.fn()}
        availableModes={ALL_MODES}
        warmthState={"forming" as WarmthState}
      />,
    );

    const activeIndicator = container.querySelector("[class*='amber']");
    expect(activeIndicator).toBeTruthy();
  });

  it("applies warmth-appropriate styling: blue for firm", () => {
    const { container } = render(
      <ModeSelector
        activeMode="canvas"
        onModeChange={vi.fn()}
        availableModes={ALL_MODES}
        warmthState={"firm" as WarmthState}
      />,
    );

    const activeIndicator = container.querySelector("[class*='blue']");
    expect(activeIndicator).toBeTruthy();
  });

  it("has correct ARIA: role=tablist on container, role=tab on items", () => {
    render(
      <ModeSelector
        activeMode="canvas"
        onModeChange={vi.fn()}
        availableModes={ALL_MODES}
        warmthState={"firm" as WarmthState}
      />,
    );

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("supports keyboard navigation between tabs", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();

    render(
      <ModeSelector
        activeMode="canvas"
        onModeChange={onModeChange}
        availableModes={ALL_MODES}
        warmthState={"firm" as WarmthState}
      />,
    );

    const canvasTab = screen.getByRole("tab", { name: /canvas/i });
    canvasTab.focus();

    await user.keyboard("{ArrowRight}");
    expect(onModeChange).toHaveBeenCalledWith("narrative");
  });
});
