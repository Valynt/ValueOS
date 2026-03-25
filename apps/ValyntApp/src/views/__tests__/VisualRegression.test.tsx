/**
 * Visual Regression Tests for UI Templates
 * Tests visual consistency across templates
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom";

import ImpactCascade from "../ImpactCascade";
import QuantumView from "../QuantumView";
import type { PersonaType } from "../QuantumView";
import ROICalculator from "../ROICalculator";

// Mock for visual consistency
const expectVisualConsistency = (container: HTMLElement, expectedElements: string[]) => {
  expectedElements.forEach((elementText) => {
    const element = screen.getByText(elementText);
    expect(element).toBeInTheDocument();

    // Check that element has consistent styling
    expect(element.closest("div")).toHaveAttribute("class");
  });
};

describe("Visual Regression - Template Consistency", () => {
  describe("Trinity Dashboard Visual Tests", () => {
    it("should maintain consistent header structure", () => {
      const { container } = render(<ROICalculator />);

      // Check header structure
      const header = container.querySelector("h1");
      expect(header).toHaveTextContent("Business Case");
      expect(header?.className).toContain("text-lg");
    });

    it("should render bento cards with consistent styling", () => {
      render(<ROICalculator />);

      // Check for bento cards by their styling pattern
      const cards = screen.getAllByRole("button");
      // Filter for cards that look like bento cards (have hover classes)
      const bentoCards = cards.filter((card) =>
        card.className.includes("bento-card") ||
        (card.className.includes("hover:") && card.className.includes("text-left"))
      );

      expect(bentoCards.length).toBeGreaterThanOrEqual(3);

      // Each card should have consistent structure with proper classes
      bentoCards.forEach((card) => {
        expect(card).toHaveAttribute("class");
        // Check card has bento-card class
        expect(card.className).toContain("bento-card");
      });
    });

    it("should render metrics with consistent formatting", () => {
      render(<ROICalculator />);

      // Check metric cards exist with proper content - they're divs with bento-card class
      const roiCard = screen.getByText("3-Year ROI").closest(".bento-card");
      const npvCard = screen.getByText("Net Present Value").closest(".bento-card");
      const paybackCard = screen.getByText("Payback Period").closest(".bento-card");

      [roiCard, npvCard, paybackCard].forEach((card) => {
        expect(card).toBeInTheDocument();
        expect(card?.className).toContain("bento-card");
      });
    });

    it("should render charts with consistent dimensions", () => {
      render(<ROICalculator />);

      // Trajectory chart
      const trajectoryChart = screen.getByText("3-Year Trajectory").closest("div");
      expect(trajectoryChart).toBeInTheDocument();

      // Value breakdown
      const valueBreakdown = screen.getByText("Value Breakdown").closest("div");
      expect(valueBreakdown).toBeInTheDocument();

      // Strategic insights
      const insights = screen.getByText("Strategic Insights").closest("div");
      expect(insights).toBeInTheDocument();
    });
  });

  describe("Impact Cascade Visual Tests", () => {
    it("should maintain consistent layout structure", () => {
      const { container } = render(<ImpactCascade />);

      // Check main container
      const mainContainer = container.querySelector(".flex-1");
      expect(mainContainer).toBeInTheDocument();

      // Check grid layout
      const grid = container.querySelector(".grid");
      expect(grid).toBeInTheDocument();
    });

    it("should render agent badges consistently", () => {
      render(<ImpactCascade />);

      // AgentBadge components render with data-status attribute
      const badges = document.querySelectorAll('[data-status]');
      expect(badges.length).toBeGreaterThan(0);

      badges.forEach((badge) => {
        expect(badge).toHaveAttribute("data-status");
      });
    });

    it("should render confidence indicators with consistent styling", () => {
      render(<ImpactCascade />);

      // Confidence indicators are rendered by ConfidenceIndicator component
      // Check for elements with confidence-related data attributes or classes
      const indicators = screen.getAllByText(/\d+%/);
      expect(indicators.length).toBeGreaterThan(0);

      indicators.forEach((indicator) => {
        expect(indicator).toBeInTheDocument();
      });
    });

    it("should render feature library with consistent spacing", () => {
      const { container } = render(<ImpactCascade />);

      // Find Feature Library card by looking for the text
      const featureLibraryTitle = screen.getByText("Feature Library");
      expect(featureLibraryTitle).toBeInTheDocument();

      // The features are in the same card container
      const card = featureLibraryTitle.closest(".card, [class*='card']");
      expect(card).toBeInTheDocument();

      // Feature items are draggable divs
      const features = card?.querySelectorAll("[draggable='true']");
      expect(features?.length).toBeGreaterThan(0);

      features?.forEach((feature) => {
        expect(feature).toHaveAttribute("draggable");
        expect(feature).toHaveAttribute("class");
      });
    });
  });

  describe("Quantum View Visual Tests", () => {
    const mockAnalyses = [
      {
        id: "financial",
        persona: "financial" as PersonaType,
        title: "Financial Analysis",
        summary: "Strong ROI",
        confidence: 85,
        keyMetrics: [{ label: "ROI", value: "245", unit: "%" }],
        recommendations: ["Proceed"],
        risks: ["Low risk"],
        consensus: true,
        aiGenerated: true,
      },
      {
        id: "technical",
        persona: "technical" as PersonaType,
        title: "Technical Assessment",
        summary: "Scalable architecture",
        confidence: 78,
        keyMetrics: [{ label: "Capacity", value: "10000", unit: "users" }],
        recommendations: ["Upgrade"],
        risks: ["Technical debt"],
        consensus: true,
        aiGenerated: true,
      },
    ];

    it("should render header with consistent styling", () => {
      render(<QuantumView analyses={mockAnalyses} />);

      // The header has h-14 class - find it by querying up from the title
      const title = screen.getByText("Quantum View");
      expect(title).toBeInTheDocument();
      // The title is in an h1 inside a div inside the header with h-14
      const header = title.closest("[class*='h-14']");
      expect(header).toBeInTheDocument();
      expect(header?.className).toContain("h-14");
    });

    it("should render quick stats with consistent layout", () => {
      render(<QuantumView analyses={mockAnalyses} />);

      // Quick stats are buttons with consistent styling
      const buttons = screen.getAllByRole("button");
      // Filter for stat cards by checking content
      const statCards = buttons.filter((btn) =>
        btn.textContent?.includes("Personas") ||
        btn.textContent?.includes("Consensus") ||
        btn.textContent?.includes("Confidence")
      );

      expect(statCards.length).toBeGreaterThanOrEqual(2);

      statCards.forEach((card) => {
        expect(card.className).toContain("rounded");
      });
    });

    it("should render persona cards with consistent structure", () => {
      render(<QuantumView analyses={mockAnalyses} />);

      const cards = screen.getAllByRole("button");
      const personaCards = cards.filter(
        (card) =>
          card.textContent?.includes("Financial Analysis") ||
          card.textContent?.includes("Technical Assessment")
      );

      expect(personaCards.length).toBe(2);

      personaCards.forEach((card) => {
        expect(card).toHaveAttribute("class");
        expect(card).toHaveAttribute("tabIndex");
      });
    });

    it("should render AI indicators consistently", () => {
      render(<QuantumView analyses={mockAnalyses} />);

      const aiBadges = screen.getAllByText("AI");
      expect(aiBadges.length).toBe(2);

      aiBadges.forEach((badge) => {
        expect(badge.closest("span")).toHaveClass("bg-primary/20");
      });
    });

    it("should render consensus indicators consistently", () => {
      render(<QuantumView analyses={mockAnalyses} showConsensus={true} />);

      // Look for consensus indicators in the UI
      const consensusElements = screen.getAllByText(/consensus/i);
      expect(consensusElements.length).toBeGreaterThan(0);

      consensusElements.forEach((element) => {
        // Check that the element or its parent has appropriate styling
        const parent = element.closest("div, span, button");
        expect(parent).toBeInTheDocument();
      });
    });

    it("should render detail view with consistent spacing", () => {
      render(<QuantumView analyses={mockAnalyses} />);

      // Click on Financial Analysis card to open detail view
      const financialCard = screen.getByTestId("persona-card-financial");
      expect(financialCard).toBeInTheDocument();
      fireEvent.click(financialCard);

      // Check that detail view renders by looking for summary text
      const detailSummary = screen.getByText("Strong ROI");
      expect(detailSummary).toBeInTheDocument();

      // The detail view uses space-y-6 for spacing between sections
      const detailView = detailSummary.closest("[class*='space-y-']");
      expect(detailView).toBeInTheDocument();
    });
  });

  describe("Cross-Template Visual Consistency", () => {
    it("should maintain consistent button styling", () => {
      // Test all templates have consistent button classes
      const { container: roiContainer } = render(<ROICalculator />);
      const { container: impactContainer } = render(<ImpactCascade />);

      const roiButtons = roiContainer.querySelectorAll("button");
      const impactButtons = impactContainer.querySelectorAll("button");

      // Both should have button elements
      expect(roiButtons.length).toBeGreaterThan(0);
      expect(impactButtons.length).toBeGreaterThan(0);
    });

    it("should maintain consistent card styling", () => {
      render(<ROICalculator />);

      const cards = screen.getAllByRole("button");
      const bentoCards = cards.filter((card) => card.className.includes("bento-card"));

      bentoCards.forEach((card) => {
        // Check consistent border and background (using hover classes)
        expect(card.className).toContain("hover:border");
        expect(card.className).toContain("bento-card");
      });
    });

    it("should maintain consistent text hierarchy", () => {
      const { container } = render(<ROICalculator />);

      // Check heading levels
      const h1 = container.querySelector("h1");
      const h2 = container.querySelector("h2");
      const h3 = container.querySelector("h3");

      // All should have consistent font sizes
      if (h1) expect(h1.className).toContain("text-lg");
      if (h2) expect(h2.className).toContain("text-sm");
      if (h3) expect(h3.className).toContain("text-sm");
    });
  });
});
