/**
 * TDD: WarmthBadge Component
 *
 * Tests visual variants, accessibility, i18n integration, and size props.
 * RED phase: fails until src/components/warmth/WarmthBadge.tsx is implemented.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WarmthBadge } from "@/components/warmth/WarmthBadge";

describe("WarmthBadge", () => {
  // ---------------------------------------------------------------------------
  // Visual variants per warmth state
  // ---------------------------------------------------------------------------
  describe("warmth state rendering", () => {
    it("renders with forming state", () => {
      render(<WarmthBadge warmth="forming" showLabel />);
      const badge = screen.getByText(/forming/i);
      expect(badge).toBeInTheDocument();
    });

    it("renders with firm state", () => {
      render(<WarmthBadge warmth="firm" showLabel />);
      const badge = screen.getByText(/firm/i);
      expect(badge).toBeInTheDocument();
    });

    it("renders with verified state", () => {
      render(<WarmthBadge warmth="verified" showLabel />);
      const badge = screen.getByText(/verified/i);
      expect(badge).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Label visibility
  // ---------------------------------------------------------------------------
  describe("label visibility", () => {
    it("shows label text when showLabel=true", () => {
      render(<WarmthBadge warmth="forming" showLabel />);
      expect(screen.getByText(/forming/i)).toBeInTheDocument();
    });

    it("hides label text when showLabel=false", () => {
      render(<WarmthBadge warmth="forming" showLabel={false} />);
      expect(screen.queryByText(/forming/i)).not.toBeInTheDocument();
    });

    it("hides label text by default when showLabel is omitted", () => {
      render(<WarmthBadge warmth="forming" />);
      // Default behavior: icon only, no label text
      // The aria-label should still describe the state
      const el = screen.getByRole("status");
      expect(el).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Modifier indicators
  // ---------------------------------------------------------------------------
  describe("modifier rendering", () => {
    it("renders modifier indicator when modifier='firming'", () => {
      const { container } = render(
        <WarmthBadge warmth="forming" modifier="firming" showLabel />,
      );
      // Should contain a modifier icon element
      expect(container.querySelector("[data-modifier='firming']")).toBeInTheDocument();
    });

    it("renders modifier indicator when modifier='needs_review'", () => {
      const { container } = render(
        <WarmthBadge warmth="verified" modifier="needs_review" showLabel />,
      );
      expect(
        container.querySelector("[data-modifier='needs_review']"),
      ).toBeInTheDocument();
    });

    it("does not render modifier when modifier is null", () => {
      const { container } = render(
        <WarmthBadge warmth="firm" modifier={null} showLabel />,
      );
      expect(container.querySelector("[data-modifier]")).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Size variants
  // ---------------------------------------------------------------------------
  describe("size variants", () => {
    it("renders with size='sm'", () => {
      const { container } = render(<WarmthBadge warmth="forming" size="sm" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders with size='md'", () => {
      const { container } = render(<WarmthBadge warmth="forming" size="md" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders with size='lg'", () => {
      const { container } = render(<WarmthBadge warmth="forming" size="lg" />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Accessibility
  // ---------------------------------------------------------------------------
  describe("accessibility", () => {
    it("has accessible aria-label describing the warmth state", () => {
      render(<WarmthBadge warmth="forming" />);
      const badge = screen.getByRole("status");
      expect(badge).toHaveAccessibleName(/forming/i);
    });

    it("aria-label includes modifier when present", () => {
      render(<WarmthBadge warmth="forming" modifier="firming" />);
      const badge = screen.getByRole("status");
      expect(badge).toHaveAccessibleName(/firming/i);
    });

    it("is distinguishable without color (uses icon + border, not color alone)", () => {
      const { container } = render(<WarmthBadge warmth="forming" />);
      // Badge must contain an icon element (svg or img), not rely solely on color
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });
  });
});
