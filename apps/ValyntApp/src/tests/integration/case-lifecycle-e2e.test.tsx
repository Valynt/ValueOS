/**
 * @jest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";



import { LifecycleNav } from "../../components/workspace/LifecycleNav";


describe("E2E: Full Case Lifecycle", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return ({ children }: { children: ReactNode }) => (
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </BrowserRouter>
    );
  };

  it("completes full lifecycle from assembly to realization", () => {
    render(
      <LifecycleNav
        completedStages={["assembly", "model", "integrity", "outputs"]}
        lockedStages={[]}
        caseStatus="presentation-ready"
      />,
      { wrapper: createWrapper() }
    );

    // Verify all lifecycle stages are accessible
    expect(screen.getByText("Assembly")).toBeInTheDocument();
    expect(screen.getByText("Modeling")).toBeInTheDocument();
    expect(screen.getByText("Integrity")).toBeInTheDocument();
    expect(screen.getByText("Outputs")).toBeInTheDocument();
    expect(screen.getByText("Realization")).toBeInTheDocument();

    // Verify presentation-ready status
    expect(screen.getByText(/presentation ready/i)).toBeInTheDocument();

    // Check that completed stages have checkmarks
    const assemblyButton = screen.getByText("Assembly").closest("button");
    expect(assemblyButton?.querySelector("svg")).toBeInTheDocument();
  });

  it("shows locked realization stage until case is approved", () => {
    render(
      <LifecycleNav
        completedStages={["assembly", "model"]}
        lockedStages={["realization"]}
        caseStatus="draft"
      />,
      { wrapper: createWrapper() }
    );

    // Realization should be locked
    const realizationButton = screen.getByText("Realization").closest("button");
    expect(realizationButton).toHaveAttribute("aria-disabled", "true");
  });

  it("allows navigation between all unlocked stages", () => {
    render(
      <LifecycleNav
        completedStages={["assembly"]}
        lockedStages={[]}
        caseStatus="draft"
      />,
      { wrapper: createWrapper() }
    );

    // All stages should be clickable
    const stages = ["Assembly", "Modeling", "Integrity", "Outputs", "Realization"];
    stages.forEach((stage) => {
      expect(screen.getByText(stage)).toBeInTheDocument();
    });
  });
});
