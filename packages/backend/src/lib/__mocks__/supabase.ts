/**
 * Automatic mock for src/lib/supabase.ts
 *
 * Used by any test that calls `vi.mock('../lib/supabase.js')` (or the .ts
 * variant) without providing a factory. Tests that need specific query results
 * should provide their own factory or override individual mock functions.
 */
import { vi } from "vitest";

const makeQueryChain = (): Record<string, unknown> => {
  const chain: Record<string, unknown> = {};
  return new Proxy(chain, {
    get(_t, prop) {
      if (prop === "then") return undefined; // not a thenable
      return vi.fn(() => makeQueryChain());
    },
  });
};

export const mockSupabaseClient = {
  from: vi.fn(() => makeQueryChain()),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  },
  storage: {},
  realtime: {},
  channel: vi.fn(() => ({ on: vi.fn(), subscribe: vi.fn() })),
  removeChannel: vi.fn(),
  getChannels: vi.fn(() => []),
  removeAllChannels: vi.fn(),
};

export const createServerSupabaseClient = vi.fn(() => mockSupabaseClient);
export const createServiceRoleSupabaseClient = vi.fn(() => mockSupabaseClient);
export const createUserSupabaseClient = vi.fn(() => mockSupabaseClient);
export const createRequestSupabaseClient = vi.fn(() => mockSupabaseClient);
export const createRequestRlsSupabaseClient = vi.fn(() => mockSupabaseClient);
export const getRequestSupabaseClient = vi.fn(() => mockSupabaseClient);
export const getSupabaseClient = vi.fn(() => mockSupabaseClient);
export const createBrowserSupabaseClient = vi.fn(() => mockSupabaseClient);
export const supabase = mockSupabaseClient;

// Re-export types so imports don't break
export type BrowserSafeAnonSupabaseClient = typeof mockSupabaseClient;
export type RequestScopedRlsSupabaseClient = typeof mockSupabaseClient;
export type ServiceRoleSupabaseClient = typeof mockSupabaseClient;
