/**
 * ProtectedRoute unit tests
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, vi } from "vitest";

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../../../contexts/AuthContext";
import { ProtectedRoute } from "../route-guards";

const mockedUseAuth = vi.mocked(useAuth);

function renderProtectedRoute() {
  render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const baseAuth = {
  userClaims: null,
  session: null,
  isAuthenticated: false,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  resetPassword: vi.fn(),
  updatePassword: vi.fn(),
  resendVerificationEmail: vi.fn(),
  signInWithProvider: vi.fn(),
};

describe("ProtectedRoute", () => {
  it("redirects unauthenticated user to /login", () => {
    mockedUseAuth.mockReturnValue({ ...baseAuth, user: null, loading: false });
    renderProtectedRoute();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders Outlet when user is authenticated", () => {
    mockedUseAuth.mockReturnValue({
      ...baseAuth,
      user: { id: "user-1" } as never,
      loading: false,
      isAuthenticated: true,
    });
    renderProtectedRoute();
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("renders Authenticating... and does not redirect while loading", () => {
    mockedUseAuth.mockReturnValue({ ...baseAuth, user: null, loading: true });
    renderProtectedRoute();
    expect(screen.getByText("Authenticating...")).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });
});
