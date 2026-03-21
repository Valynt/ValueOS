/**
 * DSR API route tests.
 *
 * Covers actor guards plus erase-path transactional/idempotency behavior.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../middleware/rbac.js", () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../middleware/secureRouter.js", async () => {
  const express = (await import("express")).default;
  return { createSecureRouter: () => express.Router() };
});

import express from "express";
import request from "supertest";

type MaybeSingleResult = { data: Record<string, unknown> | null; error: { message: string; code?: string } | null };

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

function makeSelectBuilder(result: MaybeSingleResult) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

function makeInsertBuilder(insertSpy: ReturnType<typeof vi.fn>) {
  return {
    insert: insertSpy,
  };
}

function createSupabaseForReplayScenario() {
  let replaySummary: Record<string, unknown> | null = null;
  const auditInsert = vi.fn().mockResolvedValue({ error: null });
  const userLookup = vi.fn().mockImplementation(() => makeSelectBuilder({ data: { id: "user-123" }, error: null }));
  const replayLookup = vi.fn().mockImplementation(() =>
    makeSelectBuilder({
      data: replaySummary ? { result_summary: replaySummary } : null,
      error: null,
    }),
  );

  const rpc = vi.fn().mockImplementation(async (_fn: string, payload: Record<string, unknown>) => {
    replaySummary = {
      request_type: "erase",
      anonymized_to: "deleted+user-123@redacted.local",
      erased_at: payload.p_redacted_ts,
      request_token: payload.p_request_token,
      idempotent_replay: false,
      pii_assets_included: ["users", "messages"],
      pii_assets_excluded: [{ asset: "semantic_memory", reason: "not_erasable" }],
      coverage: { users: { anonymized: 1 }, messages: { scrubbed: 1 } },
    };

    return { data: replaySummary, error: null };
  });

  const from = vi.fn((table: string) => {
    if (table === "users") {
      return userLookup();
    }
    if (table === "dsr_erasure_requests") {
      return replayLookup();
    }
    if (table === "security_audit_log") {
      return makeInsertBuilder(auditInsert);
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    client: { from, rpc } as unknown as MockSupabase,
    auditInsert,
    replayLookup,
    rpc,
    userLookup,
  };
}

function createSupabaseForRpcFailure() {
  const auditInsert = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "mid-transaction failure" } });
  const from = vi.fn((table: string) => {
    if (table === "users") {
      return makeSelectBuilder({ data: { id: "user-123" }, error: null });
    }
    if (table === "dsr_erasure_requests") {
      return makeSelectBuilder({ data: null, error: null });
    }
    if (table === "security_audit_log") {
      return makeInsertBuilder(auditInsert);
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    client: { from, rpc } as unknown as MockSupabase,
    auditInsert,
    rpc,
  };
}

async function makeApp(reqOverrides: Record<string, unknown> = {}) {
  const app = express();
  app.use(express.json());
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    Object.assign(req, { tenantId: "tenant-abc", requestId: "req-001", ...reqOverrides });
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
    const app = await makeApp({ userId: "actor-123", supabase: createSupabaseForRpcFailure().client });

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
    const app = await makeApp({ userId: "actor-123", supabase: createSupabaseForRpcFailure().client });

    const res = await request(app)
      .post("/api/dsr/erase")
      .send({ email: "user@example.com" });

    expect(res.status).not.toBe(401);
  });
});

describe("DSR /erase — transactional RPC behavior", () => {
  it("returns 500 and skips auditing when the erase RPC fails mid-transaction", async () => {
    const supabase = createSupabaseForRpcFailure();
    const app = await makeApp({ userId: "actor-123", supabase: supabase.client });

    const res = await request(app)
      .post("/api/dsr/erase")
      .set("Idempotency-Key", "erase-failure-1")
      .send({ email: "user@example.com" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Erasure failed");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.auditInsert).not.toHaveBeenCalled();
  });

  it("replays the stored result on retry without re-running the RPC", async () => {
    const supabase = createSupabaseForReplayScenario();
    const app = await makeApp({ userId: "actor-123", supabase: supabase.client });

    const first = await request(app)
      .post("/api/dsr/erase")
      .set("Idempotency-Key", "erase-retry-1")
      .send({ email: "user@example.com" });

    const second = await request(app)
      .post("/api/dsr/erase")
      .set("Idempotency-Key", "erase-retry-1")
      .send({ email: "user@example.com" });

    expect(first.status).toBe(200);
    expect(first.body.idempotent_replay).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.idempotent_replay).toBe(true);
    expect(second.body.request_token).toBe("erase-retry-1");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.auditInsert).toHaveBeenCalledTimes(1);
    expect(supabase.userLookup).toHaveBeenCalledTimes(1);
    expect(supabase.replayLookup).toHaveBeenCalledTimes(2);
  });
});
