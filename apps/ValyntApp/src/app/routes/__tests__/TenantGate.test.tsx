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

function renderGate(initialPath = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<TenantGate />}>
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          <Route path="/create-org" element={<div>Create Org Page</div>} />
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

    expect(screen.getByText("Loading workspace...")).toBeTruthy();
    expect(screen.queryByText("Dashboard Content")).toBeNull();
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

    expect(screen.getByText("Unable to load workspace")).toBeTruthy();
    expect(screen.getByText("Network failure")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("redirects to create-org when no tenant is available", () => {
    mockUseTenant.mockReturnValue({
      currentTenant: null,
      tenants: [],
      isLoading: false,
      error: null,
      refreshTenants: vi.fn(),
    });

    renderGate();

    expect(screen.getByText("Create Org Page")).toBeTruthy();
    expect(screen.queryByText("Dashboard Content")).toBeNull();
  });

  it("does not block create-org route even when tenant list is empty", () => {
    mockUseTenant.mockReturnValue({
      currentTenant: null,
      tenants: [],
      isLoading: false,
      error: null,
      refreshTenants: vi.fn(),
    });

    renderGate("/create-org");

    expect(screen.getByText("Create Org Page")).toBeTruthy();
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

    expect(screen.getByText("Dashboard Content")).toBeTruthy();
    expect(screen.queryByText("Loading workspace...")).toBeNull();
  });
});
