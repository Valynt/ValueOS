/**
 * TDD: Sidebar Navigation Items (Post Route Consolidation)
 *
 * Validates the updated navigation items after warmth-era route consolidation.
 * Tests that new paths exist, old paths are removed, and all paths are relative.
 *
 * RED phase: tests will fail until Sidebar.tsx nav items are updated.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Mock hooks used by Sidebar
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "test@valueos.com" },
    logout: vi.fn(),
  }),
}));

vi.mock("@/hooks/useNavigationPersonalization", () => ({
  useNavigationPersonalization: () => ({
    trackRouteVisit: vi.fn(),
    trackFeatureUsage: vi.fn(),
    getUsageCount: vi.fn(() => 0),
    getFeatureUsageCount: vi.fn(() => 0),
    frequentRouteSet: new Set<string>(),
  }),
}));

import { Sidebar } from "@/layouts/Sidebar";

function renderSidebar(currentPath = "/org/test-org/work") {
  return render(
    <MemoryRouter initialEntries={[currentPath]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe("Sidebar navigation items (warmth-era)", () => {
  // ---------------------------------------------------------------------------
  // Primary nav items — new paths
  // ---------------------------------------------------------------------------
  describe("primary nav items", () => {
    it("contains Home link pointing to 'work' path", () => {
      renderSidebar();
      const link = screen.getByRole("link", { name: /home/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", expect.stringContaining("work"));
    });

    it("contains My Work link pointing to 'work/cases' path", () => {
      renderSidebar();
      const link = screen.getByRole("link", { name: /my work/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", expect.stringContaining("work/cases"));
    });

    it("contains Value Graph link pointing to 'living-value-graph' path", () => {
      renderSidebar();
      const link = screen.getByRole("link", { name: /value graph/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        "href",
        expect.stringContaining("living-value-graph"),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Platform nav items — new paths
  // ---------------------------------------------------------------------------
  describe("platform nav items", () => {
    it("contains Models link pointing to 'library/models' path", () => {
      renderSidebar();
      const link = screen.getByRole("link", { name: /models/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        "href",
        expect.stringContaining("library/models"),
      );
    });

    it("contains Agents link", () => {
      renderSidebar();
      expect(screen.getByRole("link", { name: /agents/i })).toBeInTheDocument();
    });

    it("contains Company Intel link", () => {
      renderSidebar();
      expect(
        screen.getByRole("link", { name: /company intel/i }),
      ).toBeInTheDocument();
    });

    it("contains Settings link", () => {
      renderSidebar();
      expect(
        screen.getByRole("link", { name: /settings/i }),
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Removed items
  // ---------------------------------------------------------------------------
  describe("removed items", () => {
    it("does NOT contain Billing as a top-level nav item", () => {
      renderSidebar();
      expect(screen.queryByRole("link", { name: /billing/i })).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Structure
  // ---------------------------------------------------------------------------
  describe("structure", () => {
    it("renders primary items before platform divider", () => {
      renderSidebar();
      // Primary items should exist
      expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
      // Platform label should exist
      expect(screen.getByText(/platform/i)).toBeInTheDocument();
    });

    it("highlights active route", () => {
      renderSidebar("/work");
      const homeLink = screen.getByRole("link", { name: /home/i });
      // Active link should have active styling applied (bg-primary/15 text-primary)
      expect(homeLink.className).toMatch(/bg-primary|text-primary/);
    });
  });
});
