/**
 * ErrorBoundary — unit tests
 *
 * Verifies requestId display, copy button, and error categorization.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ErrorBoundary from "../ErrorBoundary";

// ---------------------------------------------------------------------------
// Helper — component that throws on demand
// ---------------------------------------------------------------------------

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test render error");
  return <div>OK</div>;
}

// Suppress React's error boundary console.error noise in tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("renders requestId when provided and boundary is in error state", () => {
    render(
      <ErrorBoundary requestId="req_abc123">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText("req_abc123")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("does not render requestId section when no error", () => {
    render(
      <ErrorBoundary requestId="req_abc123">
        <div>Fine</div>
      </ErrorBoundary>,
    );
    expect(screen.queryByText("req_abc123")).not.toBeInTheDocument();
  });

  it("copy button writes requestId to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
    });

    render(
      <ErrorBoundary requestId="req_copy_test">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    const copyBtn = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith("req_copy_test");
  });

  it("calls onError callback when child throws", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
  });
});
