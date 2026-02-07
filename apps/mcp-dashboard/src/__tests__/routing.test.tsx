import { render, screen } from "@testing-library/react";
import React from "react";
import { Outlet } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import {
  adminRoutes,
  catchAllRoute,
  protectedRoutes,
  publicRoutes,
} from "../routeConfig";

const mockUseAuth = vi.fn();
const mockUseWebSocket = vi.fn(() => ({
  notifications: [],
  clearNotifications: vi.fn(),
  connectionStatus: "connected",
  subscribe: vi.fn(() => () => {}),
  unsubscribe: vi.fn(),
  isConnected: true,
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("../contexts/WebSocketContext", () => ({
  useWebSocket: () => mockUseWebSocket(),
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("../components/layout/DashboardLayout", () => ({
  default: () => (
    <div data-testid="layout">
      <Outlet />
    </div>
  ),
}));

vi.mock("../pages/Dashboard", () => ({
  default: () => <div>Dashboard Page</div>,
}));

vi.mock("../pages/AdminPanel", () => ({
  default: () => <div>Admin Panel</div>,
}));

vi.mock("../pages/Login", () => ({
  default: () => <div>Login Page</div>,
}));

describe("mcp-dashboard routing", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseWebSocket.mockClear();
  });

  it("redirects unauthenticated users from /dashboard to /login", async () => {
    window.history.pushState({}, "Test", "/dashboard");
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(<App />);

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  it("blocks non-admin users from /admin and routes them to /dashboard", async () => {
    window.history.pushState({}, "Test", "/admin");
    mockUseAuth.mockReturnValue({
      user: { id: "1", role: "user" },
      loading: false,
    });

    render(<App />);

    expect(await screen.findByText("Dashboard Page")).toBeInTheDocument();
    expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
  });

  it("routes unknown paths through the catch-all redirect without rendering protected content", async () => {
    window.history.pushState({}, "Test", "/unknown");
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(<App />);

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  it("exposes only the intended route paths", () => {
    expect(publicRoutes.map((route) => route.path)).toEqual(["/login"]);
    expect(protectedRoutes.map((route) => route.path)).toEqual([
      "dashboard",
      "companies",
      "companies/:cik",
      "sentiment",
      "forecasting",
      "api-management",
    ]);
    expect(adminRoutes.map((route) => route.path)).toEqual(["admin"]);
    expect(catchAllRoute).toEqual({ path: "*", redirectTo: "/dashboard" });
  });
});
