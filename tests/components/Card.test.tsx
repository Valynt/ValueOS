/**
 * Component Test - Card
 *
 * Tests for the Card component:
 * - Rendering with header, body, footer
 * - Click handling (when clickable)
 * - Variants and styles
 * - Accessibility
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Card component
const Card = ({
  header,
  children,
  footer,
  onClick,
  variant = "default",
  className = "",
}: any) => {
  const isClickable = !!onClick;
  const Component = isClickable ? "button" : "div";

  return (
    <Component
      className={`card card-${variant} ${className} ${isClickable ? "card-clickable" : ""}`}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </Component>
  );
};

describe("Card Component", () => {
  describe("Rendering", () => {
    it("should render children", () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("should render with header", () => {
      render(<Card header="Card Title">Content</Card>);
      expect(screen.getByText("Card Title")).toBeInTheDocument();
    });

    it("should render with footer", () => {
      render(<Card footer="Card Footer">Content</Card>);
      expect(screen.getByText("Card Footer")).toBeInTheDocument();
    });

    it("should render all sections together", () => {
      render(
        <Card header="Title" footer="Footer">
          Body content
        </Card>
      );
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Body content")).toBeInTheDocument();
      expect(screen.getByText("Footer")).toBeInTheDocument();
    });
  });

  describe("Variants", () => {
    it("should render default variant", () => {
      render(<Card>Content</Card>);
      const card = screen.getByText("Content").parentElement;
      expect(card).toHaveClass("card-default");
    });

    it("should render primary variant", () => {
      render(<Card variant="primary">Content</Card>);
      const card = screen.getByText("Content").parentElement;
      expect(card).toHaveClass("card-primary");
    });

    it("should render success variant", () => {
      render(<Card variant="success">Content</Card>);
      const card = screen.getByText("Content").parentElement;
      expect(card).toHaveClass("card-success");
    });
  });

  describe("Interaction", () => {
    it("should call onClick when clicked", () => {
      const handleClick = vi.fn();
      render(<Card onClick={handleClick}>Clickable card</Card>);

      fireEvent.click(screen.getByText("Clickable card"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should not be clickable without onClick", () => {
      render(<Card>Non-clickable card</Card>);
      const card = screen.getByText("Non-clickable card").parentElement;
      expect(card?.tagName).toBe("DIV");
      expect(card).not.toHaveClass("card-clickable");
    });

    it("should render as button when clickable", () => {
      render(<Card onClick={vi.fn()}>Clickable</Card>);
      const card = screen.getByRole("button");
      expect(card).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should be keyboard accessible when clickable", () => {
      const handleClick = vi.fn();
      render(<Card onClick={handleClick}>Clickable</Card>);

      const card = screen.getByRole("button");
      expect(card).toHaveAttribute("tabIndex", "0");
    });

    it("should not have button role when not clickable", () => {
      render(<Card>Static card</Card>);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("Custom styling", () => {
    it("should apply custom className", () => {
      render(<Card className="custom-class">Content</Card>);
      const card = screen.getByText("Content").parentElement;
      expect(card).toHaveClass("custom-class");
    });
  });
});
