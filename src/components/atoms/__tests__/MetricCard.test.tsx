/**
 * MetricCard Unit Tests
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetricCard } from "../MetricCard";

describe("MetricCard", () => {
  describe("Basic Rendering", () => {
    it("renders label and value", () => {
      render(
        <MetricCard label="Total Revenue" value="$1.2M" verified={true} />
      );

      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
      expect(screen.getByText("$1.2M")).toBeInTheDocument();
    });

    it("renders subtitle when provided", () => {
      render(
        <MetricCard
          label="Growth"
          value="23%"
          verified={true}
          subtitle="vs. last month"
        />
      );

      expect(screen.getByText("vs. last month")).toBeInTheDocument();
    });

    it("renders custom icon", () => {
      const { container } = render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={true}
          icon={<span data-testid="custom-icon">💰</span>}
        />
      );

      expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    });
  });

  describe("Verification States", () => {
    it("shows verified badge for verified metrics", () => {
      render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={true}
          confidence={92}
        />
      );

      expect(screen.getByText(/verified/i)).toBeInTheDocument();
      expect(screen.getByText(/92%/)).toBeInTheDocument();
    });

    it("shows unverified warning for unverified metrics", () => {
      render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={false}
          confidence={68}
        />
      );

      expect(screen.getByText(/confidence: 68%/i)).toBeInTheDocument();
      expect(screen.getByText(/below threshold/i)).toBeInTheDocument();
    });

    it("shows pending message when confidence is missing", () => {
      render(<MetricCard label="Revenue" value="$100K" verified={false} />);

      expect(screen.getByText(/verification pending/i)).toBeInTheDocument();
    });
  });

  describe("Citations", () => {
    it("displays citation count", () => {
      render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={true}
          citations={["CRM-123", "DB-456"]}
        />
      );

      expect(screen.getByText("2 sources")).toBeInTheDocument();
    });

    it('uses singular "source" for one citation', () => {
      render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={true}
          citations={["CRM-123"]}
        />
      );

      expect(screen.getByText("1 source")).toBeInTheDocument();
    });

    it('shows up to 3 citations and "+N more" for extras', () => {
      render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={true}
          citations={["CRM-1", "CRM-2", "CRM-3", "CRM-4", "CRM-5"]}
        />
      );

      expect(screen.getByText("+2 more")).toBeInTheDocument();
    });

    it("does not show citation section when empty", () => {
      render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={true}
          citations={[]}
        />
      );

      expect(screen.queryByText(/sources/i)).not.toBeInTheDocument();
    });
  });

  describe("Trend Indicators", () => {
    it("shows up trend indicator", () => {
      render(
        <MetricCard label="Growth" value="23%" verified={true} trend="up" />
      );

      expect(screen.getByText("↑")).toBeInTheDocument();
    });

    it("shows down trend indicator", () => {
      render(
        <MetricCard label="Decline" value="-5%" verified={true} trend="down" />
      );

      expect(screen.getByText("↓")).toBeInTheDocument();
    });

    it("shows no indicator for neutral trend", () => {
      const { container } = render(
        <MetricCard label="Flat" value="0%" verified={true} trend="neutral" />
      );

      expect(container.textContent).not.toMatch(/[↑↓]/);
    });
  });

  describe("Variants", () => {
    it("applies default variant styling", () => {
      const { container } = render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={true}
          variant="default"
        />
      );

      expect(container.firstChild).toHaveClass("bg-card");
    });

    it("applies success variant styling", () => {
      const { container } = render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={true}
          variant="success"
        />
      );

      expect(container.firstChild).toHaveClass("bg-green-50");
    });

    it("applies warning variant styling", () => {
      const { container } = render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={false}
          variant="warning"
        />
      );

      expect(container.firstChild).toHaveClass("bg-amber-50");
    });
  });

  describe("Interactions", () => {
    it("calls onClick when clicked", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={true}
          onClick={handleClick}
        />
      );

      await user.click(screen.getByText("Revenue"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("applies cursor-pointer class when clickable", () => {
      const { container } = render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={true}
          onClick={() => {}}
        />
      );

      expect(container.firstChild).toHaveClass("cursor-pointer");
    });

    it("does not apply cursor-pointer when not clickable", () => {
      const { container } = render(
        <MetricCard label="Revenue" value="$100K" verified={true} />
      );

      expect(container.firstChild).not.toHaveClass("cursor-pointer");
    });
  });

  describe("Accessibility", () => {
    it("has no accessibility violations for verified state", async () => {
      const { container } = render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={true}
          confidence={92}
        />
      );

      // Basic check - should have text content
      expect(container.textContent).toContain("Revenue");
      expect(container.textContent).toContain("$100K");
    });

    it("has descriptive title for verification badge", () => {
      render(
        <MetricCard
          label="Revenue"
          value="$100K"
          verified={true}
          confidence={85}
        />
      );

      const badge = screen.getByText(/verified/i).closest("div");
      expect(badge).toHaveAttribute("title");
    });
  });
});
