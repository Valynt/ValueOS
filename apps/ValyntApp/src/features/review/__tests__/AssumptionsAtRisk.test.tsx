/**
 * TDD: Phase 3 — AssumptionsAtRisk component
 *
 * Displays assumptions below confidence threshold for reviewer surface.
 * RED phase: fails until src/features/review/components/AssumptionsAtRisk.tsx is implemented.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssumptionsAtRisk } from "@/features/review/components/AssumptionsAtRisk";
import { MOCK_ASSUMPTIONS } from "@/test/fixtures/phase3";

describe("AssumptionsAtRisk", () => {
  const LOW_CONFIDENCE_THRESHOLD = 0.6;

  const lowConfidence = MOCK_ASSUMPTIONS.filter(
    (a) => a.confidenceScore < LOW_CONFIDENCE_THRESHOLD,
  );
  const highConfidence = MOCK_ASSUMPTIONS.filter(
    (a) => a.confidenceScore >= LOW_CONFIDENCE_THRESHOLD,
  );

  // ---------------------------------------------------------------------------
  // Rendering low-confidence assumptions
  // ---------------------------------------------------------------------------
  describe("low-confidence assumptions", () => {
    it("shows assumptions below confidence threshold", () => {
      render(
        <AssumptionsAtRisk
          assumptions={MOCK_ASSUMPTIONS}
          threshold={LOW_CONFIDENCE_THRESHOLD}
        />,
      );

      for (const a of lowConfidence) {
        expect(screen.getByText(a.name)).toBeInTheDocument();
      }
    });

    it("does not show high-confidence assumptions", () => {
      render(
        <AssumptionsAtRisk
          assumptions={MOCK_ASSUMPTIONS}
          threshold={LOW_CONFIDENCE_THRESHOLD}
        />,
      );

      for (const a of highConfidence) {
        expect(screen.queryByText(a.name)).not.toBeInTheDocument();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Warmth badge per assumption
  // ---------------------------------------------------------------------------
  describe("warmth indicators", () => {
    it("renders a WarmthBadge per displayed assumption", () => {
      const { container } = render(
        <AssumptionsAtRisk
          assumptions={MOCK_ASSUMPTIONS}
          threshold={LOW_CONFIDENCE_THRESHOLD}
        />,
      );

      const badges = container.querySelectorAll('[role="status"]');
      expect(badges.length).toBe(lowConfidence.length);
    });
  });

  // ---------------------------------------------------------------------------
  // Source type labels
  // ---------------------------------------------------------------------------
  describe("source type", () => {
    it("shows source type label per assumption", () => {
      render(
        <AssumptionsAtRisk
          assumptions={MOCK_ASSUMPTIONS}
          threshold={LOW_CONFIDENCE_THRESHOLD}
        />,
      );

      // At least one "inferred" label should be visible (from fixtures)
      const inferredLabels = screen.getAllByText(/inferred/i);
      expect(inferredLabels.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  describe("empty state", () => {
    it("shows empty message when all assumptions are strong", () => {
      render(
        <AssumptionsAtRisk
          assumptions={highConfidence}
          threshold={LOW_CONFIDENCE_THRESHOLD}
        />,
      );

      expect(
        screen.getByText(/no.*assumption.*risk|all.*strong|no.*attention/i),
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Action button
  // ---------------------------------------------------------------------------
  describe("clarification action", () => {
    it("shows Request clarification button per assumption", () => {
      render(
        <AssumptionsAtRisk
          assumptions={MOCK_ASSUMPTIONS}
          threshold={LOW_CONFIDENCE_THRESHOLD}
        />,
      );

      const buttons = screen.getAllByRole("button", {
        name: /clarif|request|review/i,
      });
      expect(buttons.length).toBe(lowConfidence.length);
    });
  });
});
