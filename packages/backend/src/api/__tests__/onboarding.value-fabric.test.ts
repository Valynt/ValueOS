import { beforeEach, describe, expect, it, vi } from "vitest";

import onboardingRouter from "../onboarding.js";

vi.mock("../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  createRequestRlsSupabaseClient: vi.fn(),
  supabase: {},
  supabaseClient: {},
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/rateLimiter.js", () => ({
  rateLimiters: {
    standard: (_req: any, _res: any, next: any) => next(),
    loose: (_req: any, _res: any, next: any) => next(),
  },
}));

vi.mock("../../middleware/securityMiddleware.js", () => ({
  securityHeadersMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (req: any, _res: any, next: any) => {
    req.tenantId = "test-tenant-id";
    next();
  },
}));

vi.mock("../../workers/researchWorker.js", () => ({
  getResearchQueue: () => ({ add: vi.fn() }),
}));

import { createRequestRlsSupabaseClient } from "../../lib/supabase.js";

function createSnapshotChain(snapshotData: any, snapshotError: any = null) {
  const chain: any = {
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: snapshotData, error: snapshotError })),
  };
  return chain;
}

function createContextChain(contextData: any, contextError: any = null) {
  const chain: any = {
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: contextData, error: contextError })),
  };
  return chain;
}

function createDealContextChain(dealContextData: any, dealContextError: any = null) {
  const chain: any = {
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: dealContextData, error: dealContextError })),
  };
  return chain;
}

function createSupabaseMock(options: {
  snapshotData?: any;
  snapshotError?: any;
  contextData?: any;
  contextError?: any;
  dealContextData?: any;
  dealContextError?: any;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "company_context_versions") {
        return {
          select: vi.fn(() =>
            createSnapshotChain(options.snapshotData ?? null, options.snapshotError ?? null)
          ),
        };
      }
      if (table === "company_contexts") {
        return {
          select: vi.fn(() =>
            createContextChain(options.contextData ?? null, options.contextError ?? null)
          ),
        };
      }
      if (table === "deal_contexts") {
        return {
          select: vi.fn(() =>
            createDealContextChain(options.dealContextData ?? null, options.dealContextError ?? null)
          ),
        };
      }
      return {
        select: vi.fn(() => createContextChain(null, null)),
      };
    }),
  };
}

async function invokeGet(path: string) {
  const parsedUrl = new URL(`http://localhost${path}`);
  const query: Record<string, string> = {};
  for (const [key, value] of parsedUrl.searchParams.entries()) {
    query[key] = value;
  }

  const req: any = {
    method: "GET",
    url: parsedUrl.pathname + parsedUrl.search,
    originalUrl: parsedUrl.pathname + parsedUrl.search,
    headers: {},
    query,
    params: {},
    body: {},
  };

  let statusCode = 200;
  let body: any = undefined;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: any) {
      body = payload;
      return res;
    },
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    end: vi.fn(),
  };

  await new Promise<void>((resolve, reject) => {
    onboardingRouter.handle(req, res, (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    });
    setImmediate(resolve);
  });

  return { status: statusCode, body };
}

describe("Onboarding Value Fabric API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns latest value fabric snapshot when available", async () => {
    (createRequestRlsSupabaseClient as any).mockReturnValue(
      createSupabaseMock({
        snapshotData: {
          snapshot: { ontology_version: "1.0", nodes: [{ id: "product:valueos" }] },
          version: 7,
          created_at: "2026-04-07T12:00:00.000Z",
        },
      })
    );

    const res = await invokeGet(
      "/contexts/11111111-1111-1111-1111-111111111111/value-fabric"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe("snapshot");
    expect(res.body.data.version).toBe(7);
    expect(res.body.data.value_fabric.ontology_version).toBe("1.0");
  });

  it("falls back to context metadata summary when snapshot is missing", async () => {
    (createRequestRlsSupabaseClient as any).mockReturnValue(
      createSupabaseMock({
        snapshotData: null,
        contextData: {
          id: "11111111-1111-1111-1111-111111111111",
          version: 3,
          onboarding_status: "completed",
          updated_at: "2026-04-07T12:15:00.000Z",
          metadata: {
            value_fabric_summary: {
              ontology_version: "1.0",
              node_count: 22,
              relationship_count: 31,
            },
          },
        },
      })
    );

    const res = await invokeGet(
      "/contexts/11111111-1111-1111-1111-111111111111/value-fabric"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe("summary");
    expect(res.body.data.value_fabric.node_count).toBe(22);
    expect(res.body.data.onboarding_status).toBe("completed");
  });

  it("returns 404 when context does not exist for tenant", async () => {
    (createRequestRlsSupabaseClient as any).mockReturnValue(
      createSupabaseMock({
        snapshotData: null,
        contextData: null,
      })
    );

    const res = await invokeGet(
      "/contexts/11111111-1111-1111-1111-111111111111/value-fabric"
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Context not found");
  });

  it("returns aligned licensor and target context when caseId is provided", async () => {
    (createRequestRlsSupabaseClient as any).mockReturnValue(
      createSupabaseMock({
        snapshotData: {
          snapshot: {
            ontology_version: "1.0",
            nodes: [
              { id: "capability:workflow-automation", type: "capability", name: "Workflow automation", confidence_score: 0.8 },
              { id: "outcome:cost-reduction", type: "outcome", name: "Cost reduction", confidence_score: 0.72 },
            ],
            relationships: [],
            value_tree: { roots: [], nodes: [] },
          },
          version: 9,
          created_at: "2026-04-07T12:00:00.000Z",
        },
        dealContextData: {
          id: "c7f0689f-f3be-4e7b-877f-a6d6cb513f2f",
          case_id: "11111111-1111-1111-1111-111111111111",
          opportunity_id: "opp-123",
          assembled_at: "2026-04-07T11:00:00.000Z",
          status: "draft",
          context_json: {
            use_cases: [{ name: "Workflow automation for finance operations", description: "Reduce manual handoffs" }],
            pain_signals: ["High manual effort in finance close process"],
            value_drivers: [{ name: "Operating cost reduction" }],
          },
          updated_at: "2026-04-07T12:10:00.000Z",
        },
      })
    );

    const res = await invokeGet(
      "/contexts/11111111-1111-1111-1111-111111111111/target-alignment?caseId=11111111-1111-1111-1111-111111111111"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.licensor_scope).toBe("persistent");
    expect(res.body.data.target_scope).toBe("project_scoped");
    expect(res.body.data.alignment.mode).toBe("licensor_vs_target");
    expect(res.body.data.alignment.pathways.length).toBeGreaterThan(0);
  });

  it("returns 404 when target case context is missing", async () => {
    (createRequestRlsSupabaseClient as any).mockReturnValue(
      createSupabaseMock({
        snapshotData: {
          snapshot: { ontology_version: "1.0", nodes: [], relationships: [], value_tree: { roots: [], nodes: [] } },
          version: 4,
          created_at: "2026-04-07T12:00:00.000Z",
        },
        dealContextData: null,
      })
    );

    const res = await invokeGet(
      "/contexts/11111111-1111-1111-1111-111111111111/target-alignment?caseId=11111111-1111-1111-1111-111111111111"
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Target context not found for case");
  });
});
