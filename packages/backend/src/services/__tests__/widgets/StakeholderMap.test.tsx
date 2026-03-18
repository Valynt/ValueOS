/**
 * StakeholderMap Widget Unit Tests
 *
 * Tests for grid showing stakeholders with role, priority, source badge.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StakeholderMap } from "../../../sdui/src/components/widgets/StakeholderMap";

describe("StakeholderMap", () => {
  const mockStakeholders = [
    {
      id: "s1",
      name: "John Smith",
      role: "economic_buyer",
      priority: 9,
      sourceType: "customer-confirmed",
      email: "john@example.com",
      jobTitle: "VP Operations",
    },
    {
      id: "s2",
      name: "Jane Doe",
      role: "technical_evaluator",
      priority: 7,
      sourceType: "crm-derived",
      email: "jane@example.com",
      jobTitle: "CTO",
    },
    {
      id: "s3",
      name: "Bob Wilson",
      role: "champion",
      priority: 8,
      sourceType: "call-derived",
      email: "bob@example.com",
      jobTitle: "Director",
    },
  ];

  it("should render all stakeholders", () => {
    render(<StakeholderMap stakeholders={mockStakeholders} />);

    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
  });

  it("should display role badges correctly", () => {
    render(<StakeholderMap stakeholders={mockStakeholders} />);

    expect(screen.getByText("Economic Buyer")).toBeInTheDocument();
    expect(screen.getByText("Technical Evaluator")).toBeInTheDocument();
    expect(screen.getByText("Champion")).toBeInTheDocument();
  });

  it("should display priority indicators", () => {
    render(<StakeholderMap stakeholders={mockStakeholders} />);

    // Priority 9 should be highest
    const priority9 = screen.getByText("9");
    expect(priority9).toBeInTheDocument();
  });

  it("should render source badges", () => {
    render(<StakeholderMap stakeholders={mockStakeholders} />);

    // Source badges should be present
    expect(screen.getByLabelText(/customer-confirmed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/crm-derived/i)).toBeInTheDocument();
  });

  it("should show contact details on expand", () => {
    render(<StakeholderMap stakeholders={mockStakeholders} />);

    const expandButton = screen.getAllByLabelText(/expand stakeholder/i)[0];
    fireEvent.click(expandButton);

    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("VP Operations")).toBeInTheDocument();
  });

  it("should sort by priority descending by default", () => {
    render(<StakeholderMap stakeholders={mockStakeholders} />);

    const names = screen.getAllByTestId("stakeholder-name");
    expect(names[0].textContent).toBe("John Smith"); // Priority 9
    expect(names[1].textContent).toBe("Bob Wilson"); // Priority 8
    expect(names[2].textContent).toBe("Jane Doe"); // Priority 7
  });

  it("should handle empty stakeholders array", () => {
    render(<StakeholderMap stakeholders={[]} />);

    expect(screen.getByText(/no stakeholders found/i)).toBeInTheDocument();
  });

  it("should call onSelect when stakeholder is clicked", () => {
    const onSelect = vi.fn();
    render(<StakeholderMap stakeholders={mockStakeholders} onSelect={onSelect} />);

    const stakeholderCard = screen.getAllByTestId("stakeholder-card")[0];
    fireEvent.click(stakeholderCard);

    expect(onSelect).toHaveBeenCalledWith(mockStakeholders[0]);
  });
});
