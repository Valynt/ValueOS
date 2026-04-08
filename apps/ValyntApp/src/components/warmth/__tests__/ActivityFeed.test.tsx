/**
 * TDD: Phase 3 — ActivityFeed component
 *
 * Warmth-sorted case feed for the dashboard, replacing NeedsInputQueue + RecentActivity.
 * RED phase: fails until src/components/warmth/ActivityFeed.tsx is implemented.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ActivityFeed } from "@/components/warmth/ActivityFeed";
import { MOCK_CASES, NEEDS_INPUT_CASE } from "@/test/fixtures/phase3";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("ActivityFeed", () => {
  // ---------------------------------------------------------------------------
  // Row rendering
  // ---------------------------------------------------------------------------
  describe("row content", () => {
    it("renders a row for each case", () => {
      renderWithRouter(<ActivityFeed cases={MOCK_CASES} isLoading={false} />);
      for (const c of MOCK_CASES) {
        const name = c.company_profiles?.company_name ?? c.name;
        expect(screen.getByText(name)).toBeInTheDocument();
      }
    });

    it("renders a WarmthBadge per row", () => {
      const { container } = renderWithRouter(
        <ActivityFeed cases={MOCK_CASES} isLoading={false} />,
      );
      const badges = container.querySelectorAll('[role="status"]');
      expect(badges.length).toBe(MOCK_CASES.length);
    });

    it("shows next action text per row", () => {
      renderWithRouter(<ActivityFeed cases={MOCK_CASES} isLoading={false} />);
      expect(screen.getByText(/mapping value/i)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------------
  describe("sort order", () => {
    it("places needs-input cases first", () => {
      renderWithRouter(<ActivityFeed cases={MOCK_CASES} isLoading={false} />);
      const rows = screen.getAllByRole("link");
      // First row should be the needs-input case
      expect(rows[0]!.getAttribute("href")).toContain(NEEDS_INPUT_CASE.id);
    });

    it("orders forming before firm before verified after needs-input", () => {
      const { container } = renderWithRouter(
        <ActivityFeed cases={MOCK_CASES} isLoading={false} />,
      );
      const rows = container.querySelectorAll("[data-case-id]");
      if (rows.length >= 3) {
        // After needs-input, next rows should be forming
        const secondRowId = rows[1]?.getAttribute("data-case-id");
        expect(secondRowId).toMatch(/forming/);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  describe("navigation", () => {
    it("rows link to /case/:caseId", () => {
      renderWithRouter(<ActivityFeed cases={MOCK_CASES} isLoading={false} />);
      const links = screen.getAllByRole("link");
      for (const link of links) {
        expect(link.getAttribute("href")).toMatch(/\/case\//);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // maxItems prop
  // ---------------------------------------------------------------------------
  describe("maxItems", () => {
    it("limits displayed rows to maxItems", () => {
      renderWithRouter(
        <ActivityFeed cases={MOCK_CASES} isLoading={false} maxItems={3} />,
      );
      const links = screen.getAllByRole("link");
      expect(links.length).toBeLessThanOrEqual(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  describe("loading state", () => {
    it("renders skeleton rows when loading", () => {
      const { container } = renderWithRouter(
        <ActivityFeed cases={[]} isLoading={true} />,
      );
      const skeletons = container.querySelectorAll("[data-skeleton], .animate-pulse");
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  describe("empty state", () => {
    it("renders empty message when no cases", () => {
      renderWithRouter(<ActivityFeed cases={[]} isLoading={false} />);
      expect(screen.getByText(/no.*case|no.*activity/i)).toBeInTheDocument();
    });
  });
});
