import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { RouteGuard } from "@/components/RouteGuard";
import { catchAllRoute, protectedRoutes, publicRoutes } from "@/routes";

const mockSetLocation = vi.fn();

vi.mock("wouter", () => ({
  useLocation: () => ["/dashboard", mockSetLocation],
}));

const mockUseAuth = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("VOS Academy route guard", () => {
  it("redirects unauthenticated users to the home route", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      user: null,
    });

    render(
      <RouteGuard>
        <div>Protected</div>
      </RouteGuard>
    );

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith("/?redirect=%2Fdashboard");
    });
  });

  it("redirects users without the required role", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: "1", role: "learner" },
    });

    render(
      <RouteGuard requiredRole="admin">
        <div>Protected</div>
      </RouteGuard>
    );

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith("/?error=forbidden");
    });
  });

  it("renders protected content for authorized users", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: "1", role: "admin" },
    });

    render(
      <RouteGuard requiredRole="admin">
        <div>Protected</div>
      </RouteGuard>
    );

    expect(screen.getByText("Protected")).toBeInTheDocument();
  });

  it("exposes only the intended route paths", () => {
    expect(publicRoutes.map((route) => route.path)).toEqual(["/", "/404"]);
    expect(protectedRoutes.map((route) => route.path)).toEqual([
      "/dashboard",
      "/pillar/:pillarNumber",
      "/quiz/:pillarNumber",
      "/ai-tutor",
      "/profile",
      "/resources",
      "/certifications",
      "/simulations",
      "/simulation-progress",
      "/analytics",
      "/value-tree-builder",
    ]);
    expect(catchAllRoute.component).toBeDefined();
  });
});
