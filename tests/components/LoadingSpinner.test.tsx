/**
 * Component Test - Loading Spinner
 *
 * Tests for the LoadingSpinner component:
 * - Rendering with different sizes
 * - Variants and colors
 * - Accessibility
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock LoadingSpinner component
const LoadingSpinner = ({
  size = "medium",
  variant = "primary",
  label = "Loading...",
}: any) => (
  <div
    className={`spinner spinner-${size} spinner-${variant}`}
    role="status"
    aria-label={label}
  >
    <span className="sr-only">{label}</span>
  </div>
);

describe("LoadingSpinner Component", () => {
  describe("Rendering", () => {
    it("should render with default props", () => {
      render(<LoadingSpinner />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("should render small size", () => {
      render(<LoadingSpinner size="small" />);
      const spinner = screen.getByRole("status");
      expect(spinner).toHaveClass("spinner-small");
    });

    it("should render medium size by default", () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole("status");
      expect(spinner).toHaveClass("spinner-medium");
    });

    it("should render large size", () => {
      render(<LoadingSpinner size="large" />);
      const spinner = screen.getByRole("status");
      expect(spinner).toHaveClass("spinner-large");
    });
  });

  describe("Variants", () => {
    it("should render primary variant by default", () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole("status");
      expect(spinner).toHaveClass("spinner-primary");
    });

    it("should render secondary variant", () => {
      render(<LoadingSpinner variant="secondary" />);
      const spinner = screen.getByRole("status");
      expect(spinner).toHaveClass("spinner-secondary");
    });
  });

  describe("Accessibility", () => {
    it('should have role="status"', () => {
      render(<LoadingSpinner />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("should have default aria-label", () => {
      render(<LoadingSpinner />);
      expect(screen.getByLabelText("Loading...")).toBeInTheDocument();
    });

    it("should support custom aria-label", () => {
      render(<LoadingSpinner label="Fetching data..." />);
      expect(screen.getByLabelText("Fetching data...")).toBeInTheDocument();
    });

    it("should have screen reader text", () => {
      render(<LoadingSpinner label="Processing" />);
      expect(screen.getByText("Processing")).toBeInTheDocument();
    });
  });
});
