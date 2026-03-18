import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, vi } from "vitest";

import { useAuth } from "../../../contexts/AuthContext";
import { Permission, PERMISSIONS } from "../../../lib/permissions";
import { PermissionRoute } from "../route-guards";

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function renderPermissionRoute(requiredPermissions: Permission[]) {
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route element={<PermissionRoute requiredPermissions={requiredPermissions} />}>
          <Route path="/admin" element={<div>Admin Area</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PermissionRoute", () => {
  it("redirects unauthenticated users to login", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      userClaims: null,
      session: null,
      loading: false,
      isAuthenticated: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      resendVerificationEmail: vi.fn(),
      signInWithProvider: vi.fn(),
    });

    renderPermissionRoute([PERMISSIONS.ADMIN_ACCESS]);

    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("redirects authenticated users without required permission", () => {
    mockedUseAuth.mockReturnValue({
      user: { id: "user-1" } as never,
      userClaims: {
        sub: "user-1",
        email: "member@example.com",
        roles: ["ANALYST"],
        permissions: [PERMISSIONS.DASHBOARD_VIEW],
        org_id: "org-1",
      },
      session: null,
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      resendVerificationEmail: vi.fn(),
      signInWithProvider: vi.fn(),
    });

    renderPermissionRoute([PERMISSIONS.ADMIN_ACCESS]);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("allows users with required permission", () => {
    mockedUseAuth.mockReturnValue({
      user: { id: "user-2" } as never,
      userClaims: {
        sub: "user-2",
        email: "admin@example.com",
        roles: ["ANALYST"],
        permissions: [PERMISSIONS.ADMIN_ACCESS],
        org_id: "org-1",
      },
      session: null,
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      resendVerificationEmail: vi.fn(),
      signInWithProvider: vi.fn(),
    });

    renderPermissionRoute([PERMISSIONS.ADMIN_ACCESS]);

    expect(screen.getByText("Admin Area")).toBeInTheDocument();
  });

  it("allows admin role without explicit permission", () => {
    mockedUseAuth.mockReturnValue({
      user: { id: "user-3" } as never,
      userClaims: {
        sub: "user-3",
        email: "platform-admin@example.com",
        roles: ["ADMIN"],
        permissions: [],
        org_id: "org-1",
      },
      session: null,
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      resendVerificationEmail: vi.fn(),
      signInWithProvider: vi.fn(),
    });

    renderPermissionRoute([PERMISSIONS.ADMIN_ACCESS]);

    expect(screen.getByText("Admin Area")).toBeInTheDocument();
  });
});
