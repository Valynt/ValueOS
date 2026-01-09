// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { BootstrapGuard } from "../BootstrapGuard";
import { describe, expect, it, vi } from "vitest";
import { useBootstrap } from "../../../hooks/useBootstrap";
import React from "react";

// Mock the hook so we control the state
vi.mock("../../../hooks/useBootstrap");

describe("BootstrapGuard", () => {
  it("shows loading spinner initially", () => {
    (useBootstrap as any).mockReturnValue({
      isInitialized: false,
      error: null,
    });
    render(
      <BootstrapGuard>
        <div>App Content</div>
      </BootstrapGuard>
    );
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("shows error state if bootstrapping fails", () => {
    (useBootstrap as any).mockReturnValue({
      isInitialized: false,
      error: new Error("Failed"),
    });
    render(
      <BootstrapGuard>
        <div>App Content</div>
      </BootstrapGuard>
    );
    expect(screen.getByText(/Failed/i)).toBeInTheDocument();
  });

  it("renders children when initialized", () => {
    (useBootstrap as any).mockReturnValue({ isInitialized: true, error: null });
    render(
      <BootstrapGuard>
        <div>App Content</div>
      </BootstrapGuard>
    );
    expect(screen.getByText("App Content")).toBeInTheDocument();
  });
});
