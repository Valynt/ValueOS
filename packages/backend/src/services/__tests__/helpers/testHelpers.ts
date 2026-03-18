/**
 * Test Helpers and Mocks
 *
 * Shared utilities for service testing including Supabase mocks,
 * Redis mocks, and LLM gateway mocks.
 */

import { vi } from "vitest";

// Mock Supabase client
export const createMockSupabase = () => {
  const mockData: Map<string, unknown[]> = new Map();

  return {
    from: vi.fn((table: string) => ({
      select: vi.fn((columns = "*") => ({
        eq: vi.fn((column: string, value: unknown) => ({
          single: vi.fn(() => {
            const data = mockData.get(table) || [];
            const found = data.find((d: Record<string, unknown>) => d[column] === value);
            return Promise.resolve({ data: found || null, error: found ? null : { message: "Not found" } });
          }),
          maybeSingle: vi.fn(() => {
            const data = mockData.get(table) || [];
            const found = data.find((d: Record<string, unknown>) => d[column] === value);
            return Promise.resolve({ data: found || null, error: null });
          }),
          order: vi.fn(() => ({
            limit: vi.fn((n: number) => Promise.resolve({
              data: (mockData.get(table) || []).slice(0, n),
              error: null,
            })),
          })),
        })),
        in: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: mockData.get(table) || [], error: null })),
        })),
        ilike: vi.fn(() => ({
          limit: vi.fn((n: number) => Promise.resolve({
            data: (mockData.get(table) || []).slice(0, n),
            error: null,
          })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn((n: number) => Promise.resolve({
            data: (mockData.get(table) || []).slice(0, n),
            error: null,
          })),
        })),
      }),
      insert: vi.fn((data: unknown) => {
        const existing = mockData.get(table) || [];
        const newData = Array.isArray(data) ? data : [data];
        mockData.set(table, [...existing, ...newData]);
        return Promise.resolve({ data: newData, error: null });
      }),
      update: vi.fn((data: unknown) => ({
        eq: vi.fn((column: string, value: unknown) => {
          const existing = mockData.get(table) || [];
          const updated = existing.map((item: Record<string, unknown>) =>
            item[column] === value ? { ...item, ...data } : item,
          );
          mockData.set(table, updated);
          return Promise.resolve({ data: updated, error: null });
        }),
      })),
      upsert: vi.fn((data: unknown) => {
        const existing = mockData.get(table) || [];
        const newData = Array.isArray(data) ? data : [data];
        mockData.set(table, [...existing, ...newData]);
        return Promise.resolve({ data: newData, error: null });
      }),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    rpc: vi.fn((fn: string, params: unknown) => Promise.resolve({ data: null, error: null })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
    _mockData: mockData,
    _clearMocks: () => mockData.clear(),
  };
};

// Mock Redis client
export const createMockRedis = () => {
  const store: Map<string, { value: string; ttl?: number }> = new Map();

  return {
    get: vi.fn((key: string) => {
      const item = store.get(key);
      if (!item) return Promise.resolve(null);
      if (item.ttl && Date.now() > item.ttl) {
        store.delete(key);
        return Promise.resolve(null);
      }
      return Promise.resolve(item.value);
    }),
    set: vi.fn((key: string, value: string, options?: { ex?: number }) => {
      store.set(key, {
        value,
        ttl: options?.ex ? Date.now() + options.ex * 1000 : undefined,
      });
      return Promise.resolve("OK");
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    exists: vi.fn((key: string) => Promise.resolve(store.has(key) ? 1 : 0)),
    expire: vi.fn(() => Promise.resolve(1)),
    ttl: vi.fn(() => Promise.resolve(3600)),
    _store: store,
    _clear: () => store.clear(),
  };
};

// Mock Logger
export const createMockLogger = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(() => createMockLogger()),
});

// Mock LLM Gateway
export const createMockLLMGateway = () => ({
  complete: vi.fn(() => Promise.resolve({
    content: JSON.stringify({
      value_drivers: [],
      hypotheses: [],
      narrative: "Test narrative",
    }),
    usage: { tokens: 100 },
  })),
  stream: vi.fn(() => Promise.resolve({
    [Symbol.asyncIterator]: async function* () {
      yield { content: "Test" };
    },
  })),
});

// Test data factories
export const factories = {
  tenant: (overrides = {}) => ({
    id: crypto.randomUUID(),
    name: "Test Tenant",
    slug: "test-tenant",
    tier: "standard",
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  user: (overrides = {}) => ({
    id: crypto.randomUUID(),
    email: "test@example.com",
    role: "member",
    tenant_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  valueCase: (overrides = {}) => ({
    id: crypto.randomUUID(),
    tenant_id: crypto.randomUUID(),
    title: "Test Value Case",
    status: "draft",
    account_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  scenario: (overrides = {}) => ({
    id: crypto.randomUUID(),
    tenant_id: crypto.randomUUID(),
    case_id: crypto.randomUUID(),
    scenario_type: "base",
    roi: 150,
    npv: 500000,
    payback_months: 12,
    evf_decomposition_json: {
      revenue_uplift: 200000,
      cost_reduction: 150000,
      risk_mitigation: 100000,
      efficiency_gain: 50000,
    },
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  assumption: (overrides = {}) => ({
    id: crypto.randomUUID(),
    tenant_id: crypto.randomUUID(),
    case_id: crypto.randomUUID(),
    name: "Test Assumption",
    value: 100,
    unit: "USD",
    source_type: "customer-confirmed",
    confidence_score: 0.8,
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  benchmark: (overrides = {}) => ({
    id: crypto.randomUUID(),
    tenant_id: crypto.randomUUID(),
    metric_name: "ROI",
    p25: 100,
    p50: 150,
    p75: 200,
    p90: 250,
    source: "Industry Research",
    sample_size: 500,
    date: new Date().toISOString(),
    ...overrides,
  }),
};

// Async test utilities
export const asyncUtils = {
  // Wait for a condition with timeout
  waitFor: async (
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100,
  ): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) return;
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  },

  // Retry a function with exponential backoff
  retry: async <T>(
    fn: () => Promise<T>,
    retries = 3,
    baseDelay = 100,
  ): Promise<T> => {
    let lastError: Error;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e as Error;
        await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, i)));
      }
    }
    throw lastError!;
  },

  // Measure execution time
  measureTime: async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  },
};

// Security assertion helpers
export const securityAssertions = {
  // Assert no SQL injection in query
  assertNoSqlInjection: (query: string) => {
    const dangerous = [";", "--", "/*", "*/", "xp_", "sp_", "DROP", "DELETE", "INSERT", "UPDATE"];
    const found = dangerous.filter((d) => query.toUpperCase().includes(d));
    if (found.length > 0) {
      throw new Error(`Potential SQL injection detected: ${found.join(", ")}`);
    }
  },

  // Assert tenant isolation
  assertTenantIsolation: (data: { tenant_id: string }, expectedTenantId: string) => {
    if (data.tenant_id !== expectedTenantId) {
      throw new Error(`Tenant isolation violation: expected ${expectedTenantId}, got ${data.tenant_id}`);
    }
  },

  // Assert no PII leak
  assertNoPIILeak: (data: unknown, sensitiveFields = ["email", "phone", "ssn", "password"]) => {
    const str = JSON.stringify(data);
    for (const field of sensitiveFields) {
      if (str.includes(field)) {
        throw new Error(`Potential PII leak detected: ${field}`);
      }
    }
  },
};
