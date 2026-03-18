/**
 * @jest-environment jsdom
 */


import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LifecycleNav } from "../../components/workspace/LifecycleNav";

describe("Integration: Lifecycle Navigation", () => {
  it("navigates through all lifecycle stages", () => {
    render(
      <BrowserRouter>
        <LifecycleNav completedStages={["assembly"]} lockedStages={[]} />
      </BrowserRouter>
    );

    // Click through each stage
    fireEvent.click(screen.getByText("Assembly"));
    fireEvent.click(screen.getByText("Modeling"));
    fireEvent.click(screen.getByText("Integrity"));
    fireEvent.click(screen.getByText("Outputs"));
    fireEvent.click(screen.getByText("Realization"));

    // All stages should be present
    expect(screen.getByText("Assembly")).toBeInTheDocument();
    expect(screen.getByText("Modeling")).toBeInTheDocument();
    expect(screen.getByText("Integrity")).toBeInTheDocument();
    expect(screen.getByText("Outputs")).toBeInTheDocument();
    expect(screen.getByText("Realization")).toBeInTheDocument();
  });

  it("shows completed checkmark for finished stages", () => {
    render(
      <BrowserRouter>
        <LifecycleNav completedStages={["assembly", "model"]} lockedStages={[]} />
      </BrowserRouter>
    );

    // Assembly should have checkmark (done but not active)
    const assemblyButton = screen.getByText("Assembly").closest("button");
    expect(assemblyButton?.querySelector("svg")).toBeInTheDocument();
  });

  it("prevents navigation to locked stages", () => {
    render(
      <BrowserRouter>
        <LifecycleNav completedStages={["assembly"]} lockedStages={["realization"]} />
      </BrowserRouter>
    );

    const realizationButton = screen.getByText("Realization").closest("button");
    expect(realizationButton).toHaveAttribute("aria-disabled", "true");
  });
});
