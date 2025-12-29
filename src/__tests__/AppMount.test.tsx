/** @vitest-environment jsdom */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BootstrapGuard } from "../components/Common/BootstrapGuard";
import { MemoryRouter } from "react-router-dom";
import * as bootstrapModule from "../bootstrap";

// Mock the bootstrap implementation to return immediately
vi.mock("../bootstrap", () => ({
  bootstrap: vi.fn(),
  getConfig: vi.fn(() => ({
    app: { env: "development" },
    security: { csrfEnabled: true },
    features: { agentFabric: true },
  })),
  isDevelopment: vi.fn(() => true),
  isProduction: vi.fn(() => false),
}));

// Mock heavy components or those with side effects
vi.mock("../AppRoutes", () => ({
  default: () => <div data-testid="app-routes">App Routes Content</div>,
}));

describe("App Mounting Regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should mount the application without global ReferenceErrors", async () => {
    // Spy on console.error to catch any ReferenceErrors or React errors
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Successful bootstrap mock
    (bootstrapModule.bootstrap as any).mockResolvedValue({
      success: true,
      errors: [],
      warnings: [],
      duration: 10,
    });

    render(
      <MemoryRouter>
        <BootstrapGuard>
          <div data-testid="main-content">Successfully Mounted</div>
        </BootstrapGuard>
      </MemoryRouter>
    );

    // Should initially show loading
    expect(screen.getByText(/VALYNT/i)).toBeInTheDocument();

    // Wait for bootstrap to complete and children to render
    await waitFor(() => {
      expect(screen.getByTestId("main-content")).toBeInTheDocument();
    });

    // CRITICAL: Ensure no errors were logged during the entire render/mount cycle
    // We check specifically for "ReferenceError" in call arguments if we want to be precise,
    // but usually any console.error is a failure in this hygiene test.
    expect(errorSpy).not.toHaveBeenCalled();

    // We might allow some warnings, but let's check for "ReferenceError" specifically
    const hasReferenceError = errorSpy.mock.calls.some((call) =>
      call.some(
        (arg) => typeof arg === "string" && arg.includes("ReferenceError")
      )
    );
    expect(hasReferenceError).toBe(false);

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should show error screen if bootstrap fails", async () => {
    (bootstrapModule.bootstrap as any).mockResolvedValue({
      success: false,
      errors: ["Critical Failure"],
      warnings: [],
      duration: 10,
    });

    render(
      <MemoryRouter>
        <BootstrapGuard>
          <div>Should not see this</div>
        </BootstrapGuard>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Application Initialization Failed/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Critical Failure/i)).toBeInTheDocument();
    });
  });
});
