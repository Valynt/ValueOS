/**
 * LifecycleNav Unit Tests
 *
 * Tests for horizontal tab bar showing lifecycle stages with highlighting and locked states.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LifecycleNav } from "../../../apps/ValyntApp/src/components/workspace/LifecycleNav";

describe("LifecycleNav", () => {
  const stages = [
    { id: "assembly", label: "Assembly", path: "/assembly", completed: true },
    { id: "modeling", label: "Modeling", path: "/model", completed: true },
    { id: "integrity", label: "Integrity", path: "/integrity", completed: false },
    { id: "outputs", label: "Outputs", path: "/outputs", completed: false },
    { id: "realization", label: "Realization", path: "/realization", completed: false },
  ];

  it("should render all lifecycle stages", () => {
    render(<LifecycleNav stages={stages} currentStage="integrity" />);

    expect(screen.getByText("Assembly")).toBeInTheDocument();
    expect(screen.getByText("Modeling")).toBeInTheDocument();
    expect(screen.getByText("Integrity")).toBeInTheDocument();
    expect(screen.getByText("Outputs")).toBeInTheDocument();
    expect(screen.getByText("Realization")).toBeInTheDocument();
  });

  it("should highlight active stage", () => {
    render(<LifecycleNav stages={stages} currentStage="integrity" />);

    const activeTab = screen.getByRole("tab", { name: /integrity/i });
    expect(activeTab).toHaveAttribute("aria-selected", "true");
    expect(activeTab).toHaveClass("active");
  });

  it("should show checkmark for completed stages", () => {
    render(<LifecycleNav stages={stages} currentStage="integrity" />);

    const assemblyTab = screen.getByRole("tab", { name: /assembly/i });
    const modelingTab = screen.getByRole("tab", { name: /modeling/i });

    expect(assemblyTab).toContainElement(screen.getByTestId("checkmark-icon"));
    expect(modelingTab).toContainElement(screen.getByTestId("checkmark-icon"));
  });

  it("should not show checkmark for incomplete stages", () => {
    render(<LifecycleNav stages={stages} currentStage="integrity" />);

    const outputsTab = screen.getByRole("tab", { name: /outputs/i });
    expect(outputsTab).not.toContainElement(
      screen.queryByTestId("checkmark-icon")
    );
  });

  it("should lock future stages that are not reachable", () => {
    render(<LifecycleNav stages={stages} currentStage="integrity" />);

    const realizationTab = screen.getByRole("tab", { name: /realization/i });
    expect(realizationTab).toHaveAttribute("aria-disabled", "true");
    expect(realizationTab).toHaveClass("locked");
  });

  it("should allow clicking on completed stages", () => {
    const onNavigate = vi.fn();
    render(
      <LifecycleNav stages={stages} currentStage="integrity" onNavigate={onNavigate} />
    );

    const assemblyTab = screen.getByRole("tab", { name: /assembly/i });
    fireEvent.click(assemblyTab);

    expect(onNavigate).toHaveBeenCalledWith("/assembly");
  });

  it("should allow clicking on current stage", () => {
    const onNavigate = vi.fn();
    render(
      <LifecycleNav stages={stages} currentStage="integrity" onNavigate={onNavigate} />
    );

    const integrityTab = screen.getByRole("tab", { name: /integrity/i });
    fireEvent.click(integrityTab);

    expect(onNavigate).toHaveBeenCalledWith("/integrity");
  });

  it("should prevent clicking on locked stages", () => {
    const onNavigate = vi.fn();
    render(
      <LifecycleNav stages={stages} currentStage="integrity" onNavigate={onNavigate} />
    );

    const realizationTab = screen.getByRole("tab", { name: /realization/i });
    fireEvent.click(realizationTab);

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("should show lock icon for locked stages", () => {
    render(<LifecycleNav stages={stages} currentStage="integrity" />);

    const realizationTab = screen.getByRole("tab", { name: /realization/i });
    expect(realizationTab).toContainElement(screen.getByTestId("lock-icon"));
  });

  it("should update active stage when currentStage changes", () => {
    const { rerender } = render(
      <LifecycleNav stages={stages} currentStage="assembly" />
    );

    expect(screen.getByRole("tab", { name: /assembly/i })).toHaveClass("active");

    rerender(<LifecycleNav stages={stages} currentStage="outputs" />);

    expect(screen.getByRole("tab", { name: /outputs/i })).toHaveClass("active");
    expect(screen.getByRole("tab", { name: /assembly/i })).not.toHaveClass("active");
  });

  it("should allow clicking next stage if previous is completed", () => {
    const onNavigate = vi.fn();
    render(
      <LifecycleNav stages={stages} currentStage="modeling" onNavigate={onNavigate} />
    );

    // Integrity should be reachable since modeling is the current stage
    const integrityTab = screen.getByRole("tab", { name: /integrity/i });
    fireEvent.click(integrityTab);

    expect(onNavigate).toHaveBeenCalledWith("/integrity");
  });

  it("should support keyboard navigation", () => {
    render(<LifecycleNav stages={stages} currentStage="assembly" />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveFocus();

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveFocus();

    fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });
    expect(tabs[0]).toHaveFocus();
  });

  it("should have correct tab list structure", () => {
    render(<LifecycleNav stages={stages} currentStage="integrity" />);

    const tabList = screen.getByRole("tablist");
    expect(tabList).toHaveAttribute("aria-label", "Case lifecycle stages");

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
  });

  it("should indicate progress through stages", () => {
    render(<LifecycleNav stages={stages} currentStage="modeling" />);

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "40"); // 2 of 5 stages complete
    expect(progress).toHaveAttribute("aria-valuemax", "5");
  });
});
