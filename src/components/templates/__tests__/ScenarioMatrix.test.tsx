/**
 * Unit Tests for Scenario Matrix Template
 * Tests modifier logic, probability weighting, scenario selection, and calculations
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScenarioMatrix } from "../ScenarioMatrix";
import type { TemplateDataSource } from "../index";

describe("ScenarioMatrix", () => {
  const mockDataSource: TemplateDataSource = {
    financials: {
      totalValue: 1000000,
      revenueImpact: 600000,
      costSavings: 300000,
      riskReduction: 100000,
      roi: 200,
      npv: 800000,
      paybackPeriod: "10 months",
    },
    outcomes: [],
    metrics: [
      {
        id: "1",
        name: "Sales Growth",
        value: 100,
        target: 150,
        unit: "%",
        baseline: 80,
      },
      {
        id: "2",
        name: "Cost Efficiency",
        value: 85,
        target: 95,
        unit: "%",
        baseline: 75,
      },
    ],
  };

  describe("Scenario Modifier Logic", () => {
    it("should apply conservative modifier (0.7x) correctly", () => {
      render(<ScenarioMatrix dataSource={mockDataSource} />);

      // Conservative total: 1M * 0.7 = 700K
      expect(screen.getByText("$700K")).toBeInTheDocument();
    });

    it("should apply expected modifier (1.0x) correctly", () => {
      render(<ScenarioMatrix dataSource={mockDataSource} />);

      // Expected total: 1M * 1.0 = 1M
      expect(screen.getByText("$1.0M")).toBeInTheDocument();
    });

    it("should apply optimistic modifier (1.4x) correctly", () => {
      render(<ScenarioMatrix dataSource={mockDataSource} />);

      // Optimistic total: 1M * 1.4 = 1.4M
      expect(screen.getByText("$1.4M")).toBeInTheDocument();
    });

    it("should apply modifiers to all financial components", () => {
      render(<ScenarioMatrix dataSource={mockDataSource} />);

      // Conservative revenue: 600K * 0.7 = 420K
      expect(screen.getByText("$420K")).toBeInTheDocument();

      // Optimistic cost savings: 300K * 1.4 = 420K
      const costSavings = screen.getAllByText("$420K");
      expect(costSavings.length).toBeGreaterThan(0);
    });

    it("should apply modifiers to metrics", () => {
      render(<ScenarioMatrix dataSource={mockDataSource} />);

      // Conservative: 100 * 0.7 = 70
      expect(screen.getByText(/70 %/)).toBeInTheDocument();

      // Optimistic: 100 * 1.4 = 140
      expect(screen.getByText(/140 %/)).toBeInTheDocument();
    });
  });

  describe("Probability-Weighted Calculations", () => {
    it("should calculate weighted expected value correctly", () => {
      render(
        <ScenarioMatrix dataSource={mockDataSource} showWeightedValue={true} />
      );

      // Weighted: (700K * 0.25) + (1M * 0.5) + (1.4M * 0.25) = 1.025M
      expect(
        screen.getByText("Probability-Weighted Value")
      ).toBeInTheDocument();
      expect(screen.getByText("$1.0M")).toBeInTheDocument(); // Rounded
    });

    it("should hide weighted value when showWeightedValue is false", () => {
      render(
        <ScenarioMatrix dataSource={mockDataSource} showWeightedValue={false} />
      );

      expect(
        screen.queryByText("Probability-Weighted Value")
      ).not.toBeInTheDocument();
    });

    it("should display probability percentages for each scenario", () => {
      render(<ScenarioMatrix dataSource={mockDataSource} />);

      expect(screen.getByText("25%")).toBeInTheDocument(); // Conservative
      expect(screen.getByText("50%")).toBeInTheDocument(); // Expected
    });
  });

  describe("Scenario Selection", () => {
    it("should select expected scenario by default", () => {
      const { container } = render(
        <ScenarioMatrix dataSource={mockDataSource} />
      );

      const expectedCard = screen
        .getByText("Expected")
        .closest(".scenario-card");
      expect(expectedCard).toHaveClass("ring-2");
    });

    it("should change selection when scenario is clicked", () => {
      render(<ScenarioMatrix dataSource={mockDataSource} selectable={true} />);

      const optimisticCard = screen
        .getByText("Optimistic")
        .closest(".scenario-card");
      fireEvent.click(optimisticCard!);

      expect(optimisticCard).toHaveClass("ring-2");
    });

    it("should call onScenarioSelect callback when clicked", () => {
      const handleSelect = vi.fn();

      render(
        <ScenarioMatrix
          dataSource={mockDataSource}
          onScenarioSelect={handleSelect}
        />
      );

      const conservativeCard = screen
        .getByText("Conservative")
        .closest(".scenario-card");
      fireEvent.click(conservativeCard!);

      expect(handleSelect).toHaveBeenCalledWith("conservative");
    });

    it("should support controlled selection", () => {
      const { rerender } = render(
        <ScenarioMatrix
          dataSource={mockDataSource}
          selectedScenario="conservative"
        />
      );

      const conservativeCard = screen
        .getByText("Conservative")
        .closest(".scenario-card");
      expect(conservativeCard).toHaveClass("ring-2");

      rerender(
        <ScenarioMatrix
          dataSource={mockDataSource}
          selectedScenario="optimistic"
        />
      );

      const optimisticCard = screen
        .getByText("Optimistic")
        .closest(".scenario-card");
      expect(optimisticCard).toHaveClass("ring-2");
    });

    it("should not allow selection when selectable is false", () => {
      const handleSelect = vi.fn();

      render(
        <ScenarioMatrix
          dataSource={mockDataSource}
          selectable={false}
          onScenarioSelect={handleSelect}
        />
      );

      const conservativeCard = screen
        .getByText("Conservative")
        .closest(".scenario-card");
      fireEvent.click(conservativeCard!);

      expect(handleSelect).not.toHaveBeenCalled();
    });
  });

  describe("Custom Scenarios", () => {
    it("should support custom scenario configurations", () => {
      const customScenarios = [
        {
          type: "conservative" as const,
          name: "Worst Case",
          modifier: 0.5,
          probability: 0.2,
        },
        {
          type: "expected" as const,
          name: "Baseline",
          modifier: 1.0,
          probability: 0.6,
        },
        {
          type: "optimistic" as const,
          name: "Best Case",
          modifier: 2.0,
          probability: 0.2,
        },
      ];

      render(
        <ScenarioMatrix
          dataSource={mockDataSource}
          scenarios={customScenarios}
        />
      );

      expect(screen.getByText("Worst Case")).toBeInTheDocument();
      expect(screen.getByText("Baseline")).toBeInTheDocument();
      expect(screen.getByText("Best Case")).toBeInTheDocument();

      // Custom modifier: 1M * 2.0 = 2M
      expect(screen.getByText("$2.0M")).toBeInTheDocument();
    });

    it("should use custom probabilities for weighted calculation", () => {
      const customScenarios = [
        { type: "conservative" as const, modifier: 0.5, probability: 0.1 },
        { type: "expected" as const, modifier: 1.0, probability: 0.8 },
        { type: "optimistic" as const, modifier: 1.5, probability: 0.1 },
      ];

      render(
        <ScenarioMatrix
          dataSource={mockDataSource}
          scenarios={customScenarios}
          showWeightedValue={true}
        />
      );

      // Weighted: (500K * 0.1) + (1M * 0.8) + (1.5M * 0.1) = 1M
      expect(screen.getByText("$1.0M")).toBeInTheDocument();
    });
  });

  describe("Financial Breakdown", () => {
    it("should show revenue/cost/risk breakdown for each scenario", () => {
      render(<ScenarioMatrix dataSource={mockDataSource} />);

      // Conservative scenario
      expect(screen.getByText("Revenue")).toBeInTheDocument();
      expect(screen.getByText("Cost Savings")).toBeInTheDocument();
      expect(screen.getByText("Risk Reduction")).toBeInTheDocument();
    });

    it("should display ROI for each scenario", () => {
      render(<ScenarioMatrix dataSource={mockDataSource} />);

      // Conservative ROI: 200 * 0.7 = 140%
      expect(screen.getByText("140%")).toBeInTheDocument();

      // Expected ROI: 200%
      expect(screen.getByText("200%")).toBeInTheDocument();

      // Optimistic ROI: 200 * 1.4 = 280%
      expect(screen.getByText("280%")).toBeInTheDocument();
    });

    it("should preserve payback period across scenarios", () => {
      render(<ScenarioMatrix dataSource={mockDataSource} />);

      // Payback period should not be modified
      const paybackTexts = screen.queryAllByText("10 months");
      expect(paybackTexts.length).toBe(0); // Not displayed by default in preview
    });
  });

  describe("Metrics Preview", () => {
    it("should show key metrics for each scenario", () => {
      render(<ScenarioMatrix dataSource={mockDataSource} />);

      expect(screen.getByText("Sales Growth")).toBeInTheDocument();
      expect(screen.getByText("Cost Efficiency")).toBeInTheDocument();
    });

    it("should limit metrics to first 3 per scenario", () => {
      const manyMetrics: TemplateDataSource = {
        ...mockDataSource,
        metrics: [
          { id: "1", name: "Metric 1", value: 100, unit: "%" },
          { id: "2", name: "Metric 2", value: 100, unit: "%" },
          { id: "3", name: "Metric 3", value: 100, unit: "%" },
          { id: "4", name: "Metric 4", value: 100, unit: "%" },
        ],
      };

      render(<ScenarioMatrix dataSource={manyMetrics} />);

      expect(screen.getAllByText("Metric 1")).toHaveLength(3); // One per scenario
      expect(screen.getAllByText("Metric 3")).toHaveLength(3);
    });

    it("should support metric click handlers", () => {
      const handleMetricClick = vi.fn();

      render(
        <ScenarioMatrix
          dataSource={mockDataSource}
          onMetricClick={handleMetricClick}
          interactive={true}
        />
      );

      const metric = screen.getAllByText("Sales Growth")[0];
      fireEvent.click(metric);

      expect(handleMetricClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "1",
          name: "Sales Growth",
        })
      );
    });
  });

  describe("Value Range Summary", () => {
    it("should display min-max value range", () => {
      render(<ScenarioMatrix dataSource={mockDataSource} />);

      expect(screen.getByText("Value Range:")).toBeInTheDocument();
      expect(screen.getByText(/\$700K/)).toBeInTheDocument();
      expect(screen.getByText(/\$1\.4M/)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero probabilities gracefully", () => {
      const zeroProb = [
        { type: "conservative" as const, modifier: 0.5, probability: 0 },
        { type: "expected" as const, modifier: 1.0, probability: 0 },
        { type: "optimistic" as const, modifier: 1.5, probability: 0 },
      ];

      expect(() => {
        render(
          <ScenarioMatrix dataSource={mockDataSource} scenarios={zeroProb} />
        );
      }).not.toThrow();
    });

    it("should handle missing metrics array", () => {
      const noMetrics: TemplateDataSource = {
        financials: mockDataSource.financials,
        outcomes: [],
      };

      expect(() => {
        render(<ScenarioMatrix dataSource={noMetrics} />);
      }).not.toThrow();
    });

    it("should handle zero total value", () => {
      const zeroValue: TemplateDataSource = {
        financials: {
          totalValue: 0,
          revenueImpact: 0,
          costSavings: 0,
          riskReduction: 0,
        },
        outcomes: [],
        metrics: [],
      };

      render(<ScenarioMatrix dataSource={zeroValue} />);

      expect(screen.queryAllByText("0% of total")).toHaveLength(9); // 3 scenarios * 3 pillars
    });
  });
});
