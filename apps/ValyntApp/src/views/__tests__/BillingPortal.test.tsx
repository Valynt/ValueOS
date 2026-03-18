/**
 * @jest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock hooks BEFORE importing component
const mockHooks = vi.hoisted(() => ({
  useBillingSummary: vi.fn(),
  usePlans: vi.fn(),
  useInvoices: vi.fn(),
  useUsage: vi.fn(),
  useApprovals: vi.fn(),
  usePlanChangePreview: vi.fn(),
  useSubmitPlanChange: vi.fn(),
  useDecideApproval: vi.fn(),
}));

vi.mock("@/hooks/useBilling", () => ({
  useBillingSummary: mockHooks.useBillingSummary,
  usePlans: mockHooks.usePlans,
  useInvoices: mockHooks.useInvoices,
  useUsage: mockHooks.useUsage,
  useApprovals: mockHooks.useApprovals,
  usePlanChangePreview: mockHooks.usePlanChangePreview,
  useSubmitPlanChange: mockHooks.useSubmitPlanChange,
  useDecideApproval: mockHooks.useDecideApproval,
}));

// Mock TenantContext
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    currentTenant: { id: "test-tenant", name: "Test Tenant" },
    tenants: [{ id: "test-tenant", name: "Test Tenant" }],
    isLoading: false,
    error: null,
    isApiEnabled: true,
    switchTenant: vi.fn(),
    refreshTenants: vi.fn(),
    validateTenantAccess: () => true,
    getTenantById: () => ({ id: "test-tenant", name: "Test Tenant" }),
  }),
}));

// Mock CanvasHost to render meter names directly
vi.mock("@/components/canvas/CanvasHost", () => ({
  CanvasHost: ({ widgets }: { widgets: any[] }) => (
    <div data-testid="canvas-host">
      {widgets?.map((widget: any) => (
        <div key={widget.id} data-testid={`widget-${widget.id}`}>
          {widget.props?.meterName && (
            <div>
              <span>{widget.props.meterName}</span>
              <span>{widget.props.trendPercentage}%</span>
            </div>
          )}
          {widget.props?.plans?.map((plan: any) => (
            <div key={plan.id}>
              <span>{plan.name}</span>
              {plan.isCurrent && <span>Current Plan</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

// Import component AFTER mocks
import { BillingPortal } from "../../views/BillingPortal";

// Create a wrapper with QueryClientProvider
function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("BillingPortal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset and setup mocks before each test
    mockHooks.useBillingSummary.mockReturnValue({
      data: {
        subscription: { id: "sub-1", status: "active", currentPlan: "Professional", currentPlanId: "pro", mrr: 299, billingPeriod: { start: "2024-01-01", end: "2024-01-31" }, renewalDate: "2024-02-01" },
        usage: { aiTokens: { used: 7500, cap: 10000, percentage: 75 }, apiCalls: { used: 50000, cap: 100000, percentage: 50 } },
        recentInvoice: { id: "inv-1", period: "Jan 2024", amount: 299, status: "paid", dueDate: "2024-01-15" },
      },
      isLoading: false,
    });
    mockHooks.usePlans.mockReturnValue({
      data: [
        { id: "starter", name: "Starter", description: "For small teams", price: 99, interval: "month", features: ["1,000 AI tokens"], limits: { aiTokens: 1000, apiCalls: 10000, seats: 5 }, isCurrent: false },
        { id: "pro", name: "Professional", description: "For growing teams", price: 299, interval: "month", features: ["10,000 AI tokens"], limits: { aiTokens: 10000, apiCalls: 100000, seats: 20 }, isCurrent: true },
      ],
      isLoading: false,
    });
    mockHooks.useInvoices.mockReturnValue({
      data: [
        { id: "inv-1", number: "INV-001", period: { start: "2024-01-01", end: "2024-01-31" }, amount: 299, status: "paid", dueDate: "2024-01-15", paidAt: "2024-01-10" },
      ],
      isLoading: false,
    });
    mockHooks.useUsage.mockReturnValue({
      data: {
        period: { start: "2024-01-01", end: "2024-01-31" },
        meters: [{ key: "ai_tokens", name: "AI Tokens", used: 7500, cap: 10000, unit: "tokens", trend: "up", trendPercentage: 15 }],
        dailyBreakdown: [{ date: "2024-01-01", aiTokens: 250, apiCalls: 1000 }],
      },
      isLoading: false,
    });
    mockHooks.useApprovals.mockReturnValue({
      data: [
        { id: "app-1", requester: { id: "u1", name: "John Doe", email: "john@example.com" }, action: "upgrade", details: "Upgrade to Enterprise", deltaMrr: 700, status: "pending", requestedAt: "2024-01-15" },
      ],
      isLoading: false,
    });
    mockHooks.usePlanChangePreview.mockReturnValue({ mutate: vi.fn(), data: null });
    mockHooks.useSubmitPlanChange.mockReturnValue({ mutate: vi.fn() });
    mockHooks.useDecideApproval.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it("renders billing portal header", () => {
    render(<BillingPortal />, { wrapper: createWrapper() });
    expect(screen.getByText("Billing Portal")).toBeInTheDocument();
    expect(screen.getByText(/Manage your subscription/i)).toBeInTheDocument();
  });

  it("displays current plan", () => {
    render(<BillingPortal />, { wrapper: createWrapper() });
    expect(screen.getByText("Professional")).toBeInTheDocument();
  });

  it("shows tabs for different sections", () => {
    render(<BillingPortal />, { wrapper: createWrapper() });
    expect(screen.getByText("Usage")).toBeInTheDocument();
    expect(screen.getByText("Plans")).toBeInTheDocument();
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByText("Approvals")).toBeInTheDocument();
  });

  it("renders invoice list", () => {
    render(<BillingPortal />, { wrapper: createWrapper() });
    // Click on Invoices tab first
    fireEvent.click(screen.getByText("Invoices"));
    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.getByText("paid")).toBeInTheDocument();
  });

  it("shows approval queue for enterprise", () => {
    render(<BillingPortal />, { wrapper: createWrapper() });
    // Click on Approvals tab first
    fireEvent.click(screen.getByText("Approvals"));
    // Check for approval content
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Upgrade to Enterprise")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
    expect(screen.getByText("Approve")).toBeInTheDocument();
  });

  it("handles approval decision", () => {
    render(<BillingPortal />, { wrapper: createWrapper() });
    // Click on Approvals tab first
    fireEvent.click(screen.getByText("Approvals"));
    fireEvent.click(screen.getByText("Approve"));
    expect(mockHooks.useDecideApproval().mutate).toHaveBeenCalled();
  });

  it("displays renewal date", () => {
    render(<BillingPortal />, { wrapper: createWrapper() });
    expect(screen.getByText(/renews/i)).toBeInTheDocument();
    expect(screen.getByText(/2024/i)).toBeInTheDocument();
  });
});
