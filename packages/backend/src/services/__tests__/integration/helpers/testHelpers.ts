/**
 * Test Helpers for Integration Tests
 *
 * Provides mock Supabase client and factories for test data generation.
 */

import { vi } from "vitest";

export interface MockSupabaseClient {
  from: (table: string) => {
    select: (columns?: string) => MockSupabaseClient;
    insert: (data: unknown) => Promise<{ data: unknown; error: null }>;
    update: (data: unknown) => MockSupabaseClient;
    eq: (column: string, value: unknown) => MockSupabaseClient;
    single: () => Promise<{ data: unknown; error: null }>;
    order: (column: string, opts?: { ascending?: boolean }) => MockSupabaseClient;
    limit: (n: number) => MockSupabaseClient;
  };
  _mockData: Map<string, unknown[]>;
  _clearMocks: () => void;
}

export function createMockSupabase(): MockSupabaseClient {
  const mockData = new Map<string, unknown[]>();

  const mockClient: MockSupabaseClient = {
    from: (table: string) => ({
      select: () => mockClient.from(table),
      insert: async (data: unknown) => {
        const existing = mockData.get(table) || [];
        mockData.set(table, [...existing, data]);
        return { data, error: null };
      },
      update: () => mockClient.from(table),
      eq: () => mockClient.from(table),
      single: async () => {
        const data = mockData.get(table)?.[0];
        return { data: data || null, error: null };
      },
      order: () => mockClient.from(table),
      limit: () => mockClient.from(table),
    }),
    _mockData: mockData,
    _clearMocks: () => mockData.clear(),
  };

  return mockClient;
}

export const factories = {
  benchmark: (overrides: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    tenant_id: "tenant-1",
    metric_name: "ROI",
    p25: 100,
    p50: 150,
    p75: 200,
    p90: 250,
    source: "test",
    date: new Date().toISOString(),
    sample_size: 100,
    ...overrides,
  }),
  assumption: (overrides: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    tenant_id: "tenant-1",
    case_id: "case-1",
    name: "Test Assumption",
    value: 100,
    unit: "hours",
    source_type: "customer-confirmed",
    confidence_score: 0.8,
    benchmark_reference_id: null,
    ...overrides,
  }),
  case: (overrides: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    tenant_id: "tenant-1",
    title: "Test Case",
    status: "draft",
    ...overrides,
  }),
};
