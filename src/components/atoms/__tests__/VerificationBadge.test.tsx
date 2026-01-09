/**
 * VerificationBadge Unit Tests
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerificationBadge } from "../VerificationBadge";

describe("VerificationBadge", () => {
  describe("Verified State", () => {
    it("renders verified badge with icon", () => {
      render(
        <VerificationBadge status="verified" confidence={92} showLabel={true} />
      );

      expect(screen.getByText(/verified/i)).toBeInTheDocument();
      expect(screen.getByText(/92%/)).toBeInTheDocument();
    });

    it("shows only icon and percentage when label hidden", () => {
      render(
        <VerificationBadge
          status="verified"
          confidence={92}
          showLabel={false}
        />
      );

      expect(screen.queryByText(/verified/i)).not.toBeInTheDocument();
      expect(screen.getByText("92%")).toBeInTheDocument();
    });

    it("applies green color scheme", () => {
      const { container } = render(<VerificationBadge status="verified" />);

      expect(container.firstChild).toHaveClass("text-green-600");
      expect(container.firstChild).toHaveClass("bg-green-50");
    });
  });

  describe("Pending State", () => {
    it("renders pending badge", () => {
      render(<VerificationBadge status="pending" showLabel={true} />);

      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });

    it("applies amber color scheme", () => {
      const { container } = render(<VerificationBadge status="pending" />);

      expect(container.firstChild).toHaveClass("text-amber-600");
      expect(container.firstChild).toHaveClass("bg-amber-50");
    });
  });

  describe("Failed State", () => {
    it("renders unverified badge", () => {
      render(<VerificationBadge status="failed" showLabel={true} />);

      expect(screen.getByText(/unverified/i)).toBeInTheDocument();
    });

    it("applies red color scheme", () => {
      const { container } = render(<VerificationBadge status="failed" />);

      expect(container.firstChild).toHaveClass("text-red-600");
      expect(container.firstChild).toHaveClass("bg-red-50");
    });
  });

  describe("Sizes", () => {
    it("applies small size classes", () => {
      const { container } = render(
        <VerificationBadge status="verified" size="sm" />
      );

      expect(container.firstChild).toHaveClass("text-xs");
    });

    it("applies medium size classes", () => {
      const { container } = render(
        <VerificationBadge status="verified" size="md" />
      );

      expect(container.firstChild).toHaveClass("text-sm");
    });

    it("applies large size classes", () => {
      const { container } = render(
        <VerificationBadge status="verified" size="lg" />
      );

      expect(container.firstChild).toHaveClass("text-base");
    });
  });

  describe("Confidence Display", () => {
    it("shows confidence in title tooltip", () => {
      const { container } = render(
        <VerificationBadge status="verified" confidence={85} />
      );

      expect(container.firstChild).toHaveAttribute(
        "title",
        expect.stringContaining("85%")
      );
    });

    it("works without confidence score", () => {
      render(<VerificationBadge status="pending" showLabel={true} />);

      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });
});
