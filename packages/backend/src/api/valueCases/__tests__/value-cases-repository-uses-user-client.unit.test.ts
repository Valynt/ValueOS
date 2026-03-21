/**
 * value-cases-repository-uses-user-client — unit test
 *
 * Ensures ValueCasesRepository.fromRequest() creates a repository backed by
 * the user-scoped Supabase client (RLS-enforced), NOT createServerSupabaseClient
 * (service_role). Per AGENTS.md rule 3, service_role must only be used for
 * AuthService, tenant provisioning, and cron jobs.
 */

import { describe, expect, it, vi } from "vitest";

// ── Spies ────────────────────────────────────────────────────────────────────
const mockServerClient = { _type: "server_role" };
const mockUserClient = { _type: "user_scoped" };
const createServerSpy = vi.fn(() => mockServerClient);
const createRequestSpy = vi.fn(() => mockUserClient);

vi.mock("@shared/lib/supabase", () => ({
  createRequestSupabaseClient: (...args: unknown[]) => createRequestSpy(...args),
}));

vi.mock("../../../lib/supabase.js", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSpy(...args),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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
    // createServerSupabaseClient must NOT have been called for fromRequest path
    expect(createServerSpy).not.toHaveBeenCalled();
  });

  it("fromRequest() falls back to createRequestSupabaseClient when req.supabase is absent", () => {
    const mockReq = {
      session: { access_token: "jwt-token-123" },
    } as unknown as import("express").Request;

    createServerSpy.mockClear();
    createRequestSpy.mockClear();

    const repo = ValueCasesRepository.fromRequest(mockReq);

    expect(repo).toBeDefined();
    // Must call createRequestSupabaseClient with the access token
    expect(createRequestSpy).toHaveBeenCalledWith({ accessToken: "jwt-token-123" });
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

  it("list() does not call createServerSupabaseClient during query", async () => {
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

    // createServerSupabaseClient must never be called during list()
    expect(createServerSpy).not.toHaveBeenCalled();
  });
});
