/**
 * Error Boundary Tests
 * Tests error handling, logging, and recovery actions
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TemplateErrorBoundary } from "../TemplateErrorBoundary";
import { DashboardErrorBoundary } from "../DashboardErrorBoundary";

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div>No error</div>;
};

describe("TemplateErrorBoundary", () => {
  const consoleError = console.error;

  beforeEach(() => {
    // Suppress error console output in tests
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = consoleError;
  });

  it("should render children when there is no error", () => {
    render(
      <TemplateErrorBoundary>
        <div>Test content</div>
      </TemplateErrorBoundary>
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("should display error UI when child throws", () => {
    render(
      <TemplateErrorBoundary>
        <ThrowError shouldThrow={true} />
      </TemplateErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  it("should show custom template name in error message", () => {
    render(
      <TemplateErrorBoundary templateName="Trinity Dashboard">
        <ThrowError shouldThrow={true} />
      </TemplateErrorBoundary>
    );

    expect(screen.getByText("Trinity Dashboard Error")).toBeInTheDocument();
  });

  it("should call onError callback when error occurs", () => {
    const handleError = vi.fn();

    render(
      <TemplateErrorBoundary onError={handleError}>
        <ThrowError shouldThrow={true} />
      </TemplateErrorBoundary>
    );

    expect(handleError).toHaveBeenCalled();
    expect(handleError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("should reset error state when Try Again is clicked", () => {
    const { rerender } = render(
      <TemplateErrorBoundary>
        <ThrowError shouldThrow={true} />
      </TemplateErrorBoundary>
    );

    const tryAgainButton = screen.getByText("Try Again");
    fireEvent.click(tryAgainButton);

    rerender(
      <TemplateErrorBoundary>
        <ThrowError shouldThrow={false} />
      </TemplateErrorBoundary>
    );

    expect(screen.getByText("No error")).toBeInTheDocument();
  });

  it("should use custom fallback when provided", () => {
    const customFallback = <div>Custom error UI</div>;

    render(
      <TemplateErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </TemplateErrorBoundary>
    );

    expect(screen.getByText("Custom error UI")).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
  });
});

describe("DashboardErrorBoundary", () => {
  const consoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = consoleError;
  });

  it("should render children when there is no error", () => {
    render(
      <DashboardErrorBoundary title="Test Dashboard">
        <div>Dashboard content</div>
      </DashboardErrorBoundary>
    );

    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("should display dashboard error UI when child throws", () => {
    render(
      <DashboardErrorBoundary title="Agent Monitor">
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    );

    expect(
      screen.getByText("Unable to Load Agent Monitor")
    ).toBeInTheDocument();
  });

  it("should show recovery options", () => {
    render(
      <DashboardErrorBoundary title="Dashboard">
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    );

    expect(screen.getAllByText("Try Again")).toHaveLength(1);
    expect(screen.getByText("Reload Page")).toBeInTheDocument();
  });

  it("should display custom recovery options", () => {
    const customOptions = [
      { label: "Clear Filters", action: vi.fn() },
      { label: "Reset Dashboard", action: vi.fn() },
    ];

    render(
      <DashboardErrorBoundary title="Dashboard" recoveryOptions={customOptions}>
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    );

    expect(screen.getByText("Clear Filters")).toBeInTheDocument();
    expect(screen.getByText("Reset Dashboard")).toBeInTheDocument();
  });

  it("should call custom recovery action when clicked", () => {
    const handleClearFilters = vi.fn();
    const customOptions = [
      { label: "Clear Filters", action: handleClearFilters },
    ];

    render(
      <DashboardErrorBoundary title="Dashboard" recoveryOptions={customOptions}>
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    );

    const clearButton = screen.getByText("Clear Filters");
    fireEvent.click(clearButton);

    expect(handleClearFilters).toHaveBeenCalled();
  });

  it("should show error message when showFullError is true", () => {
    render(
      <DashboardErrorBoundary title="Dashboard" showFullError={true}>
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    );

    expect(screen.getByText(/Test error message/)).toBeInTheDocument();
  });

  it("should call onError callback with error details", () => {
    const handleError = vi.fn();

    render(
      <DashboardErrorBoundary title="Dashboard" onError={handleError}>
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    );

    expect(handleError).toHaveBeenCalled();
    const [error, errorInfo] = handleError.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Test error message");
    expect(errorInfo).toHaveProperty("componentStack");
  });
});
