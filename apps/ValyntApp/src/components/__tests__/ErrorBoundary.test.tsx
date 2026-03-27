/**
 * ErrorBoundary — P1 observability tests
 *
 * Covers:
 * - Catches React render errors thrown by child components
 * - Renders the error recovery UI (not the crashed child)
 * - Calls the onError callback with the error and errorInfo
 * - Renders a retry button that resets the error state
 * - Categorizes auth/network/generic errors correctly
 * - Does not render error UI when children render successfully
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ErrorBoundary from "../ErrorBoundary";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A component that throws on render when `shouldThrow` is true. */
function ThrowingChild({ shouldThrow, message }: { shouldThrow: boolean; message?: string }) {
  if (shouldThrow) {
    throw new Error(message ?? "Test render error");
  }
  return <div data-testid="child-content">Child rendered successfully</div>;
}

/** Suppress console.error noise from React's error boundary logging in tests. */
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// Tests
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

    // Child should not be visible
    expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    // Error UI should be rendered with role="alert"
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("calls onError callback with the thrown error and errorInfo", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowingChild shouldThrow message="Callback test error" />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledOnce();
    const [error, errorInfo] = onError.mock.calls[0] as [Error, React.ErrorInfo];
    expect(error.message).toBe("Callback test error");
    expect(errorInfo).toBeDefined();
    expect(typeof errorInfo.componentStack).toBe("string");
  });

  it("renders a custom fallback when provided", () => {
    const fallback = <div data-testid="custom-fallback">Custom error UI</div>;

    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

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

    // Use a controlled component to toggle the throw
    function ToggleChild() {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      if (shouldThrow) {
        // Stop throwing after the first render so retry succeeds
        setTimeout(() => setShouldThrow(false), 0);
        throw new Error("Initial error");
      }
      return <div data-testid="recovered-child">Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <ToggleChild />
      </ErrorBoundary>,
    );

    // Error UI is shown
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Click retry
    await user.click(screen.getByRole("button", { name: /try again/i }));

    // Child should now render successfully
    expect(screen.getByTestId("recovered-child")).toBeInTheDocument();
  });
});
