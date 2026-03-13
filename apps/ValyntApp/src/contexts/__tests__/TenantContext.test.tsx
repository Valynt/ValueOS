/**
 * TenantContext Tests
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as tenantApi from "../../api/tenant";
import { AuthProvider } from "../AuthContext";
import { TenantProvider, useTenant } from "../TenantContext";
import { TENANT_CACHE_CLEAR_EVENT } from "../../lib/tenantCacheIsolation";

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



  it("should call onTenantSwitch callback when switching tenants", async () => {
    const mockTenants = [
      {
        id: "tenant-1",
        name: "Tenant One",
        slug: "tenant-one",
        color: "#18C3A5",
        role: "admin",
        status: "active" as const,
        createdAt: new Date().toISOString(),
      },
      {
        id: "tenant-2",
        name: "Tenant Two",
        slug: "tenant-two",
        color: "#A55DFF",
        role: "admin",
        status: "active" as const,
        createdAt: new Date().toISOString(),
      },
    ];

    vi.mocked(tenantApi.fetchUserTenants).mockResolvedValue({
      data: mockTenants,
      error: null,
    });

    const onTenantSwitch = vi.fn();

    const callbackWrapper = ({ children }: { children: React.ReactNode }) => (
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider onTenantSwitch={onTenantSwitch}>{children}</TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    const { result } = renderHook(() => useTenant(), { wrapper: callbackWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.switchTenant("tenant-2");
    });

    expect(onTenantSwitch).toHaveBeenCalledTimes(1);
    expect(onTenantSwitch).toHaveBeenCalledWith(mockTenants[0], mockTenants[1]);
    expect(result.current.currentTenant?.id).toBe("tenant-2");
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

  it("clears browser caches and emits a cache reset event when switching tenant", async () => {
    const mockTenants = [
      {
        id: "tenant-1",
        name: "Tenant One",
        slug: "tenant-one",
        color: "#18C3A5",
        role: "admin",
        status: "active" as const,
        createdAt: new Date().toISOString(),
      },
      {
        id: "tenant-2",
        name: "Tenant Two",
        slug: "tenant-two",
        color: "#18C3A5",
        role: "admin",
        status: "active" as const,
        createdAt: new Date().toISOString(),
      },
    ];

    localStorage.setItem("cache_cases", JSON.stringify({ id: "stale" }));
    localStorage.setItem("valueos-state", JSON.stringify({ id: "stale" }));
    localStorage.setItem("auth_state_persistence", JSON.stringify({ keep: true }));

    const eventHandler = vi.fn();
    window.addEventListener(TENANT_CACHE_CLEAR_EVENT, eventHandler);

    vi.mocked(tenantApi.fetchUserTenants).mockResolvedValue({
      data: mockTenants,
      error: null,
    });

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentTenant?.id).toBe("tenant-1");
    });

    await act(async () => {
      await result.current.switchTenant("tenant-2");
    });

    expect(localStorage.getItem("cache_cases")).toBeNull();
    expect(localStorage.getItem("valueos-state")).toBeNull();
    expect(localStorage.getItem("auth_state_persistence")).toBeTruthy();
    expect(eventHandler).toHaveBeenCalledTimes(1);

    window.removeEventListener(TENANT_CACHE_CLEAR_EVENT, eventHandler);
  });
});
