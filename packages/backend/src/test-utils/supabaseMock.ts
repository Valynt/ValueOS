import { vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

export interface MockSupabaseClient {
  auth: Record<string, unknown>;
  storage: Record<string, unknown>;
  realtime: Record<string, unknown>;
  from: MockFn;
  rpc: MockFn;
  channel: MockFn;
  removeChannel: MockFn;
  getChannels: MockFn;
  removeAllChannels: MockFn;
  [key: string]: unknown;
}

export interface MockSupabaseModule {
  createUserSupabaseClient: MockFn;
  createServerSupabaseClient: MockFn;
  getSupabaseClient: MockFn;
  supabase: MockSupabaseClient;
}

function mergeSection(base: Record<string, unknown>, override: unknown): Record<string, unknown> {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return base;
  }

  return { ...base, ...override as Record<string, unknown> };
}

export function createSupabaseClientMock(
  overrides: Partial<MockSupabaseClient> = {},
): MockSupabaseClient {
  const base: MockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(),
      admin: {
        getUserById: vi.fn(),
        listUsers: vi.fn(),
        signOut: vi.fn(),
      },
    },
    storage: {
      from: vi.fn(),
    },
    realtime: {},
    from: vi.fn(),
    rpc: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
    getChannels: vi.fn(),
    removeAllChannels: vi.fn(),
  };

  return {
    ...base,
    ...overrides,
    auth: mergeSection(base.auth, overrides.auth),
    storage: mergeSection(base.storage, overrides.storage),
    realtime: mergeSection(base.realtime, overrides.realtime),
  };
}

export function createSupabaseModuleMock(
  overrides: Partial<MockSupabaseClient> = {},
): MockSupabaseModule {
  const supabase = createSupabaseClientMock(overrides);
  const getSupabaseClient = vi.fn(() => supabase);

  return {
    createUserSupabaseClient: vi.fn(() => supabase),
    createServerSupabaseClient: vi.fn(() => supabase),
    getSupabaseClient,
    supabase,
  };
}
