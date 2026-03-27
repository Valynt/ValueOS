/**
 * ErrorBoundary — unit tests
 *
 * Covers:
 * - Renders children when no error is thrown
 * - Renders error recovery UI on child throw
 * - Calls onError callback with error and errorInfo
 * - Categorizes auth/network/generic errors correctly
 * - Renders a retry button that resets error state
 * - Displays requestId with copy button
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import ErrorBoundary from "../ErrorBoundary";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ThrowingChild({ shouldThrow, message }: { shouldThrow: boolean; message?: string }) {
  if (shouldThrow) throw new Error(message ?? "Test render error");
  return <div data-testid="child-content">OK</div>;
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
// Error catching
// ---------------------------------------------------------------------------

describe("ErrorBoundary — error catching", () => {
  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("renders error UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow message="Unexpected crash" />
      </ErrorBoundary>,
    );
    expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("calls onError callback with the thrown error and errorInfo", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingChild shouldThrow message="Callback test error" />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const [error, errorInfo] = onError.mock.calls[0] as [Error, React.ErrorInfo];
    expect(error.message).toBe("Callback test error");
    expect(typeof errorInfo.componentStack).toBe("string");
  });

  it("renders a custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom error UI</div>}>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error categorization
// ---------------------------------------------------------------------------

describe("ErrorBoundary — error categorization", () => {
  it("shows 'Something went wrong' for generic errors", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow message="Some unexpected error" />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows 'Authentication Error' for auth-related errors", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow message="401 auth token expired" />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Authentication Error")).toBeInTheDocument();
  });

  it("shows 'Connection Problem' for network-related errors", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow message="fetch failed: network timeout" />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Connection Problem")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Retry behaviour
// ---------------------------------------------------------------------------

describe("ErrorBoundary — retry behaviour", () => {
  it("renders a Try Again button in the error UI", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("resets error state and re-renders children on retry when child no longer throws", async () => {
    const user = userEvent.setup();

    // shouldThrow starts true. The ErrorBoundary catches the error and shows
    // the fallback. We then set shouldThrow = false before clicking retry so
    // the re-render succeeds. This is robust to React strict mode's
    // double-invocation because we only flip the flag after the boundary has
    // already caught the error and rendered the fallback UI.
    let shouldThrow = true;

    function ToggleChild() {
      if (shouldThrow) {
        throw new Error("Initial error");
      }
      return <div data-testid="recovered-child">Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <ToggleChild />
      </ErrorBoundary>,
    );

    // Error boundary should have caught the error and shown the fallback
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Allow the next render to succeed before clicking retry
    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByTestId("recovered-child")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Request ID display
// ---------------------------------------------------------------------------

describe("ErrorBoundary — requestId", () => {
  it("renders requestId when provided and boundary is in error state", () => {
    render(
      <ErrorBoundary requestId="req_abc123">
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText("req_abc123")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("does not render requestId section when no error", () => {
    render(
      <ErrorBoundary requestId="req_abc123">
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.queryByText("req_abc123")).not.toBeInTheDocument();
  });

  it("copy button writes requestId to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(
      <ErrorBoundary requestId="req_copy_test">
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("req_copy_test"));
  });
});
