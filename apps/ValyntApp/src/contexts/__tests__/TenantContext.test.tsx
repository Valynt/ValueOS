/**
 * TenantContext Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { TenantProvider, useTenant } from "../TenantContext";
import { AuthProvider } from "../AuthContext";
import * as tenantApi from "../../api/tenant";

vi.mock("../../api/tenant", () => ({
  fetchUserTenants: vi.fn(),
  isTenantApiEnabled: vi.fn(() => true),
}));

vi.mock("../AuthContext", async () => {
  const actual = await vi.importActual("../AuthContext");
  return {
    ...actual,
    useAuth: vi.fn(() => ({
      user: { id: "test-user-id" },
      isAuthenticated: true,
      loading: false,
    })),
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <TenantProvider>{children}</TenantProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe("TenantContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should provide tenant context", async () => {
    const mockTenants = [
      {
        id: "tenant-1",
        name: "Test Tenant",
        slug: "test-tenant",
        color: "#18C3A5",
        role: "admin",
        status: "active" as const,
        createdAt: new Date().toISOString(),
      },
    ];

    vi.mocked(tenantApi.fetchUserTenants).mockResolvedValue({
      data: mockTenants,
      error: null,
    });

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tenants).toHaveLength(1);
    expect(result.current.currentTenant?.id).toBe("tenant-1");
  });

  it("should handle empty tenant list", async () => {
    vi.mocked(tenantApi.fetchUserTenants).mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tenants).toHaveLength(0);
    expect(result.current.currentTenant).toBeNull();
  });

  it("should handle API errors", async () => {
    vi.mocked(tenantApi.fetchUserTenants).mockResolvedValue({
      data: null,
      error: new Error("API Error"),
    });

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.tenants).toHaveLength(0);
  });

  it("should validate tenant access", async () => {
    const mockTenants = [
      {
        id: "tenant-1",
        name: "Test Tenant",
        slug: "test-tenant",
        color: "#18C3A5",
        role: "admin",
        status: "active" as const,
        createdAt: new Date().toISOString(),
      },
    ];

    vi.mocked(tenantApi.fetchUserTenants).mockResolvedValue({
      data: mockTenants,
      error: null,
    });

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.validateTenantAccess("tenant-1")).toBe(true);
    expect(result.current.validateTenantAccess("tenant-2")).toBe(false);
  });
});
