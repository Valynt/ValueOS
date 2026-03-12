/**
 * Route/state boundary regression tests.
 *
 * Replaces stale TODO placeholders with executable assertions around
 * auth and tenant gate boundaries.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute, PublicOnlyRoute } from "../app/routes/route-guards";

const mockUseAuth = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function LocationEcho() {
  const location = useLocation();
  return <pre data-testid="location-state">{JSON.stringify(location.state ?? null)}</pre>;
}

describe("Route/State Boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to /login and preserves from-location state", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(
      <MemoryRouter initialEntries={["/dashboard?tab=finance"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/login" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Dashboard")).toBeNull();
    const stateText = screen.getByTestId("location-state").textContent ?? "";
    expect(stateText).toContain('"pathname":"/dashboard"');
    expect(stateText).toContain('"search":"?tab=finance"');
  });

  it("renders protected content when user is authenticated", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u-1" }, loading: false });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.queryByText("Login")).toBeNull();
  });

  it("redirects authenticated users away from public-only routes", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u-2" }, loading: false });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>Login</div>} />
          </Route>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.queryByText("Login")).toBeNull();
  });

  it("keeps unauthenticated users on public-only routes", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>Login</div>} />
          </Route>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login")).toBeTruthy();
    expect(screen.queryByText("Dashboard")).toBeNull();
  });
});
