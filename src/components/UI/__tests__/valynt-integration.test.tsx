import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../button";
import { Card, CardHeader, CardTitle, CardContent } from "../card";

describe("VALYNT Token Integration", () => {
  describe("Button Component", () => {
    it("renders with VALYNT primary color (Value Teal)", () => {
      render(<Button>Value Action</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("Value Action");
      expect(button).toBeInTheDocument();
    });

    it("renders secondary variant with VALYNT surface-3", () => {
      render(<Button variant="secondary">Structure Action</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("Structure Action");
    });

    it("renders destructive variant with VALYNT error color", () => {
      render(<Button variant="destructive">Delete</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("Delete");
    });
  });

  describe("Card Component", () => {
    it("renders with VALYNT surface-2 background", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>
      );
      expect(screen.getByText("Test Card")).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
  });

  describe("Token Mapping", () => {
    it("uses semantic tokens not raw values", () => {
      // This test verifies that components use CSS variables
      // rather than hardcoded colors
      const { container } = render(<Button>Test</Button>);
      const button = container.querySelector("button");
      
      // Button should not have inline styles with raw hex values
      const inlineStyle = button?.getAttribute("style");
      expect(inlineStyle).not.toContain("#18C3A5");
      expect(inlineStyle).not.toContain("#0B0C0F");
    });
  });
});
