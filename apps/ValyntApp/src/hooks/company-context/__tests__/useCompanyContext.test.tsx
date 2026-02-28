/**
 * useCompanyContext Hook Tests
 * Tests company context queries and onboarding mutations
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useAddClaimGovernance,
  useAddCompetitors,
  useAddPersonas,
  useCompanyContext,
  useCompleteOnboarding,
  useCreateCompanyContext,
  useOnboardingStatus,
} from "../useCompanyContext";

// Mock supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";

// Helper to create chainable mock
const createChainableMock = () => {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
  return chainable as unknown as ReturnType<typeof createChainableMock> & {
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };
};

// React Query wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock data
const mockTenantId = "tenant-123";
const mockContextId = "context-456";

const mockContext = {
  id: mockContextId,
  tenant_id: mockTenantId,
  company_name: "Acme Corp",
  website_url: "https://acme.com",
  industry: "Technology",
  company_size: "enterprise",
  sales_motion: "new_logo",
  onboarding_status: "completed",
  version: 1,
  created_at: "2026-02-09T00:00:00Z",
  updated_at: "2026-02-09T00:00:00Z",
};

const mockProducts = [
  { id: "prod-1", context_id: mockContextId, tenant_id: mockTenantId, name: "Platform", product_type: "platform" },
];

const mockCompetitors = [
  { id: "comp-1", context_id: mockContextId, tenant_id: mockTenantId, name: "Competitor Inc", relationship: "direct" },
];

const mockPersonas = [
  { id: "pers-1", context_id: mockContextId, tenant_id: mockTenantId, title: "CTO", persona_type: "decision_maker" },
];

describe("useCompanyContext", () => {
  const Wrapper = createWrapper();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useCompanyContext query", () => {
    it("should be disabled when tenantId is undefined", () => {
      const { result } = renderHook(() => useCompanyContext(undefined), {
        wrapper: Wrapper,
      });

      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should return null when no context exists", async () => {
      const mock = createChainableMock();
      mock.maybeSingle.mockResolvedValue({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(mock as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useCompanyContext(mockTenantId), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });

    it("should return hydrated CompanyValueContext on success", async () => {
      // Create fresh wrapper for this test
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const TestWrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Mock parallel queries for related data - need to handle .then() pattern
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        const chainable = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(),
        };

        if (table === "company_contexts") {
          chainable.maybeSingle.mockResolvedValue({ data: mockContext, error: null });
        } else if (table === "company_products") {
          // The hook uses .eq(...).then((r) => r.data ?? [])
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
          } as unknown as ReturnType<typeof supabase.from>;
        } else if (table === "company_capabilities") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as unknown as ReturnType<typeof supabase.from>;
        } else if (table === "company_competitors") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockCompetitors, error: null }),
          } as unknown as ReturnType<typeof supabase.from>;
        } else if (table === "company_personas") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockPersonas, error: null }),
          } as unknown as ReturnType<typeof supabase.from>;
        } else if (table === "company_value_patterns") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as unknown as ReturnType<typeof supabase.from>;
        } else if (table === "company_claim_governance") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return chainable as unknown as ReturnType<typeof supabase.from>;
      });

      const { result } = renderHook(() => useCompanyContext(mockTenantId), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 3000 });

      expect(result.current.data?.context.company_name).toBe("Acme Corp");
      expect(result.current.data?.products).toEqual(mockProducts);
    });

    it("should throw on database error", async () => {
      const mock = createChainableMock();
      mock.maybeSingle.mockResolvedValue({ data: null, error: { message: "DB error" } });
      vi.mocked(supabase.from).mockReturnValue(mock as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useCompanyContext(mockTenantId), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe("useOnboardingStatus query", () => {
    it("should return 'none' when no context exists", async () => {
      const mock = createChainableMock();
      mock.maybeSingle.mockResolvedValue({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(mock as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useOnboardingStatus(mockTenantId), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe("none");
    });

    it("should return status when context exists", async () => {
      // Create fresh wrapper for this test
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const TestWrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      vi.mocked(supabase.from).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { onboarding_status: "completed" }, error: null }),
      } as unknown as ReturnType<typeof supabase.from>));

      const { result } = renderHook(() => useOnboardingStatus(mockTenantId), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 3000 });

      expect(result.current.data).toBe("completed");
    });
  });

  describe("useCreateCompanyContext mutation", () => {
    it("should create context with products", async () => {
      // Create a fresh wrapper for each test to avoid cache issues
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      const TestWrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const mockSingle = vi.fn().mockResolvedValue({
        data: { ...mockContext, id: mockContextId },
        error: null,
      });
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "company_contexts") {
          return {
            insert: mockInsert,
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        } as unknown as ReturnType<typeof supabase.from>;
      });

      const { result } = renderHook(() => useCreateCompanyContext(mockTenantId), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        result.current.mutate({
          company_name: "Acme Corp",
          website_url: "https://acme.com",
          industry: "Technology",
          company_size: "enterprise",
          sales_motion: "new_logo",
          products: [{ name: "Platform", description: "Main platform", product_type: "platform" }],
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 3000 });
    });
  });

  describe("useAddCompetitors mutation", () => {
    it("should insert competitors", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useAddCompetitors(mockTenantId, mockContextId), {
        wrapper: Wrapper,
      });

      await act(async () => {
        result.current.mutate({
          competitors: [{ name: "Competitor Inc", relationship: "direct" }],
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe("useAddPersonas mutation", () => {
    it("should insert personas", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useAddPersonas(mockTenantId, mockContextId), {
        wrapper: Wrapper,
      });

      await act(async () => {
        result.current.mutate({
          personas: [{
            title: "CTO",
            persona_type: "decision_maker",
            seniority: "c_suite",
            typical_kpis: ["Revenue"],
            pain_points: ["Legacy systems"],
          }],
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe("useAddClaimGovernance mutation", () => {
    it("should insert claim governance", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useAddClaimGovernance(mockTenantId, mockContextId), {
        wrapper: Wrapper,
      });

      await act(async () => {
        result.current.mutate({
          claim_governance: [{
            claim_text: "50% cost reduction",
            risk_level: "conditional",
            category: "cost",
          }],
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe("useCompleteOnboarding mutation", () => {
    it("should create version snapshot and mark completed", async () => {
      // Create a fresh wrapper for each test to avoid cache issues
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      const TestWrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const mockSingle = vi.fn().mockResolvedValue({
        data: { ...mockContext, version: 1 },
        error: null,
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "company_contexts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockSingle,
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === "company_context_versions") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      const { result } = renderHook(() => useCompleteOnboarding(mockTenantId, mockContextId), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 3000 });
    });
  });
});
