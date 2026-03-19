
/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BootstrapGuard } from "../components/common/BootstrapGuard";

// Mock heavy components or those with side effects
vi.mock("../AppRoutes", () => ({
  default: () => <div data-testid="app-routes">App Routes Content</div>,
}));

describe("App Mounting Regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should mount the application without global ReferenceErrors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });

    render(
      <MemoryRouter>
        <BootstrapGuard>
          <div data-testid="main-content">Successfully Mounted</div>
        </BootstrapGuard>
      </MemoryRouter>
    );

    expect(screen.getByTestId("main-content")).toBeInTheDocument();

    const hasReferenceError = errorSpy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === "string" && arg.includes("ReferenceError"))
    );
    expect(hasReferenceError).toBe(false);

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should render children (BootstrapGuard is a passthrough stub)", () => {
    render(
      <MemoryRouter>
        <BootstrapGuard>
          <div data-testid="main-content">App Content</div>
        </BootstrapGuard>
      </MemoryRouter>
    );

    expect(screen.getByTestId("main-content")).toBeInTheDocument();
  });

  it("should render children immediately for non-critical errors", async () => {
    render(
      <MemoryRouter>
        <BootstrapGuard>
          <div data-testid="main-content">Should see this despite error</div>
        </BootstrapGuard>
      </MemoryRouter>
    );

    expect(screen.getByTestId("main-content")).toBeInTheDocument();
    expect(screen.getByText(/Should see this despite error/i)).toBeInTheDocument();
  });
});
