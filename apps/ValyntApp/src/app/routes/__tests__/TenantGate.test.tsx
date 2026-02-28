import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TenantGate } from "../TenantGate";

const mockUseTenant = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => mockUseTenant(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderGate() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<TenantGate />}>
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("TenantGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ logout: vi.fn() });
  });

  it("shows loading state while tenant context is resolving", () => {
    mockUseTenant.mockReturnValue({
      currentTenant: null,
      tenants: [],
      isLoading: true,
      error: null,
      refreshTenants: vi.fn(),
    });

    renderGate();

    expect(screen.getByText("Loading workspace...")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();
  });

  it("shows error state when tenant fetch fails", () => {
    mockUseTenant.mockReturnValue({
      currentTenant: null,
      tenants: [],
      isLoading: false,
      error: new Error("Network failure"),
      refreshTenants: vi.fn(),
    });

    renderGate();

    expect(screen.getByText("Unable to load workspace")).toBeInTheDocument();
    expect(screen.getByText("Network failure")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("shows no-workspace state when user has no tenants", () => {
    mockUseTenant.mockReturnValue({
      currentTenant: null,
      tenants: [],
      isLoading: false,
      error: null,
      refreshTenants: vi.fn(),
    });

    renderGate();

    expect(screen.getByText("No workspace found")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();
  });

  it("renders child routes when tenant is available", () => {
    mockUseTenant.mockReturnValue({
      currentTenant: { id: "t-1", name: "Acme", slug: "acme" },
      tenants: [{ id: "t-1", name: "Acme", slug: "acme" }],
      isLoading: false,
      error: null,
      refreshTenants: vi.fn(),
    });

    renderGate();

    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
    expect(screen.queryByText("Loading workspace...")).not.toBeInTheDocument();
  });
});
