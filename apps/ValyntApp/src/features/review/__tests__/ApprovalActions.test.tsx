/**
 * TDD: Phase 3 — ApprovalActions component
 *
 * Warmth-gated + RBAC-gated approval buttons for the reviewer surface.
 * RED phase: fails until src/features/review/components/ApprovalActions.tsx is implemented.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApprovalActions } from "@/features/review/components/ApprovalActions";

describe("ApprovalActions", () => {
  const defaultProps = {
    caseId: "case-firm-1",
    warmth: "firm" as const,
    canApprove: true,
    onApprove: vi.fn(),
    onRequestChanges: vi.fn(),
    onExport: vi.fn(),
  };

  // ---------------------------------------------------------------------------
  // Warmth-gated approval
  // ---------------------------------------------------------------------------
  describe("warmth gating", () => {
    it("Approve button enabled when warmth is firm", () => {
      render(<ApprovalActions {...defaultProps} warmth="firm" />);
      const btn = screen.getByRole("button", { name: /approve/i });
      expect(btn).not.toBeDisabled();
    });

    it("Approve button enabled when warmth is verified", () => {
      render(<ApprovalActions {...defaultProps} warmth="verified" />);
      const btn = screen.getByRole("button", { name: /approve/i });
      expect(btn).not.toBeDisabled();
    });

    it("Approve button disabled when warmth is forming", () => {
      render(<ApprovalActions {...defaultProps} warmth="forming" />);
      const btn = screen.getByRole("button", { name: /approve/i });
      expect(btn).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // RBAC gating
  // ---------------------------------------------------------------------------
  describe("permission gating", () => {
    it("Approve button disabled when user lacks permission", () => {
      render(<ApprovalActions {...defaultProps} canApprove={false} />);
      const btn = screen.getByRole("button", { name: /approve/i });
      expect(btn).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // Interactions
  // ---------------------------------------------------------------------------
  describe("interactions", () => {
    it("calls onApprove when Approve is clicked", async () => {
      const onApprove = vi.fn();
      render(<ApprovalActions {...defaultProps} onApprove={onApprove} />);

      await userEvent.click(screen.getByRole("button", { name: /approve/i }));
      expect(onApprove).toHaveBeenCalledTimes(1);
    });

    it("calls onRequestChanges when Request Changes is clicked", async () => {
      const onRequestChanges = vi.fn();
      render(
        <ApprovalActions {...defaultProps} onRequestChanges={onRequestChanges} />,
      );

      await userEvent.click(
        screen.getByRole("button", { name: /request.*change|change/i }),
      );
      expect(onRequestChanges).toHaveBeenCalledTimes(1);
    });

    it("calls onExport when Export PDF is clicked", async () => {
      const onExport = vi.fn();
      render(<ApprovalActions {...defaultProps} onExport={onExport} />);

      await userEvent.click(
        screen.getByRole("button", { name: /export|pdf/i }),
      );
      expect(onExport).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Export always available
  // ---------------------------------------------------------------------------
  describe("export availability", () => {
    it("Export PDF button enabled regardless of warmth state", () => {
      render(<ApprovalActions {...defaultProps} warmth="forming" />);
      const btn = screen.getByRole("button", { name: /export|pdf/i });
      expect(btn).not.toBeDisabled();
    });

    it("Export PDF button enabled regardless of permission", () => {
      render(<ApprovalActions {...defaultProps} canApprove={false} />);
      const btn = screen.getByRole("button", { name: /export|pdf/i });
      expect(btn).not.toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // Disabled reason messaging
  // ---------------------------------------------------------------------------
  describe("disabled state messaging", () => {
    it("shows reason when Approve is disabled due to warmth", () => {
      const { container } = render(
        <ApprovalActions {...defaultProps} warmth="forming" />,
      );
      // Should have a title, tooltip, or aria-describedby explaining why disabled
      const btn = screen.getByRole("button", { name: /approve/i });
      const hasReason =
        btn.getAttribute("title") ||
        btn.getAttribute("aria-describedby") ||
        container.querySelector("[role='tooltip']");
      expect(hasReason).toBeTruthy();
    });
  });
});
