/**
 * value-cases-repository-uses-user-client — unit test
 *
 * Ensures ValueCasesRepository.fromRequest() creates a repository backed by
 * the user-scoped Supabase client (RLS-enforced), NOT createServiceRoleSupabaseClient
 * (service_role). Per AGENTS.md rule 3, service_role must only be used for
 * AuthService, tenant provisioning, and cron jobs.
 */

import { describe, expect, it, vi } from "vitest";

// ── Spies ────────────────────────────────────────────────────────────────────
const mockServerClient = { _type: "server_role" };
const mockUserClient = { _type: "user_scoped" };
const createServerSpy = vi.fn(() => mockServerClient);
const createUserSpy = vi.fn((input: unknown) => {
  if (input && typeof input === 'object') {
    const requestSupabase = (input as { supabase?: unknown }).supabase;
    if (requestSupabase) {
      return requestSupabase;
    }

    const session = (input as { session?: { access_token?: unknown } }).session;
    if (typeof session?.access_token === 'string' && session.access_token.length > 0) {
      return mockUserClient;
    }

    throw new Error('ValueCasesRepository.fromRequest: no user-scoped Supabase client available on request');
  }

  return mockUserClient;
});

vi.mock("../../../lib/supabase.js", () => ({
  createServiceRoleSupabaseClient: (...args: unknown[]) => createServerSpy(...args),
  createRequestRlsSupabaseClient: (...args: unknown[]) => createUserSpy(...args),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
const { ValueCasesRepository } = await import("../repository.js");

// ── Tests ────────────────────────────────────────────────────────────────────
describe("value-cases-repository-uses-user-client", () => {
  it("fromRequest() uses the request-attached supabase client, not service_role", () => {
    const mockReq = {
      supabase: mockUserClient,
      session: {},
    } as unknown as import("express").Request;

    createServerSpy.mockClear();

    const repo = ValueCasesRepository.fromRequest(mockReq);

    // The repository should have been created with the user-scoped client
    expect(repo).toBeDefined();
    // createServiceRoleSupabaseClient must NOT have been called for fromRequest path
    expect(createServerSpy).not.toHaveBeenCalled();
  });

  it("fromRequest() falls back to createRequestRlsSupabaseClient when req.supabase is absent", () => {
    const mockReq = {
      session: { access_token: "jwt-token-123" },
    } as unknown as import("express").Request;

    createServerSpy.mockClear();
    createUserSpy.mockClear();

    const repo = ValueCasesRepository.fromRequest(mockReq);

    expect(repo).toBeDefined();
    // Must call createRequestRlsSupabaseClient with the request context
    expect(createUserSpy).toHaveBeenCalledWith(mockReq);
    // Must NOT use service_role
    expect(createServerSpy).not.toHaveBeenCalled();
  });

  it("fromRequest() throws when no user-scoped client is available", () => {
    const mockReq = {
      session: {},
    } as unknown as import("express").Request;

    expect(() => ValueCasesRepository.fromRequest(mockReq)).toThrow(
      /no user-scoped Supabase client/
    );
  });

  it("list() does not call createServiceRoleSupabaseClient during query", async () => {
    // Create repository using fromRequest path (user-scoped)
    const mockReq = {
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              or: () => ({
                order: () => ({
                  range: () => ({ data: [], error: null, count: 0 }),
                }),
              }),
              order: () => ({
                range: () => ({ data: [], error: null, count: 0 }),
              }),
            }),
          }),
        }),
      },
      session: {},
    } as unknown as import("express").Request;

    createServerSpy.mockClear();

    const repo = ValueCasesRepository.fromRequest(mockReq);
    await repo.list("tenant-1", {
      page: 1,
      limit: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    // createServiceRoleSupabaseClient must never be called during list()
    expect(createServerSpy).not.toHaveBeenCalled();
  });
});
