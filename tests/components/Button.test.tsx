/**
 * Component Test - Button
 *
 * Tests for the Button component:
 * - Rendering variants (primary, secondary, danger)
 * - Click handling
 * - Disabled state
 * - Loading state
 * - Accessibility
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";

// Mock Button component for testing pattern
const Button = ({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  loading = false,
  "aria-label": ariaLabel,
}: any) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`btn btn-${variant}`}
    aria-label={ariaLabel}
    aria-busy={loading}
  >
    {loading ? "Loading..." : children}
  </button>
);

describe("Button Component", () => {
  describe("Rendering", () => {
    it("should render with children", () => {
      render(<Button>Click Me</Button>);
      expect(screen.getByText("Click Me")).toBeInTheDocument();
    });

    it("should render primary variant by default", () => {
      render(<Button>Click Me</Button>);
      const button = screen.getByText("Click Me");
      expect(button).toHaveClass("btn-primary");
    });

    it("should render secondary variant", () => {
      render(<Button variant="secondary">Click Me</Button>);
      const button = screen.getByText("Click Me");
      expect(button).toHaveClass("btn-secondary");
    });

    it("should render danger variant", () => {
      render(<Button variant="danger">Delete</Button>);
      const button = screen.getByText("Delete");
      expect(button).toHaveClass("btn-danger");
    });
  });

  describe("Interaction", () => {
    it("should call onClick when clicked", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);

      fireEvent.click(screen.getByText("Click Me"));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should not call onClick when disabled", () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} disabled>
          Click Me
        </Button>
      );

      const button = screen.getByText("Click Me");
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("should not call onClick when loading", () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} loading>
          Click Me
        </Button>
      );

      const button = screen.getByText("Loading...");
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("States", () => {
    it("should show loading text when loading", () => {
      render(<Button loading>Click Me</Button>);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
      expect(screen.queryByText("Click Me")).not.toBeInTheDocument();
    });

    it("should be disabled when disabled prop is true", () => {
      render(<Button disabled>Click Me</Button>);
      expect(screen.getByText("Click Me")).toBeDisabled();
    });

    it("should be disabled when loading", () => {
      render(<Button loading>Click Me</Button>);
      expect(screen.getByText("Loading...")).toBeDisabled();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible name from children", () => {
      render(<Button>Submit Form</Button>);
      expect(
        screen.getByRole("button", { name: "Submit Form" })
      ).toBeInTheDocument();
    });

    it("should support aria-label", () => {
      render(<Button aria-label="Close dialog">×</Button>);
      expect(
        screen.getByRole("button", { name: "Close dialog" })
      ).toBeInTheDocument();
    });

    it("should set aria-busy when loading", () => {
      render(<Button loading>Click Me</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-busy", "true");
    });

    it("should be keyboard accessible", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);

      const button = screen.getByText("Click Me");
      button.focus();

      expect(document.activeElement).toBe(button);
    });
  });
});
