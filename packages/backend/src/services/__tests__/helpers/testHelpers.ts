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
  const tableClients = new Map<string, ReturnType<typeof createTableClient>>();

  type Row = Record<string, unknown>;
  type Filter =
    | { type: "eq"; column: string; value: unknown }
    | { type: "is"; column: string; value: unknown }
    | { type: "in"; column: string; values: unknown[] }
    | { type: "ilike"; column: string; pattern: string };

  const getRows = (table: string): Row[] => [...((mockData.get(table) || []) as Row[])];

  const setRows = (table: string, rows: Row[]) => {
    mockData.set(table, rows);
  };

  const matchesILike = (value: unknown, pattern: string): boolean => {
    if (typeof value !== "string") return false;

    const normalizedPattern = pattern.replace(/^%+|%+$/g, "").toLowerCase();
    if (!normalizedPattern) return true;
    return value.toLowerCase().includes(normalizedPattern);
  };

  const applyFilters = (rows: Row[], filters: Filter[]): Row[] =>
    rows.filter((row) =>
      filters.every((filter) => {
        switch (filter.type) {
          case "eq":
            return row[filter.column] === filter.value;
          case "is":
            return filter.value === null ? row[filter.column] == null : row[filter.column] === filter.value;
          case "in":
            return filter.values.includes(row[filter.column]);
          case "ilike":
            return matchesILike(row[filter.column], filter.pattern);
          default:
            return true;
        }
      })
    );

  const createSelectBuilder = (table: string) => {
    const filters: Filter[] = [];
    let orderBy: { column: string; ascending: boolean } | null = null;
    let limitCount: number | null = null;
    let rangeValues: { from: number; to: number } | null = null;

    const buildRows = () => {
      let rows = applyFilters(getRows(table), filters);

      if (orderBy) {
        const { column, ascending } = orderBy;
        rows = rows.sort((a, b) => {
          const left = a[column];
          const right = b[column];
          if (left === right) return 0;
          if (left == null) return ascending ? -1 : 1;
          if (right == null) return ascending ? 1 : -1;
          return (left < right ? -1 : 1) * (ascending ? 1 : -1);
        });
      }

      if (rangeValues) {
        rows = rows.slice(rangeValues.from, rangeValues.to + 1);
      }

      if (typeof limitCount === "number") {
        rows = rows.slice(0, limitCount);
      }

      return rows;
    };

    const resolve = () => Promise.resolve({ data: buildRows(), error: null });

    const builder = {
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ type: "eq", column, value });
        return builder;
      }),
      is: vi.fn((column: string, value: unknown) => {
        filters.push({ type: "is", column, value });
        return builder;
      }),
      in: vi.fn((column: string, values: unknown[]) => {
        filters.push({ type: "in", column, values });
        return builder;
      }),
      ilike: vi.fn((column: string, pattern: string) => {
        filters.push({ type: "ilike", column, pattern });
        return builder;
      }),
      order: vi.fn((column: string, options?: { ascending?: boolean }) => {
        orderBy = { column, ascending: options?.ascending ?? true };
        return builder;
      }),
      limit: vi.fn((count: number) => {
        limitCount = count;
        return builder;
      }),
      range: vi.fn((from: number, to: number) => {
        rangeValues = { from, to };
        return builder;
      }),
      single: vi.fn(() => {
        const rows = buildRows();
        const first = rows[0] ?? null;
        return Promise.resolve({
          data: first,
          error: first ? null : { message: "Not found" },
        });
      }),
      maybeSingle: vi.fn(() => {
        const rows = buildRows();
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      }),
      then: (onFulfilled?: (value: { data: Row[]; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
        resolve().then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) => resolve().catch(onRejected),
      finally: (onFinally?: () => void) => resolve().finally(onFinally),
    };

    return builder;
  };

  const createMutationBuilder = (table: string, mode: "update" | "delete", payload?: unknown) => {
    const filters: Filter[] = [];

    const execute = () => {
      const existingRows = getRows(table);
      const matchedRows = applyFilters(existingRows, filters);

      if (mode === "delete") {
        const remainingRows = existingRows.filter((row) => !matchedRows.includes(row));
        setRows(table, remainingRows);
        return Promise.resolve({ data: matchedRows, error: null });
      }

      const updates = (payload || {}) as Row;
      const updatedRows = existingRows.map((row) =>
        matchedRows.includes(row) ? { ...row, ...updates } : row,
      );
      setRows(table, updatedRows);

      return Promise.resolve({
        data: applyFilters(updatedRows, filters),
        error: null,
      });
    };

    const builder = {
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ type: "eq", column, value });
        return builder;
      }),
      is: vi.fn((column: string, value: unknown) => {
        filters.push({ type: "is", column, value });
        return builder;
      }),
      in: vi.fn((column: string, values: unknown[]) => {
        filters.push({ type: "in", column, values });
        return builder;
      }),
      then: (
        onFulfilled?: (value: { data: Row[]; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => execute().then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) => execute().catch(onRejected),
      finally: (onFinally?: () => void) => execute().finally(onFinally),
    };

    return builder;
  };

  function createTableClient(table: string) {
    return {
      select: vi.fn((_columns = "*") => createSelectBuilder(table)),
      insert: vi.fn((data: unknown) => {
        const existing = mockData.get(table) || [];
        const newData = Array.isArray(data) ? data : [data];
        mockData.set(table, [...existing, ...newData]);
        return Promise.resolve({ data: newData, error: null });
      }),
      update: vi.fn((data: unknown) => createMutationBuilder(table, "update", data)),
      upsert: vi.fn((data: unknown) => {
        const existing = mockData.get(table) || [];
        const newData = Array.isArray(data) ? data : [data];
        mockData.set(table, [...existing, ...newData]);
        return Promise.resolve({ data: newData, error: null });
      }),
      delete: vi.fn(() => createMutationBuilder(table, "delete")),
    };
  }

  return {
    from: vi.fn((table: string) => {
      const existing = tableClients.get(table);
      if (existing) return existing;

      const client = createTableClient(table);
      tableClients.set(table, client);
      return client;
    }),
    rpc: vi.fn((fn: string, params: unknown) => Promise.resolve({ data: null, error: null })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
    _mockData: mockData,
    _clearMocks: () => {
      mockData.clear();
      tableClients.clear();
    },
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
