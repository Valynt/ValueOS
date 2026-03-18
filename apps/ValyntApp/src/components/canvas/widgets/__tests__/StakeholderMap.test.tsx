/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { StakeholderMap } from "../StakeholderMap";

describe("StakeholderMap", () => {
  const mockStakeholders = [
    { id: "1", name: "John Doe", role: "Decision Maker", priority: "high" as const, source: "CRM-derived" as const },
    { id: "2", name: "Jane Smith", role: "Champion", priority: "medium" as const, source: "call-derived" as const },
    { id: "3", name: "Bob Wilson", role: "Influencer", priority: "low" as const, source: "inferred" as const },
  ];

  it("renders all stakeholders", () => {
    render(<StakeholderMap id="stakeholder-map" data={{ stakeholders: mockStakeholders }} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
  });

  it("displays stakeholder roles", () => {
    render(<StakeholderMap id="stakeholder-map" data={{ stakeholders: mockStakeholders }} />);

    expect(screen.getByText("Decision Maker")).toBeInTheDocument();
    expect(screen.getByText("Champion")).toBeInTheDocument();
  });

  it("shows priority badges correctly", () => {
    render(<StakeholderMap id="stakeholder-map" data={{ stakeholders: mockStakeholders }} />);

    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
    expect(screen.getByText("low")).toBeInTheDocument();
  });

  it("emits action when stakeholder is clicked", () => {
    const onAction = vi.fn();
    render(
      <StakeholderMap
        id="stakeholder-map"
        data={{ stakeholders: mockStakeholders }}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByText("John Doe"));
    expect(onAction).toHaveBeenCalledWith("select", { stakeholderId: "1" });
  });

  it("renders empty state when no stakeholders", () => {
    render(<StakeholderMap id="stakeholder-map" data={{ stakeholders: [] }} />);

    expect(screen.getByText("No stakeholders identified yet")).toBeInTheDocument();
  });
});
