/**
 * DSR API guard and transactional erasure tests.
 */

import type { NextFunction, Request, Response } from "express";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockDsrRequestRecord {
  tenant_id: string;
  user_id: string;
  request_token: string;
  request_type: "erase";
  status: "pending" | "completed" | "failed";
  result_summary: Record<string, unknown> | null;
  last_error: string | null;
}

const state = vi.hoisted(() => ({
  users: new Map<string, { id: string }>(),
  dsrRequests: new Map<string, MockDsrRequestRecord>(),
  rpcCalls: [] as Array<Record<string, unknown>>,
  rpcImpl: vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: null, error: null })),
}));

function requestKey(tenantId: string, requestToken: string): string {
  return `${tenantId}:erase:${requestToken}`;
}

function createSelectChain(table: string) {
  const filters = new Map<string, unknown>();

  return {
    eq(column: string, value: unknown) {
      filters.set(column, value);
      return this;
    },
    async maybeSingle() {
      if (table === "users") {
        const email = filters.get("email");
        const tenantId = filters.get("tenant_id");
        const user = state.users.get(`${tenantId}:${email}`);
        return { data: user ?? null, error: null };
      }

      if (table === "dsr_erasure_requests") {
        const tenantId = String(filters.get("tenant_id"));
        const requestToken = String(filters.get("request_token"));
        return {
          data: state.dsrRequests.get(requestKey(tenantId, requestToken)) ?? null,
          error: null,
        };
      }

      return { data: null, error: null };
    },
  };
}

function createUpdateChain(table: string, payload: Record<string, unknown>) {
  const filters = new Map<string, unknown>();

  return {
    eq(column: string, value: unknown) {
      filters.set(column, value);
      return this;
    },
    then(resolve: (value: { data: null; error: null }) => unknown) {
      if (table === "dsr_erasure_requests") {
        const tenantId = String(filters.get("tenant_id"));
        const requestToken = String(filters.get("request_token"));
        const key = requestKey(tenantId, requestToken);
        const existing = state.dsrRequests.get(key);
        if (existing) {
          state.dsrRequests.set(key, { ...existing, ...payload } as MockDsrRequestRecord);
        }
      }
      return Promise.resolve(resolve({ data: null, error: null }));
    },
    catch() {
      return this;
    },
  };
}

const mockSupabase = {
  from(table: string) {
    return {
      select: () => createSelectChain(table),
      upsert: async (payload: Record<string, unknown>) => {
        if (table === "dsr_erasure_requests") {
          const record = payload as unknown as MockDsrRequestRecord;
          state.dsrRequests.set(
            requestKey(record.tenant_id, record.request_token),
            {
              ...record,
              result_summary: record.result_summary ?? null,
              last_error: record.last_error ?? null,
            },
          );
        }
        return { data: null, error: null };
      },
      update: (payload: Record<string, unknown>) => createUpdateChain(table, payload),
      insert: async () => ({ error: null }),
      eq() {
        return this;
      },
      maybeSingle: async () => ({ data: null, error: null }),
    };
  },
  rpc: async (fn: string, args: Record<string, unknown>) => {
    state.rpcCalls.push({ fn, args });
    const result = await state.rpcImpl(fn, args);
    if (fn === "erase_user_pii" && result.error == null && result.data && typeof args.p_request_token === "string") {
      const key = requestKey(String(args.p_tenant_id), args.p_request_token);
      const existing = state.dsrRequests.get(key);
      if (existing) {
        state.dsrRequests.set(key, {
          ...existing,
          status: "completed",
          result_summary: result.data as Record<string, unknown>,
          last_error: null,
        });
      }
    }
    return result;
  },
};

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../middleware/rbac.js", () => ({
  requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../middleware/secureRouter.js", async () => {
  const expressModule = await import("express");
  return { createSecureRouter: () => expressModule.default.Router() };
});

vi.mock("../../middleware/rateLimiter.js", () => ({
  createRateLimiter: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  RateLimitTier: { STANDARD: "standard", STRICT: "strict" },
}));

beforeEach(() => {
  state.users.clear();
  state.dsrRequests.clear();
  state.rpcCalls.length = 0;
  state.rpcImpl.mockReset();
  state.rpcImpl.mockResolvedValue({ data: null, error: null });
  state.users.set("tenant-abc:user@example.com", { id: "user-123" });
});

async function makeApp(reqOverrides: Record<string, unknown> = {}) {
  vi.resetModules();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, {
      tenantId: "tenant-abc",
      requestId: "req-001",
      userId: "actor-123",
      supabase: mockSupabase,
      ...reqOverrides,
    });
    next();
  });

  const { default: dsrRouter } = await import("../dataSubjectRequests.js");
  app.use("/api/dsr", dsrRouter);
  return app;
}

describe("DSR /export — actorId guard", () => {
  it("returns 401 when userId is not set on request", async () => {
    const app = await makeApp({ userId: undefined });

    const res = await request(app)
      .post("/api/dsr/export")
      .send({ email: "user@example.com" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });

  it("does not return 401 when userId is present", async () => {
    const app = await makeApp();

    const res = await request(app)
      .post("/api/dsr/export")
      .send({ email: "user@example.com" });

    expect(res.status).not.toBe(401);
  });
});

describe("DSR /erase — actorId guard", () => {
  it("returns 401 when userId is not set on request", async () => {
    const app = await makeApp({ userId: undefined });

    const res = await request(app)
      .post("/api/dsr/erase")
      .send({ email: "user@example.com" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });

  it("does not return 401 when userId is present", async () => {
    state.rpcImpl.mockResolvedValue({
      data: {
        anonymized_to: "deleted+user-123@redacted.local",
        erased_at: "2026-03-21T00:00:00.000Z",
        pii_assets_included: ["users", "messages"],
        pii_assets_excluded: [],
        scrubbed_counts: { users: 1, messages: 1 },
        deleted_counts: {},
        idempotent_replay: false,
      },
      error: null,
    });

    const app = await makeApp();
    const res = await request(app)
      .post("/api/dsr/erase")
      .send({ email: "user@example.com" });

    expect(res.status).toBe(200);
    expect(state.rpcCalls).toHaveLength(1);
  });
});

describe("DSR /erase transactional retries", () => {
  it("marks the request failed when the RPC errors mid-step", async () => {
    state.rpcImpl.mockResolvedValue({
      data: null,
      error: { message: "Forced DSR erasure failure after messages step", code: "P0001" },
    });

    const app = await makeApp({ requestId: "req-fail" });
    const res = await request(app)
      .post("/api/dsr/erase")
      .set("idempotency-key", "idem-fail")
      .send({ email: "user@example.com" });

    expect(res.status).toBe(500);
    expect(state.dsrRequests.get("tenant-abc:erase:idem-fail")).toMatchObject({
      status: "failed",
      last_error: "Forced DSR erasure failure after messages step",
    });
  });

  it("replays a completed request token without calling the RPC again", async () => {
    state.dsrRequests.set("tenant-abc:erase:idem-replay", {
      tenant_id: "tenant-abc",
      user_id: "user-123",
      request_token: "idem-replay",
      request_type: "erase",
      status: "completed",
      result_summary: {
        anonymized_to: "deleted+user-123@redacted.local",
        erased_at: "2026-03-21T00:00:00.000Z",
        pii_assets_included: ["users", "messages"],
        pii_assets_excluded: [],
        scrubbed_counts: { users: 1, messages: 1 },
        deleted_counts: {},
      },
      last_error: null,
    });

    const app = await makeApp({ requestId: "req-replay" });
    const res = await request(app)
      .post("/api/dsr/erase")
      .set("idempotency-key", "idem-replay")
      .send({ email: "user@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.idempotent_replay).toBe(true);
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("retries a previously failed request token and completes once the RPC succeeds", async () => {
    state.rpcImpl
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Forced DSR erasure failure after messages step", code: "P0001" },
      })
      .mockResolvedValueOnce({
        data: {
          anonymized_to: "deleted+user-123@redacted.local",
          erased_at: "2026-03-21T00:00:00.000Z",
          pii_assets_included: ["users", "messages"],
          pii_assets_excluded: [],
          scrubbed_counts: { users: 1, messages: 1 },
          deleted_counts: {},
          idempotent_replay: false,
        },
        error: null,
      });

    const app = await makeApp({ requestId: "req-retry" });

    const first = await request(app)
      .post("/api/dsr/erase")
      .set("idempotency-key", "idem-retry")
      .send({ email: "user@example.com" });

    const second = await request(app)
      .post("/api/dsr/erase")
      .set("idempotency-key", "idem-retry")
      .send({ email: "user@example.com" });

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(second.body.idempotent_replay).toBe(false);
    expect(state.rpcCalls).toHaveLength(2);
    expect(state.dsrRequests.get("tenant-abc:erase:idem-retry")).toMatchObject({
      status: "completed",
      last_error: null,
    });
  });
});
