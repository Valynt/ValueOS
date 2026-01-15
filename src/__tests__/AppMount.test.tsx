/** @vitest-environment jsdom */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BootstrapGuard } from "../components/Common/BootstrapGuard";
import { MemoryRouter } from "react-router-dom";
import * as bootstrapModule from "../app/bootstrap/init";
import * as useBootstrapModule from "../hooks/useBootstrap";

// Mock the useBootstrap hook to control its behavior
vi.mock("../hooks/useBootstrap", () => ({
  useBootstrap: vi.fn(),
}));

// Mock the bootstrap implementation
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

    // Mock useBootstrap to return successful state
    const mockStartBootstrap = vi.fn().mockResolvedValue({
      success: true,
      errors: [],
      warnings: [],
      duration: 10,
    });

    (useBootstrapModule.useBootstrap as any).mockReturnValue({
      status: "complete",
      progress: "Bootstrap complete",
      step: 8,
      errors: [],
      warnings: [],
      result: { success: true, errors: [], warnings: [], duration: 10 },
      startBootstrap: mockStartBootstrap,
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <BootstrapGuard>
          <div data-testid="main-content">Successfully Mounted</div>
        </BootstrapGuard>
      </MemoryRouter>
    );

    // Children should render immediately since BootstrapGuard doesn't block UI
    expect(screen.getByTestId("main-content")).toBeInTheDocument();

    // Verify bootstrap was started
    expect(mockStartBootstrap).toHaveBeenCalled();

    // CRITICAL: Ensure no errors were logged during the entire render/mount cycle
    expect(errorSpy).not.toHaveBeenCalled();

    // We might allow some warnings, but let's check for "ReferenceError" specifically
    const hasReferenceError = errorSpy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === "string" && arg.includes("ReferenceError"))
    );
    expect(hasReferenceError).toBe(false);

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should show error screen if bootstrap fails with critical errors", async () => {
    const mockStartBootstrap = vi.fn().mockResolvedValue({
      success: false,
      errors: ["VITE_SUPABASE_URL is required"],
      warnings: [],
      duration: 10,
    });

    (useBootstrapModule.useBootstrap as any).mockReturnValue({
      status: "error",
      progress: "Bootstrap failed",
      step: 0,
      errors: ["VITE_SUPABASE_URL is required"],
      warnings: [],
      result: null,
      startBootstrap: mockStartBootstrap,
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <BootstrapGuard>
          <div>Should not see this</div>
        </BootstrapGuard>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Critical Configuration Error/i)).toBeInTheDocument();
      expect(screen.getByText(/VITE_SUPABASE_URL is required/i)).toBeInTheDocument();
    });
  });

  it("should render children immediately for non-critical errors", async () => {
    const mockStartBootstrap = vi.fn().mockResolvedValue({
      success: false,
      errors: ["Agent health check failed"], // Non-critical error
      warnings: [],
      duration: 10,
    });

    (useBootstrapModule.useBootstrap as any).mockReturnValue({
      status: "error",
      progress: "Bootstrap failed",
      step: 0,
      errors: ["Agent health check failed"],
      warnings: [],
      result: null,
      startBootstrap: mockStartBootstrap,
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <BootstrapGuard>
          <div data-testid="main-content">Should see this despite error</div>
        </BootstrapGuard>
      </MemoryRouter>
    );

    // Children should still render for non-critical errors
    expect(screen.getByTestId("main-content")).toBeInTheDocument();
    expect(screen.getByText(/Should see this despite error/i)).toBeInTheDocument();
  });
});
