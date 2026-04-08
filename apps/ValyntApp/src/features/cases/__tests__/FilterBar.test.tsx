/**
 * TDD: Phase 3 — FilterBar component
 *
 * Warmth filter tabs + search for the case listing page.
 * RED phase: fails until src/features/cases/components/FilterBar.tsx is implemented.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "@/features/cases/components/FilterBar";

describe("FilterBar", () => {
  const defaultProps = {
    warmthFilter: "all" as const,
    searchQuery: "",
    onWarmthChange: vi.fn(),
    onSearchChange: vi.fn(),
    counts: { forming: 3, firm: 2, verified: 1 },
  };

  // ---------------------------------------------------------------------------
  // Tab rendering
  // ---------------------------------------------------------------------------
  describe("warmth tabs", () => {
    it("renders All, Forming, Firm, Verified tab buttons", () => {
      render(<FilterBar {...defaultProps} />);
      expect(screen.getByRole("button", { name: /all/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /forming/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /firm/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /verified/i })).toBeInTheDocument();
    });

    it("shows count badges on warmth tabs", () => {
      render(<FilterBar {...defaultProps} />);
      // "Forming (3)" or equivalent
      expect(screen.getByText(/3/)).toBeInTheDocument();
      expect(screen.getByText(/2/)).toBeInTheDocument();
      expect(screen.getByText(/1/)).toBeInTheDocument();
    });

    it("highlights active warmth filter tab", () => {
      render(<FilterBar {...defaultProps} warmthFilter="forming" />);
      const formingTab = screen.getByRole("button", { name: /forming/i });
      // Active tab should have aria-pressed or a distinct visual class
      expect(
        formingTab.getAttribute("aria-pressed") === "true" ||
          formingTab.className.includes("active") ||
          formingTab.getAttribute("data-active") === "true",
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Tab interaction
  // ---------------------------------------------------------------------------
  describe("tab interaction", () => {
    it("calls onWarmthChange when clicking a warmth tab", async () => {
      const onWarmthChange = vi.fn();
      render(<FilterBar {...defaultProps} onWarmthChange={onWarmthChange} />);

      const formingTab = screen.getByRole("button", { name: /forming/i });
      await userEvent.click(formingTab);

      expect(onWarmthChange).toHaveBeenCalledWith("forming");
    });

    it("calls onWarmthChange('all') when clicking All tab", async () => {
      const onWarmthChange = vi.fn();
      render(<FilterBar {...defaultProps} warmthFilter="forming" onWarmthChange={onWarmthChange} />);

      const allTab = screen.getByRole("button", { name: /all/i });
      await userEvent.click(allTab);

      expect(onWarmthChange).toHaveBeenCalledWith("all");
    });
  });

  // ---------------------------------------------------------------------------
  // Search input
  // ---------------------------------------------------------------------------
  describe("search", () => {
    it("renders search input", () => {
      render(<FilterBar {...defaultProps} />);
      expect(
        screen.getByRole("searchbox") ?? screen.getByPlaceholderText(/search/i),
      ).toBeInTheDocument();
    });

    it("calls onSearchChange on input", async () => {
      const onSearchChange = vi.fn();
      render(<FilterBar {...defaultProps} onSearchChange={onSearchChange} />);

      const input =
        screen.getByRole("searchbox") ?? screen.getByPlaceholderText(/search/i);
      await userEvent.type(input, "acme");

      expect(onSearchChange).toHaveBeenCalled();
    });
  });
});
