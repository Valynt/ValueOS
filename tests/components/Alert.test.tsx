/**
 * Component Test - Alert/Toast
 *
 * Tests for the Alert component:
 * - Rendering with different variants
 * - Dismissible behavior
 * - Auto-dismiss timer
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Alert component
const Alert = ({
  children,
  variant = "info",
  dismissible = false,
  onDismiss,
  autoDismiss = false,
  autoDismissDelay = 5000,
}: any) => {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    if (autoDismiss && isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoDismissDelay);

      return () => clearTimeout(timer);
    }
  }, [autoDismiss, autoDismissDelay, isVisible, onDismiss]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div className={`alert alert-${variant}`} role="alert" aria-live="polite">
      <div className="alert-content">{children}</div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          aria-label="Dismiss alert"
          className="alert-dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
};

// Import React for useState/useEffect
import React from "react";

describe("Alert Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("should render with children", () => {
      render(<Alert>Alert message</Alert>);
      expect(screen.getByText("Alert message")).toBeInTheDocument();
    });

    it("should render info variant by default", () => {
      render(<Alert>Info message</Alert>);
      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("alert-info");
    });

    it("should render success variant", () => {
      render(<Alert variant="success">Success!</Alert>);
      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("alert-success");
    });

    it("should render warning variant", () => {
      render(<Alert variant="warning">Warning!</Alert>);
      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("alert-warning");
    });

    it("should render error variant", () => {
      render(<Alert variant="error">Error!</Alert>);
      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("alert-error");
    });
  });

  describe("Dismissible", () => {
    it("should show dismiss button when dismissible", () => {
      render(<Alert dismissible>Dismissible alert</Alert>);
      expect(screen.getByLabelText("Dismiss alert")).toBeInTheDocument();
    });

    it("should not show dismiss button by default", () => {
      render(<Alert>Non-dismissible alert</Alert>);
      expect(screen.queryByLabelText("Dismiss alert")).not.toBeInTheDocument();
    });

    it("should call onDismiss when dismiss button clicked", () => {
      const handleDismiss = vi.fn();
      render(
        <Alert dismissible onDismiss={handleDismiss}>
          Alert
        </Alert>
      );

      fireEvent.click(screen.getByLabelText("Dismiss alert"));
      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });

    it("should remove alert when dismissed", () => {
      render(<Alert dismissible>Alert message</Alert>);

      fireEvent.click(screen.getByLabelText("Dismiss alert"));
      expect(screen.queryByText("Alert message")).not.toBeInTheDocument();
    });
  });

  describe("Auto-dismiss", () => {
    it("should auto-dismiss after delay", () => {
      const handleDismiss = vi.fn();
      render(
        <Alert autoDismiss autoDismissDelay={3000} onDismiss={handleDismiss}>
          Auto-dismiss alert
        </Alert>
      );

      expect(screen.getByText("Auto-dismiss alert")).toBeInTheDocument();

      // Fast-forward time
      vi.advanceTimersByTime(3000);

      expect(handleDismiss).toHaveBeenCalled();
    });

    it("should not auto-dismiss if not enabled", () => {
      render(<Alert>Persistent alert</Alert>);

      expect(screen.getByText("Persistent alert")).toBeInTheDocument();

      vi.advanceTimersByTime(10000);

      expect(screen.getByText("Persistent alert")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it('should have role="alert"', () => {
      render(<Alert>Alert message</Alert>);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it('should have aria-live="polite"', () => {
      render(<Alert>Alert message</Alert>);
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("aria-live", "polite");
    });

    it("should have accessible dismiss button", () => {
      render(<Alert dismissible>Alert</Alert>);
      expect(
        screen.getByRole("button", { name: "Dismiss alert" })
      ).toBeInTheDocument();
    });
  });
});
