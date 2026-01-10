/**
 * Trinity Dashboard Unit Tests
 * Tests Truth Engine integration, verification states, and ROI calculations
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrinityDashboard } from "../TrinityDashboard";
import type {
  TrinityFinancials,
  TrinityVerification,
  TrinityOutcome,
} from "../TrinityDashboard";

describe("TrinityDashboard", () => {
  const mockFinancials: TrinityFinancials = {
    totalValue: 2500000,
    revenueImpact: 1200000,
    costSavings: 800000,
    riskReduction: 500000,
    roi: 280,
    npv: 2100000,
    paybackPeriod: "7 months",
  };

  const mockVerification: TrinityVerification = {
    overall: { passed: true, confidence: 87 },
    revenue: {
      passed: true,
      confidence: 92,
      citations: ["CRM-12345", "SFDC-OP-876"],
    },
    cost: { passed: true, confidence: 85, citations: ["DB-99999"] },
    risk: { passed: true, confidence: 82, citations: ["API-54321"] },
  };

  const mockOutcomes: TrinityOutcome[] = [
    {
      id: "1",
      name: "New customer acquisition",
      category: "revenue",
      impact: 600000,
    },
    { id: "2", name: "Market expansion", category: "revenue", impact: 600000 },
    { id: "3", name: "Process automation", category: "cost", impact: 500000 },
    { id: "4", name: "Cloud optimization", category: "cost", impact: 300000 },
    {
      id: "5",
      name: "Compliance automation",
      category: "risk",
      impact: 300000,
    },
    { id: "6", name: "Security enhancement", category: "risk", impact: 200000 },
  ];

  describe("Total Value Header", () => {
    it("renders total value with verification", () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
        />
      );

      expect(screen.getByText("Total Value")).toBeInTheDocument();
      expect(screen.getByText("$2.5M")).toBeInTheDocument();
    });

    it("displays financial metrics when provided", () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
        />
      );

      expect(screen.getByText("280%")).toBeInTheDocument(); // ROI
      expect(screen.getByText("$2.1M")).toBeInTheDocument(); // NPV
      expect(screen.getByText("7 months")).toBeInTheDocument(); // Payback
    });

    it("works without optional metrics", () => {
      const minimalFinancials: TrinityFinancials = {
        totalValue: 1000000,
        revenueImpact: 600000,
        costSavings: 300000,
        riskReduction: 100000,
      };

      render(
        <TrinityDashboard
          financials={minimalFinancials}
          verification={mockVerification}
        />
      );

      expect(screen.getByText("$1.0M")).toBeInTheDocument();
    });
  });

  describe("Three Pillars", () => {
    it("renders all three pillars with correct labels", () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
        />
      );

      expect(screen.getByText("Revenue Impact")).toBeInTheDocument();
      expect(screen.getByText("Cost Savings")).toBeInTheDocument();
      expect(screen.getByText("Risk Reduction")).toBeInTheDocument();
    });

    it("displays pillar values correctly", () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
        />
      );

      expect(screen.getByText("$1.2M")).toBeInTheDocument(); // Revenue
      expect(screen.getByText("$800K")).toBeInTheDocument(); // Cost
      expect(screen.getByText("$500K")).toBeInTheDocument(); // Risk
    });

    it("shows percentage of total for each pillar", () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
        />
      );

      expect(screen.getByText("48% of total")).toBeInTheDocument(); // 1.2M / 2.5M
      expect(screen.getByText("32% of total")).toBeInTheDocument(); // 800K / 2.5M
      expect(screen.getByText("20% of total")).toBeInTheDocument(); // 500K / 2.5M
    });
  });

  describe("Truth Engine Verification", () => {
    it("displays verification status for each pillar", () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
        />
      );

      // Should show verification badges
      const verifiedText = screen.getAllByText(/verified/i);
      expect(verifiedText.length).toBeGreaterThan(0);
    });

    it("shows unverified state for failed verification", () => {
      const failedVerification: TrinityVerification = {
        overall: { passed: false, confidence: 65 },
        revenue: { passed: true, confidence: 92, citations: ["CRM-12345"] },
        cost: { passed: true, confidence: 85, citations: ["DB-99999"] },
        risk: { passed: false, confidence: 55, citations: [] },
      };

      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={failedVerification}
        />
      );

      expect(screen.getByText(/pending review/i)).toBeInTheDocument();
    });

    it("displays confidence scores", () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
        />
      );

      expect(screen.getByText(/87% confidence/i)).toBeInTheDocument(); // Overall
    });

    it("shows citation sources", () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
          outcomes={mockOutcomes}
        />
      );

      // Should display citations in the pillars
      const sources = screen.getAllByText(/sources/i);
      expect(sources.length).toBeGreaterThan(0);
      expect(sources[0]).toBeInTheDocument();
    });
  });

  describe("Outcome Breakdown", () => {
    it("displays outcomes when showBreakdown is true", () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
          outcomes={mockOutcomes}
          showBreakdown={true}
        />
      );

      expect(screen.getByText("New customer acquisition")).toBeInTheDocument();
      expect(screen.getByText("Process automation")).toBeInTheDocument();
    });

    it("hides outcomes when showBreakdown is false", () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
          outcomes={mockOutcomes}
          showBreakdown={false}
        />
      );

      expect(
        screen.queryByText("New customer acquisition")
      ).not.toBeInTheDocument();
    });

    it('shows "No outcomes defined" when empty', () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
          outcomes={[]}
          showBreakdown={true}
        />
      );

      const noOutcomesMessages = screen.getAllByText(/no outcomes defined/i);
      expect(noOutcomesMessages.length).toBe(3); // One per pillar
    });

    it('limits display to 3 outcomes per pillar and shows "+N more"', () => {
      const manyOutcomes: TrinityOutcome[] = [
        { id: "1", name: "Revenue 1", category: "revenue", impact: 100000 },
        { id: "2", name: "Revenue 2", category: "revenue", impact: 100000 },
        { id: "3", name: "Revenue 3", category: "revenue", impact: 100000 },
        { id: "4", name: "Revenue 4", category: "revenue", impact: 100000 },
        { id: "5", name: "Revenue 5", category: "revenue", impact: 100000 },
      ];

      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
          outcomes={manyOutcomes}
          showBreakdown={true}
        />
      );

      expect(screen.getByText("+2 more")).toBeInTheDocument();
    });
  });

  describe("Dominant Pillar Highlighting", () => {
    it("highlights the pillar with highest value when enabled", () => {
      const { container } = render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
          highlightDominant={true}
        />
      );

      // Revenue (1.2M) should be highlighted with ring-2 class
      const rings = container.querySelectorAll(".ring-2");
      expect(rings.length).toBe(1);
    });

    it("does not highlight when disabled", () => {
      const { container } = render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
          highlightDominant={false}
        />
      );

      const rings = container.querySelectorAll(".ring-2");
      expect(rings.length).toBe(0);
    });
  });

  describe("Currency Formatting", () => {
    it("formats millions correctly", () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
        />
      );

      expect(screen.getByText("$2.5M")).toBeInTheDocument();
      expect(screen.getByText("$1.2M")).toBeInTheDocument();
    });

    it("formats thousands correctly", () => {
      const smallFinancials: TrinityFinancials = {
        totalValue: 750000,
        revenueImpact: 450000,
        costSavings: 200000,
        riskReduction: 100000,
      };

      render(
        <TrinityDashboard
          financials={smallFinancials}
          verification={mockVerification}
        />
      );

      expect(screen.getByText("$750K")).toBeInTheDocument();
      expect(screen.getByText("$450K")).toBeInTheDocument();
    });

    it("formats small numbers correctly", () => {
      const tinyFinancials: TrinityFinancials = {
        totalValue: 500,
        revenueImpact: 300,
        costSavings: 150,
        riskReduction: 50,
      };

      render(
        <TrinityDashboard
          financials={tinyFinancials}
          verification={mockVerification}
        />
      );

      expect(screen.getByText("$500")).toBeInTheDocument();
    });
  });

  describe("Verification Summary", () => {
    it("shows verified status when all pillars pass", () => {
      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
        />
      );

      expect(screen.getByText(/verified/i)).toBeInTheDocument();
      expect(screen.getByText(/Truth Engine/i)).toBeInTheDocument();
    });

    it("shows pending status when verification fails", () => {
      const pendingVerification: TrinityVerification = {
        overall: { passed: false, confidence: 70 },
        revenue: { passed: true, confidence: 85, citations: [] },
        cost: { passed: false, confidence: 65, citations: [] },
        risk: { passed: false, confidence: 60, citations: [] },
      };

      render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={pendingVerification}
        />
      );

      expect(screen.getByText(/pending review/i)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles zero values gracefully", () => {
      const zeroFinancials: TrinityFinancials = {
        totalValue: 0,
        revenueImpact: 0,
        costSavings: 0,
        riskReduction: 0,
      };

      render(
        <TrinityDashboard
          financials={zeroFinancials}
          verification={mockVerification}
        />
      );

      // Use getAllByText because "$0" appears for total value and each pillar
      expect(screen.getAllByText("$0").length).toBeGreaterThan(0);
    });

    it("applies custom className", () => {
      const { container } = render(
        <TrinityDashboard
          financials={mockFinancials}
          verification={mockVerification}
          className="custom-test-class"
        />
      );

      expect(container.firstChild).toHaveClass("trinity-dashboard");
      expect(container.firstChild).toHaveClass("custom-test-class");
    });

    it("works with undefined outcomes", () => {
      expect(() => {
        render(
          <TrinityDashboard
            financials={mockFinancials}
            verification={mockVerification}
          />
        );
      }).not.toThrow();
    });
  });
});
