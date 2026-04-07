/**
 * TDD: WarmthHeader Component
 *
 * Tests dual-layer status (warmth surface + deep state toggle),
 * keyboard accessibility, and action button rendering.
 * RED phase: fails until src/components/warmth/WarmthHeader.tsx is implemented.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WarmthHeader } from "@/components/warmth/WarmthHeader";

describe("WarmthHeader", () => {
  const defaultProps = {
    title: "Acme Corporation",
    warmth: "firm" as const,
  };

  // ---------------------------------------------------------------------------
  // Basic rendering
  // ---------------------------------------------------------------------------
  it("renders title and WarmthBadge", () => {
    render(<WarmthHeader {...defaultProps} />);
    expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
    // WarmthBadge should be present (renders as role="status")
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Deep state toggle — dual-layer architecture
  // ---------------------------------------------------------------------------
  describe("deep state toggle", () => {
    it("renders deep state toggle button", () => {
      render(<WarmthHeader {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /show details|deep state|details/i }),
      ).toBeInTheDocument();
    });

    it("deep state panel is hidden by default", () => {
      render(<WarmthHeader {...defaultProps} />);
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });

    it("clicking toggle shows deep state panel with saga_state, confidence, blocking", async () => {
      const user = userEvent.setup();
      render(
        <WarmthHeader
          {...defaultProps}
          operationalState={{
            sagaState: "VALIDATING",
            confidence: 0.72,
            blockingReasons: ["Missing Q3 financials"],
            lastAgentAction: "FinancialModelingAgent ran 2h ago",
          }}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /show details|deep state|details/i }),
      );

      const panel = screen.getByRole("region");
      expect(panel).toBeInTheDocument();
      expect(screen.getByText(/VALIDATING/)).toBeInTheDocument();
      expect(screen.getByText(/72%|0.72/)).toBeInTheDocument();
      expect(screen.getByText(/Missing Q3 financials/)).toBeInTheDocument();
    });

    it("clicking toggle again hides deep state panel", async () => {
      const user = userEvent.setup();
      render(
        <WarmthHeader
          {...defaultProps}
          operationalState={{
            sagaState: "VALIDATING",
            confidence: 0.72,
            blockingReasons: [],
          }}
        />,
      );

      const toggleBtn = screen.getByRole("button", {
        name: /show details|deep state|details/i,
      });

      await user.click(toggleBtn);
      expect(screen.getByRole("region")).toBeInTheDocument();

      await user.click(toggleBtn);
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });

    it("toggle is keyboard accessible (Enter to open, Enter to close)", async () => {
      const user = userEvent.setup();
      render(
        <WarmthHeader
          {...defaultProps}
          operationalState={{
            sagaState: "COMPOSING",
            confidence: 0.65,
            blockingReasons: [],
          }}
        />,
      );

      const toggleBtn = screen.getByRole("button", {
        name: /show details|deep state|details/i,
      });
      toggleBtn.focus();

      await user.keyboard("{Enter}");
      expect(screen.getByRole("region")).toBeInTheDocument();

      await user.keyboard("{Enter}");
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Action buttons
  // ---------------------------------------------------------------------------
  it("renders action buttons when provided", () => {
    render(
      <WarmthHeader
        {...defaultProps}
        actions={<button data-testid="share-btn">Share</button>}
      />,
    );
    expect(screen.getByTestId("share-btn")).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Callback
  // ---------------------------------------------------------------------------
  it("calls onDeepStateToggle callback when toggle is clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<WarmthHeader {...defaultProps} onDeepStateToggle={onToggle} />);

    await user.click(
      screen.getByRole("button", { name: /show details|deep state|details/i }),
    );
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
