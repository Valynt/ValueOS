import { vi } from "vitest";

export type DeterministicQueueJob<TPayload> = {
  id: string;
  name: string;
  payload: TPayload;
};

export type DeterministicQueue<TPayload> = {
  add: (name: string, payload: TPayload) => Promise<DeterministicQueueJob<TPayload>>;
  drain: () => Promise<void>;
  jobs: DeterministicQueueJob<TPayload>[];
};

export function createDeterministicQueue<TPayload>(): DeterministicQueue<TPayload> {
  const jobs: DeterministicQueueJob<TPayload>[] = [];

  return {
    jobs,
    add: async (name, payload) => {
      const job = {
        id: `${jobs.length + 1}`,
        name,
        payload,
      };
      jobs.push(job);
      return job;
    },
    drain: async () => {
      jobs.length = 0;
    },
  };
}

export function bootstrapDeterministicEnv(overrides: Record<string, string> = {}): void {
  const defaults: Record<string, string> = {
    SUPABASE_URL: "http://localhost:54321",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    SUPABASE_ANON_KEY: "test-anon-key",
    REDIS_URL: "redis://localhost:6379",
    TCT_SECRET: "test-tct-secret-32-bytes-minimum!!",
  };

  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    process.env[key] = value;
  }
}

export function createDeterministicDbClient() {
  const rowsByTable = new Map<string, Array<Record<string, unknown>>>();

  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => Promise.resolve({ data: rowsByTable.get(table) ?? [], error: null })),
      insert: vi.fn((rows: Record<string, unknown> | Array<Record<string, unknown>>) => {
        const normalizedRows = Array.isArray(rows) ? rows : [rows];
        rowsByTable.set(table, [...(rowsByTable.get(table) ?? []), ...normalizedRows]);
        return Promise.resolve({ data: normalizedRows, error: null });
      }),
      delete: vi.fn(() => ({
        eq: vi.fn((_column: string, value: unknown) => {
          const existingRows = rowsByTable.get(table) ?? [];
          const filtered = existingRows.filter((row) => row.id !== value);
          rowsByTable.set(table, filtered);
          return Promise.resolve({ data: filtered, error: null });
        }),
      })),
    })),
    reset: () => rowsByTable.clear(),
    seed: (table: string, rows: Array<Record<string, unknown>>) => {
      rowsByTable.set(table, [...rows]);
    },
  };
}

export function createDeterministicAgentMocks() {
  return {
    llmGateway: {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({ result: "ok", hallucination_check: false }),
        usage: { tokens: 0 },
      }),
    },
    memorySystem: {
      store: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      retrieve: vi.fn().mockResolvedValue([]),
    },
  };
}
