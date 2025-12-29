/**
 * Unit Tests for Trinity Dashboard Template
 * Tests pillar calculations, highlighting, interactions, and edge cases
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrinityDashboard } from "../TrinityDashboard";
import type { TemplateDataSource } from "../index";

describe("TrinityDashboard", () => {
  const mockDataSource: TemplateDataSource = {
    financials: {
      totalValue: 1500000,
      revenueImpact: 800000,
      costSavings: 500000,
      riskReduction: 200000,
      roi: 250,
      npv: 1200000,
      paybackPeriod: "8 months",
    },
    outcomes: [
      {
        id: "1",
        name: "Revenue Outcome 1",
        category: "revenue",
        impact: 400000,
        description: "Increase sales",
      },
      {
        id: "2",
        name: "Revenue Outcome 2",
        category: "revenue",
        impact: 400000,
        description: "New markets",
      },
      {
        id: "3",
        name: "Cost Outcome 1",
        category: "cost",
        impact: 300000,
        description: "Reduce overhead",
      },
      {
        id: "4",
        name: "Cost Outcome 2",
        category: "cost",
        impact: 200000,
        description: "Automation",
      },
      {
        id: "5",
        name: "Risk Outcome 1",
        category: "risk",
        impact: 150000,
        description: "Compliance",
      },
      {
        id: "6",
        name: "Risk Outcome 2",
        category: "risk",
        impact: 50000,
        description: "Security",
      },
    ],
    metrics: [],
  };

  describe("Pillar Calculations", () => {
    it("should correctly calculate pillar values from data source", () => {
      render(<TrinityDashboard dataSource={mockDataSource} />);

      // Revenue pillar
      expect(screen.getByText("$800K")).toBeInTheDocument();

      // Cost pillar
      expect(screen.getByText("$500K")).toBeInTheDocument();

      // Risk pillar
      expect(screen.getByText("$200K")).toBeInTheDocument();
    });

    it("should show correct percentage of total for each pillar", () => {
      render(<TrinityDashboard dataSource={mockDataSource} />);

      // Revenue: 800k/1500k = 53%
      expect(screen.getByText("53% of total")).toBeInTheDocument();

      // Cost: 500k/1500k = 33%
      expect(screen.getByText("33% of total")).toBeInTheDocument();

      // Risk: 200k/1500k = 13%
      expect(screen.getByText("13% of total")).toBeInTheDocument();
    });

    it("should display total value correctly", () => {
      render(<TrinityDashboard dataSource={mockDataSource} />);

      expect(screen.getByText("$1.5M")).toBeInTheDocument();
    });

    it("should handle zero values gracefully", () => {
      const zeroDataSource: TemplateDataSource = {
        financials: {
          totalValue: 0,
          revenueImpact: 0,
          costSavings: 0,
          riskReduction: 0,
        },
        outcomes: [],
        metrics: [],
      };

      render(<TrinityDashboard dataSource={zeroDataSource} />);

      expect(screen.getByText("$0")).toBeInTheDocument();
      expect(screen.getByText("0% of total")).toBeInTheDocument();
    });
  });

  describe("Dominant Pillar Highlighting", () => {
    it("should highlight the pillar with highest value when highlightDominant is true", () => {
      const { container } = render(
        <TrinityDashboard
          dataSource={mockDataSource}
          highlightDominant={true}
        />
      );

      // Revenue pillar ($800K) should be highlighted
      const revenuePillar = screen
        .getByText("Revenue Impact")
        .closest(".pillar-card");
      expect(revenuePillar).toHaveClass("ring-2");
    });

    it("should not highlight any pillar when highlightDominant is false", () => {
      const { container } = render(
        <TrinityDashboard
          dataSource={mockDataSource}
          highlightDominant={false}
        />
      );

      const pillars = container.querySelectorAll(".pillar-card");
      pillars.forEach((pillar) => {
        expect(pillar).not.toHaveClass("ring-2");
      });
    });
  });

  describe("Breakdown Display", () => {
    it("should show outcome breakdown when showBreakdown is true", () => {
      render(
        <TrinityDashboard dataSource={mockDataSource} showBreakdown={true} />
      );

      expect(screen.getByText("Revenue Outcome 1")).toBeInTheDocument();
      expect(screen.getByText("Cost Outcome 1")).toBeInTheDocument();
    });

    it("should hide outcome breakdown when showBreakdown is false", () => {
      render(
        <TrinityDashboard dataSource={mockDataSource} showBreakdown={false} />
      );

      expect(screen.queryByText("Revenue Outcome 1")).not.toBeInTheDocument();
    });

    it("should limit outcomes to first 3 per pillar", () => {
      const manyOutcomes: TemplateDataSource = {
        ...mockDataSource,
        outcomes: [
          ...mockDataSource.outcomes!,
          {
            id: "7",
            name: "Revenue Outcome 3",
            category: "revenue",
            impact: 100000,
            description: "",
          },
          {
            id: "8",
            name: "Revenue Outcome 4",
            category: "revenue",
            impact: 100000,
            description: "",
          },
        ],
      };

      render(
        <TrinityDashboard dataSource={manyOutcomes} showBreakdown={true} />
      );

      expect(screen.getByText("+1 more")).toBeInTheDocument();
    });

    it('should show "No outcomes defined" when pillar has no outcomes', () => {
      const noOutcomes: TemplateDataSource = {
        financials: mockDataSource.financials,
        outcomes: [],
        metrics: [],
      };

      render(<TrinityDashboard dataSource={noOutcomes} showBreakdown={true} />);

      expect(screen.getAllByText("No outcomes defined")).toHaveLength(3);
    });
  });

  describe("Compact Mode", () => {
    it("should hide breakdown in compact mode", () => {
      render(<TrinityDashboard dataSource={mockDataSource} compact={true} />);

      expect(screen.queryByText("Revenue Outcome 1")).not.toBeInTheDocument();
    });

    it("should use appropriate grid classes in compact mode", () => {
      const { container } = render(
        <TrinityDashboard dataSource={mockDataSource} compact={true} />
      );

      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass("grid-cols-3");
    });
  });

  describe("Interactivity", () => {
    it("should call onOutcomeClick when outcome is clicked", () => {
      const handleOutcomeClick = vi.fn();

      render(
        <TrinityDashboard
          dataSource={mockDataSource}
          onOutcomeClick={handleOutcomeClick}
          interactive={true}
        />
      );

      const outcome = screen.getByText("Revenue Outcome 1");
      fireEvent.click(outcome);

      expect(handleOutcomeClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "1",
          name: "Revenue Outcome 1",
        })
      );
    });

    it("should not call onOutcomeClick when interactive is false", () => {
      const handleOutcomeClick = vi.fn();

      render(
        <TrinityDashboard
          dataSource={mockDataSource}
          onOutcomeClick={handleOutcomeClick}
          interactive={false}
        />
      );

      const outcome = screen.getByText("Revenue Outcome 1");
      fireEvent.click(outcome);

      expect(handleOutcomeClick).not.toHaveBeenCalled();
    });

    it("should not have cursor-pointer class when interactive is false", () => {
      const { container } = render(
        <TrinityDashboard dataSource={mockDataSource} interactive={false} />
      );

      const outcomes = container.querySelectorAll(".cursor-pointer");
      expect(outcomes).toHaveLength(0);
    });
  });

  describe("Financial Summary", () => {
    it("should display ROI when provided", () => {
      render(<TrinityDashboard dataSource={mockDataSource} />);

      expect(screen.getByText("ROI")).toBeInTheDocument();
      expect(screen.getByText("250%")).toBeInTheDocument();
    });

    it("should display NPV when provided", () => {
      render(<TrinityDashboard dataSource={mockDataSource} />);

      expect(screen.getByText("NPV")).toBeInTheDocument();
      expect(screen.getByText("$1.2M")).toBeInTheDocument();
    });

    it("should display payback period when provided", () => {
      render(<TrinityDashboard dataSource={mockDataSource} />);

      expect(screen.getByText("Payback")).toBeInTheDocument();
      expect(screen.getByText("8 months")).toBeInTheDocument();
    });

    it("should hide financial metrics when not provided", () => {
      const minimalData: TemplateDataSource = {
        financials: {
          totalValue: 1000000,
          revenueImpact: 600000,
          costSavings: 400000,
          riskReduction: 0,
        },
        outcomes: [],
        metrics: [],
      };

      render(<TrinityDashboard dataSource={minimalData} />);

      expect(screen.queryByText("ROI")).not.toBeInTheDocument();
      expect(screen.queryByText("NPV")).not.toBeInTheDocument();
      expect(screen.queryByText("Payback")).not.toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing outcomes array", () => {
      const noOutcomesData: TemplateDataSource = {
        financials: mockDataSource.financials,
        metrics: [],
      };

      expect(() => {
        render(<TrinityDashboard dataSource={noOutcomesData} />);
      }).not.toThrow();
    });

    it("should handle missing financials", () => {
      const noFinancialsData: TemplateDataSource = {
        outcomes: [],
        metrics: [],
      };

      expect(() => {
        render(<TrinityDashboard dataSource={noFinancialsData} />);
      }).not.toThrow();

      expect(screen.getByText("$0")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <TrinityDashboard
          dataSource={mockDataSource}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass("trinity-dashboard-template");
      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  describe("Currency Formatting", () => {
    it("should format millions correctly", () => {
      const millionsData: TemplateDataSource = {
        financials: {
          totalValue: 5500000,
          revenueImpact: 5500000,
          costSavings: 0,
          riskReduction: 0,
        },
        outcomes: [],
        metrics: [],
      };

      render(<TrinityDashboard dataSource={millionsData} />);

      expect(screen.getByText("$5.5M")).toBeInTheDocument();
    });

    it("should format thousands correctly", () => {
      const thousandsData: TemplateDataSource = {
        financials: {
          totalValue: 750000,
          revenueImpact: 750000,
          costSavings: 0,
          riskReduction: 0,
        },
        outcomes: [],
        metrics: [],
      };

      render(<TrinityDashboard dataSource={thousandsData} />);

      expect(screen.getByText("$750K")).toBeInTheDocument();
    });

    it("should format small numbers correctly", () => {
      const smallData: TemplateDataSource = {
        financials: {
          totalValue: 500,
          revenueImpact: 500,
          costSavings: 0,
          riskReduction: 0,
        },
        outcomes: [],
        metrics: [],
      };

      render(<TrinityDashboard dataSource={smallData} />);

      expect(screen.getByText("$500")).toBeInTheDocument();
    });
  });
});
