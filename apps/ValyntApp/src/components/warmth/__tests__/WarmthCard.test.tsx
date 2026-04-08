/**
 * TDD: WarmthCard Component
 *
 * Tests warmth-appropriate border styling, animation, and child passthrough.
 * RED phase: fails until src/components/warmth/WarmthCard.tsx is implemented.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WarmthCard } from "@/components/warmth/WarmthCard";

describe("WarmthCard", () => {
  // ---------------------------------------------------------------------------
  // Child rendering
  // ---------------------------------------------------------------------------
  it("renders children", () => {
    render(
      <WarmthCard warmth="forming">
        <span data-testid="child">Hello</span>
      </WarmthCard>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Warmth-specific border styling
  // ---------------------------------------------------------------------------
  describe("border styling", () => {
    it("applies dashed amber border for forming state", () => {
      const { container } = render(
        <WarmthCard warmth="forming">Content</WarmthCard>,
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/warmth-forming|border-dashed/);
    });

    it("applies solid blue border for firm state", () => {
      const { container } = render(
        <WarmthCard warmth="firm">Content</WarmthCard>,
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/warmth-firm|border-solid/);
    });

    it("applies solid blue border with glow for verified state", () => {
      const { container } = render(
        <WarmthCard warmth="verified">Content</WarmthCard>,
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/warmth-verified/);
    });
  });

  // ---------------------------------------------------------------------------
  // Animation
  // ---------------------------------------------------------------------------
  describe("animation", () => {
    it("applies pulse animation for forming state (via warmth-forming CSS class)", () => {
      const { container } = render(
        <WarmthCard warmth="forming">Content</WarmthCard>,
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("warmth-forming");
    });

    it("does not apply animation for firm state", () => {
      const { container } = render(
        <WarmthCard warmth="firm">Content</WarmthCard>,
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).not.toMatch(/pulse/);
    });
  });

  // ---------------------------------------------------------------------------
  // Passthrough props
  // ---------------------------------------------------------------------------
  it("passes className through to container", () => {
    const { container } = render(
      <WarmthCard warmth="firm" className="custom-class">
        Content
      </WarmthCard>,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("custom-class");
  });

  it("accepts modifier prop without visual regression", () => {
    const { container } = render(
      <WarmthCard warmth="forming" modifier="firming">
        Content
      </WarmthCard>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
