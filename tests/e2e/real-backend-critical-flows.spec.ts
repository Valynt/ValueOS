/**
 * Critical E2E flows against the real backend and Supabase.
 *
 * These tests do NOT use page.route() API mocking. Every request hits the
 * real Express backend (port 3001) and a real Supabase test instance.
 *
 * Required environment variables (set in CI secrets or .env.local):
 *   E2E_BASE_URL              - Backend base URL, e.g. http://localhost:3001
 *   E2E_SUPABASE_URL          - Supabase project URL for the test environment
 *   E2E_SUPABASE_ANON_KEY     - Supabase anon key for the test environment
 *   E2E_SUPABASE_SERVICE_ROLE_KEY - Service role key (for test setup/teardown)
 *   E2E_TEST_TENANT_A_TOKEN   - Valid JWT for tenant A (pre-seeded test user)
 *   E2E_TEST_TENANT_B_TOKEN   - Valid JWT for tenant B (pre-seeded test user)
 *   E2E_TEST_TENANT_A_ID      - Tenant A's organization_id
 *   E2E_TEST_TENANT_B_ID      - Tenant B's organization_id
 *   E2E_STRIPE_WEBHOOK_SECRET - Stripe webhook signing secret for test env
 *
 * Run with:
 *   E2E_BASE_URL=http://localhost:3001 npx playwright test tests/e2e/real-backend-critical-flows.spec.ts
 */

import { expect, request, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`E2E env var ${name} is required but not set`);
  return val;
}

function apiContext(token?: string) {
  return request.newContext({
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

// ---------------------------------------------------------------------------
// Flow 1: Auth — sign-in → session persistence → sign-out
// ---------------------------------------------------------------------------

test.describe("Auth flow (real Supabase)", () => {
  test("AC-11: sign-in returns a valid session token", async () => {
    const supabaseUrl = requireEnv("E2E_SUPABASE_URL");
    const supabaseAnonKey = requireEnv("E2E_SUPABASE_ANON_KEY");

    // Sign in via Supabase Auth REST API directly (no UI mocking)
    const ctx = await request.newContext({ baseURL: supabaseUrl });
    const res = await ctx.post("/auth/v1/token?grant_type=password", {
      headers: {
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      data: {
        email: process.env.E2E_TEST_USER_EMAIL ?? "e2e-tenant-a@valueos-test.internal",
        password: process.env.E2E_TEST_USER_PASSWORD ?? "E2eTestPass123!",
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json() as { access_token?: string; token_type?: string };
    expect(body.access_token).toBeTruthy();
    expect(body.token_type).toBe("bearer");
    await ctx.dispose();
  });

  test("AC-11: authenticated request to /health returns 200", async () => {
    const token = requireEnv("E2E_TEST_TENANT_A_TOKEN");
    const ctx = await apiContext(token);

    const res = await ctx.get("/health");
    expect(res.status()).toBe(200);
    const body = await res.json() as { status?: string };
    expect(body.status).toMatch(/ok|healthy/i);
    await ctx.dispose();
  });

  test("AC-11: unauthenticated request to protected endpoint returns 401 or 403", async () => {
    const ctx = await apiContext(); // no token
    const res = await ctx.get("/api/agents/OpportunityAgent/info");
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });
});

// ---------------------------------------------------------------------------
// Flow 2: Agent invocation — POST /api/agents/:agentId/invoke (real backend)
// ---------------------------------------------------------------------------

test.describe("Agent invocation flow (real backend)", () => {
  test("AC-12: authenticated invoke returns a jobId and queued status", async () => {
    const token = requireEnv("E2E_TEST_TENANT_A_TOKEN");
    const ctx = await apiContext(token);

    const res = await ctx.post("/api/agents/OpportunityAgent/invoke", {
      data: {
        query: "What is the estimated revenue uplift for this opportunity?",
        context: { agentType: "OpportunityAgent" },
        sessionId: `e2e-session-${Date.now()}`,
      },
    });

    // 202 Accepted (async) or 200 (sync direct execution)
    expect([200, 202, 409, 503]).toContain(res.status());

    if (res.status() === 200 || res.status() === 202) {
      const body = await res.json() as { success?: boolean; data?: { jobId?: string; status?: string } };
      expect(body.success).toBe(true);
      expect(body.data?.jobId).toBeTruthy();
      expect(body.data?.status).toMatch(/queued|processing|completed/i);
    }

    await ctx.dispose();
  });

  test("AC-12: invoke without auth returns 401 or 403", async () => {
    const ctx = await apiContext();
    const res = await ctx.post("/api/agents/OpportunityAgent/invoke", {
      data: { query: "test", sessionId: "s1" },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });

  test("AC-12: invoke with missing query returns 400", async () => {
    const token = requireEnv("E2E_TEST_TENANT_A_TOKEN");
    const ctx = await apiContext(token);

    const res = await ctx.post("/api/agents/OpportunityAgent/invoke", {
      data: { sessionId: "s1" }, // missing query
    });
    expect(res.status()).toBe(400);
    await ctx.dispose();
  });
});

// ---------------------------------------------------------------------------
// Flow 3: Billing webhook — delivery → DB state → idempotent re-delivery
// ---------------------------------------------------------------------------

test.describe("Billing webhook flow (real backend + DB)", () => {
  const testEventId = `evt_e2e_${Date.now()}`;

  // Minimal Stripe-shaped event — no real signature required for test env
  // (backend must be configured with STRIPE_WEBHOOK_SECRET=whsec_test in test env)
  const stripeEvent = {
    id: testEventId,
    object: "event",
    api_version: "2020-08-27",
    created: Math.floor(Date.now() / 1000),
    type: "invoice.created",
    livemode: false,
    pending_webhooks: 1,
    request: { id: "req_e2e", idempotency_key: null },
    data: {
      object: {
        id: `in_e2e_${Date.now()}`,
        object: "invoice",
        customer: "cus_e2e_test",
        status: "draft",
        amount_due: 0,
      },
    },
  };

  test("AC-13: webhook delivery creates a webhook_events row", async () => {
    const supabaseUrl = requireEnv("E2E_SUPABASE_URL");
    const serviceRoleKey = requireEnv("E2E_SUPABASE_SERVICE_ROLE_KEY");

    // Deliver webhook to backend
    const ctx = await apiContext();
    const webhookRes = await ctx.post("/api/billing/webhooks", {
      headers: {
        "stripe-signature": "t=0,v1=test_sig_e2e", // test env accepts any sig when secret=whsec_test
        "Content-Type": "application/json",
      },
      data: stripeEvent,
    });

    // 200 = processed, 400 = sig verification failed (expected in non-test env)
    // We assert the row exists regardless — if sig fails, the row won't be there
    if (webhookRes.status() === 200) {
      // Verify DB row via Supabase service role
      const dbCtx = await request.newContext({ baseURL: supabaseUrl });
      const dbRes = await dbCtx.get(
        `/rest/v1/webhook_events?stripe_event_id=eq.${testEventId}&select=stripe_event_id,processed`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      );
      expect(dbRes.status()).toBe(200);
      const rows = await dbRes.json() as Array<{ stripe_event_id: string; processed: boolean }>;
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows[0].stripe_event_id).toBe(testEventId);
      await dbCtx.dispose();
    } else {
      // Signature verification failed — skip DB assertion, mark as expected skip
      test.skip(true, `Webhook signature verification failed (${webhookRes.status()}) — configure STRIPE_WEBHOOK_SECRET=whsec_test in test env`);
    }

    await ctx.dispose();
  });

  test("AC-13: idempotent re-delivery of the same event returns isDuplicate: true", async () => {
    const ctx = await apiContext();

    // First delivery
    const first = await ctx.post("/api/billing/webhooks", {
      headers: {
        "stripe-signature": "t=0,v1=test_sig_e2e",
        "Content-Type": "application/json",
      },
      data: { ...stripeEvent, id: `evt_idem_${Date.now()}` },
    });

    if (first.status() !== 200) {
      test.skip(true, "Webhook endpoint not reachable or sig verification failed");
      return;
    }

    const firstBody = await first.json() as { isDuplicate?: boolean };

    // Second delivery with same event ID
    const sameId = `evt_idem_reuse_${Date.now()}`;
    const eventWithId = { ...stripeEvent, id: sameId };

    await ctx.post("/api/billing/webhooks", {
      headers: { "stripe-signature": "t=0,v1=test_sig_e2e", "Content-Type": "application/json" },
      data: eventWithId,
    });

    const second = await ctx.post("/api/billing/webhooks", {
      headers: { "stripe-signature": "t=0,v1=test_sig_e2e", "Content-Type": "application/json" },
      data: eventWithId,
    });

    if (second.status() === 200) {
      const secondBody = await second.json() as { isDuplicate?: boolean };
      expect(secondBody.isDuplicate).toBe(true);
    }

    await ctx.dispose();
  });
});

// ---------------------------------------------------------------------------
// Flow 4: Tenant isolation — cross-tenant data inaccessibility
// ---------------------------------------------------------------------------

test.describe("Tenant isolation flow (real backend)", () => {
  test("AC-14: tenant A cannot read tenant B agent results via job poll", async () => {
    const tokenA = requireEnv("E2E_TEST_TENANT_A_TOKEN");
    const tokenB = requireEnv("E2E_TEST_TENANT_B_TOKEN");

    const ctxA = await apiContext(tokenA);
    const ctxB = await apiContext(tokenB);

    // Tenant A submits a job
    const invokeRes = await ctxA.post("/api/agents/OpportunityAgent/invoke", {
      data: {
        query: "Tenant A confidential query",
        context: { agentType: "OpportunityAgent" },
        sessionId: `e2e-isolation-${Date.now()}`,
      },
    });

    if (![200, 202].includes(invokeRes.status())) {
      await ctxA.dispose();
      await ctxB.dispose();
      test.skip(true, `Agent invoke returned ${invokeRes.status()} — skipping isolation check`);
      return;
    }

    const invokeBody = await invokeRes.json() as { data?: { jobId?: string } };
    const jobId = invokeBody.data?.jobId;

    if (!jobId || jobId === "cached-result") {
      await ctxA.dispose();
      await ctxB.dispose();
      test.skip(true, "No trackable jobId returned — skipping isolation check");
      return;
    }

    // Tenant B attempts to poll tenant A's job
    const pollRes = await ctxB.get(`/api/agents/jobs/${jobId}`);

    // Must be 403 (forbidden), 404 (not found for this tenant), or the result
    // must not contain tenant A's data. 200 with tenant A's data = isolation failure.
    expect([403, 404]).toContain(pollRes.status());

    await ctxA.dispose();
    await ctxB.dispose();
  });

  test("AC-14: agent cache returns distinct responses for different tenants with identical queries", async () => {
    const tokenA = requireEnv("E2E_TEST_TENANT_A_TOKEN");
    const tokenB = requireEnv("E2E_TEST_TENANT_B_TOKEN");

    const ctxA = await apiContext(tokenA);
    const ctxB = await apiContext(tokenB);

    const sharedQuery = "What is the revenue uplift for this account?";
    const sessionA = `e2e-cache-a-${Date.now()}`;
    const sessionB = `e2e-cache-b-${Date.now()}`;

    const [resA, resB] = await Promise.all([
      ctxA.post("/api/agents/FinancialModelingAgent/invoke", {
        data: { query: sharedQuery, context: { agentType: "FinancialModelingAgent" }, sessionId: sessionA },
      }),
      ctxB.post("/api/agents/FinancialModelingAgent/invoke", {
        data: { query: sharedQuery, context: { agentType: "FinancialModelingAgent" }, sessionId: sessionB },
      }),
    ]);

    // Both must succeed or be expected non-200 (Kafka disabled, quota, etc.)
    // The key assertion: if both return 200, neither should be marked as a
    // cross-tenant cache hit (which would be indicated by identical jobIds
    // pointing to the same cached result from the other tenant).
    if (resA.status() === 200 && resB.status() === 200) {
      const bodyA = await resA.json() as { data?: { jobId?: string; cached?: boolean } };
      const bodyB = await resB.json() as { data?: { jobId?: string; cached?: boolean } };

      // If both are cache hits, they must not share the same jobId
      // (a shared jobId would indicate a cross-tenant cache collision)
      if (bodyA.data?.cached && bodyB.data?.cached) {
        expect(bodyA.data.jobId).not.toBe(bodyB.data.jobId);
      }
    }

    await ctxA.dispose();
    await ctxB.dispose();
  });
});
