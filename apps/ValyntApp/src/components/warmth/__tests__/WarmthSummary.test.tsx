/**
 * TDD: Phase 3 — WarmthSummary component
 *
 * Dashboard stat cards showing case counts and total value per warmth tier.
 * RED phase: fails until src/components/warmth/WarmthSummary.tsx is implemented.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { WarmthSummary } from "@/components/warmth/WarmthSummary";
import { MOCK_CASES } from "@/test/fixtures/phase3";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("WarmthSummary", () => {
  // ---------------------------------------------------------------------------
  // Renders 3 warmth stat cards
  // ---------------------------------------------------------------------------
  describe("stat cards", () => {
    it("renders three warmth state cards", () => {
      renderWithRouter(<WarmthSummary cases={MOCK_CASES} isLoading={false} />);
      expect(screen.getByText(/forming/i)).toBeInTheDocument();
      expect(screen.getByText(/firm/i)).toBeInTheDocument();
      expect(screen.getByText(/verified/i)).toBeInTheDocument();
    });

    it("shows correct case count for forming tier", () => {
      const { container } = renderWithRouter(<WarmthSummary cases={MOCK_CASES} isLoading={false} />);
      const formingCard = container.querySelector('[data-warmth="forming"]');
      expect(formingCard).toBeInTheDocument();
      expect(formingCard!.textContent).toContain("2");
    });

    it("shows correct case count for firm tier", () => {
      const { container } = renderWithRouter(<WarmthSummary cases={MOCK_CASES} isLoading={false} />);
      const firmCard = container.querySelector('[data-warmth="firm"]');
      expect(firmCard).toBeInTheDocument();
      expect(firmCard!.textContent).toContain("2");
    });

    it("shows correct case count for verified tier", () => {
      const { container } = renderWithRouter(<WarmthSummary cases={MOCK_CASES} isLoading={false} />);
      const verifiedCard = container.querySelector('[data-warmth="verified"]');
      expect(verifiedCard).toBeInTheDocument();
      expect(verifiedCard!.textContent).toContain("2");
    });
  });

  // ---------------------------------------------------------------------------
  // Cards link to filtered case list
  // ---------------------------------------------------------------------------
  describe("navigation links", () => {
    it("forming card links to /work/cases?warmth=forming", () => {
      renderWithRouter(<WarmthSummary cases={MOCK_CASES} isLoading={false} />);
      const links = screen.getAllByRole("link");
      const formingLink = links.find((l) => l.getAttribute("href")?.includes("warmth=forming"));
      expect(formingLink).toBeDefined();
    });

    it("firm card links to /work/cases?warmth=firm", () => {
      renderWithRouter(<WarmthSummary cases={MOCK_CASES} isLoading={false} />);
      const links = screen.getAllByRole("link");
      const firmLink = links.find((l) => l.getAttribute("href")?.includes("warmth=firm"));
      expect(firmLink).toBeDefined();
    });

    it("verified card links to /work/cases?warmth=verified", () => {
      renderWithRouter(<WarmthSummary cases={MOCK_CASES} isLoading={false} />);
      const links = screen.getAllByRole("link");
      const verifiedLink = links.find((l) => l.getAttribute("href")?.includes("warmth=verified"));
      expect(verifiedLink).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  describe("loading state", () => {
    it("renders skeleton placeholders when loading", () => {
      const { container } = renderWithRouter(
        <WarmthSummary cases={[]} isLoading={true} />,
      );
      // Should render shimmer/skeleton elements
      const skeletons = container.querySelectorAll("[data-skeleton], .animate-pulse");
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });

    it("does not render case counts when loading", () => {
      renderWithRouter(<WarmthSummary cases={[]} isLoading={true} />);
      // Should not show any warmth state labels when loading
      expect(screen.queryByText(/forming/i)).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  describe("empty state", () => {
    it("renders empty state prompt when no cases", () => {
      renderWithRouter(<WarmthSummary cases={[]} isLoading={false} />);
      // Should show a prompt to create first case
      expect(
        screen.getByText(/start|first|no.*case/i),
      ).toBeInTheDocument();
    });
  });
});
