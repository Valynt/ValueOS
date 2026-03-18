/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { PlanComparison } from "../PlanComparison";

describe("PlanComparison", () => {
  const mockPlans = [
    { id: "starter", name: "Starter", description: "For small teams", price: 99, interval: "month" as const, features: ["1,000 AI tokens", "10,000 API calls", "5 seats"], limits: { aiTokens: 1000, apiCalls: 10000, seats: 5 }, isCurrent: false },
    { id: "pro", name: "Professional", description: "For growing teams", price: 299, interval: "month" as const, features: ["10,000 AI tokens", "100,000 API calls", "20 seats", "Priority support"], limits: { aiTokens: 10000, apiCalls: 100000, seats: 20 }, isCurrent: true },
    { id: "enterprise", name: "Enterprise", description: "For large organizations", price: 999, interval: "month" as const, features: ["Unlimited AI tokens", "Unlimited API calls", "Unlimited seats", "Dedicated support", "Custom integrations"], limits: { aiTokens: 100000, apiCalls: 1000000, seats: 100 }, isCurrent: false },
  ];

  it("renders all plan cards", () => {
    render(<PlanComparison id="plan-comparison" data={{ plans: mockPlans }} />);

    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Professional")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
  });

  it("displays pricing for each plan", () => {
    render(<PlanComparison id="plan-comparison" data={{ plans: mockPlans }} />);

    expect(screen.getByText("$99")).toBeInTheDocument();
    expect(screen.getByText("$299")).toBeInTheDocument();
    expect(screen.getByText("$999")).toBeInTheDocument();
    expect(screen.getAllByText("/month").length).toBe(3);
  });

  it("marks current plan with indicator", () => {
    render(<PlanComparison id="plan-comparison" data={{ plans: mockPlans }} />);

    expect(screen.getByText("Current Plan")).toBeInTheDocument();
  });

  it("lists features for each plan", () => {
    render(<PlanComparison id="plan-comparison" data={{ plans: mockPlans }} />);

    expect(screen.getByText("1,000 AI tokens")).toBeInTheDocument();
    expect(screen.getByText("Priority support")).toBeInTheDocument();
    expect(screen.getByText("Custom integrations")).toBeInTheDocument();
  });

  it("emits upgrade action when upgrade CTA clicked", () => {
    const onAction = vi.fn();
    render(
      <PlanComparison
        id="plan-comparison"
        data={{ plans: mockPlans }}
        onAction={onAction}
      />
    );

    const upgradeButtons = screen.getAllByText("Upgrade");
    fireEvent.click(upgradeButtons[0]);

    expect(onAction).toHaveBeenCalledWith("upgrade", { planId: "enterprise" });
  });

  it("disables upgrade button for current plan", () => {
    render(<PlanComparison id="plan-comparison" data={{ plans: mockPlans }} />);

    const currentPlanButton = screen.getByText("Current Plan");
    expect(currentPlanButton).toBeDisabled();
  });
});
