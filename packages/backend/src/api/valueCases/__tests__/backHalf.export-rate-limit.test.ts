/**
 * backHalf export route rate limit integration tests
 *
 * Verifies strict limiter enforcement and tenant/user key isolation on:
 * - POST /:id/export/pdf
 * - POST /:id/export/pptx
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../middleware/redisRateLimitStore.js", () => {
  const buckets = new Map<string, { count: number; resetTime: number }>();

  return {
    RedisRateLimitStore: class {
      async increment(key: string, windowMs: number) {
        const now = Date.now();
        const current = buckets.get(key);

        if (!current || current.resetTime <= now) {
          const fresh = { count: 1, resetTime: now + windowMs };
          buckets.set(key, fresh);
          return fresh;
        }

        current.count += 1;
        buckets.set(key, current);
        return current;
      }

      async get(key: string) {
        return buckets.get(key) ?? null;
      }

      async reset(key: string) {
        buckets.delete(key);
      }

      async getKeys() {
        return [];
      }

      async getStats() {
        return { totalKeys: buckets.size, keys: [] };
      }

      cleanup() {
        buckets.clear();
      }
    },
  };
});

vi.mock("../../../lib/observability/index.js", () => ({
  createCounter: () => ({ inc: vi.fn() }),
  createHistogram: () => ({ observe: vi.fn(), startTimer: () => vi.fn() }),
}));

vi.mock("../../../middleware/auth.js", () => ({
  requireAuth: (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req["user"] = { id: (req.headers as Record<string, string | undefined>)["x-user-id"] ?? "user-1" };
    next();
  },
}));

vi.mock("../../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () =>
    (
      req: Record<string, unknown> & { headers: Record<string, string | undefined> },
      _res: unknown,
      next: () => void,
    ) => {
      req["tenantId"] = req.headers["x-tenant-id"] ?? "tenant-1";
      next();
    },
}));

vi.mock("../../../middleware/tenantDbContext.js", () => ({
  tenantDbContextMiddleware: () =>
    (req: Record<string, unknown>, _res: unknown, next: () => void) => {
      req["supabase"] = { from: vi.fn() };
      next();
    },
}));

vi.mock("../../../repositories/IntegrityResultRepository.js", () => ({
  IntegrityResultRepository: vi.fn().mockImplementation(() => ({
    getLatestForCase: vi.fn().mockResolvedValue(null),
  })),
}));

vi.mock("../../../repositories/NarrativeDraftRepository.js", () => ({
  NarrativeDraftRepository: vi.fn().mockImplementation(() => ({
    getLatestForCase: vi.fn().mockResolvedValue(null),
  })),
}));

vi.mock("../../../repositories/RealizationReportRepository.js", () => ({
  RealizationReportRepository: vi.fn().mockImplementation(() => ({
    getLatestForCase: vi.fn().mockResolvedValue(null),
  })),
}));

vi.mock("../../../repositories/ExpansionOpportunityRepository.js", () => ({
  ExpansionOpportunityRepository: vi.fn().mockImplementation(() => ({
    getLatestRunForCase: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../../../services/integrity/ValueIntegrityService.js", () => ({
  ValueIntegrityService: vi.fn().mockImplementation(() => ({
    calculateIntegrity: vi.fn().mockResolvedValue({ score: 1.0 }),
    checkHardBlocks: vi.fn().mockResolvedValue({ blocked: false, violations: [], soft_warnings: [] }),
  })),
}));

vi.mock("../../../services/export/PdfExportService.js", () => ({
  getPdfExportService: () => ({
    exportValueCase: vi.fn().mockResolvedValue({ sizeBytes: 100, fileName: "case.pdf", mimeType: "application/pdf" }),
  }),
}));

vi.mock("../../../services/export/PptxExportService.js", () => ({
  getPptxExportService: () => ({
    exportValueCase: vi.fn().mockResolvedValue({ sizeBytes: 100, fileName: "case.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
  }),
}));

vi.mock("../../../lib/agent-fabric/AgentFactory.js", () => ({
  createAgentFactory: vi.fn().mockReturnValue({ hasFabricAgent: vi.fn().mockReturnValue(false), create: vi.fn() }),
}));

vi.mock("../../../lib/agent-fabric/LLMGateway.js", () => ({
  LLMGateway: vi.fn(),
  FabricLLMGateway: vi.fn(),
}));

vi.mock("../../../lib/agent-fabric/MemorySystem.js", () => ({
  MemorySystem: vi.fn(),
  FabricMemorySystem: vi.fn(),
}));

vi.mock("../../../lib/agent-fabric/SupabaseMemoryBackend.js", () => ({
  SupabaseMemoryBackend: vi.fn(),
}));

vi.mock("../../../lib/agent-fabric/CircuitBreaker.js", () => ({
  CircuitBreaker: vi.fn(),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

async function buildApp() {
  const { backHalfRouter } = await import("../backHalf.js");
  const app = express();
  app.use(express.json());
  app.use("/api/v1/cases", backHalfRouter);
  return app;
}

describe("backHalf export route strict rate limiting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
  });

  it("returns 429 on the 6th repeated PDF export request", async () => {
    const app = await buildApp();

    const responses = await Promise.all(
      Array.from({ length: 6 }).map(() =>
        request(app)
          .post("/api/v1/cases/case-1/export/pdf")
          .set("x-tenant-id", "tenant-a")
          .set("x-user-id", "user-a")
          .send({ renderUrl: "http://localhost:3001/cases/case-1/print" }),
      ),
    );

    expect(responses.slice(0, 5).every((r) => r.status === 200)).toBe(true);
    expect(responses[5].status).toBe(429);
  });

  it("returns 429 on the 6th repeated PPTX export request", async () => {
    const app = await buildApp();

    const responses = await Promise.all(
      Array.from({ length: 6 }).map(() =>
        request(app)
          .post("/api/v1/cases/case-1/export/pptx")
          .set("x-tenant-id", "tenant-a")
          .set("x-user-id", "user-b")
          .send({ title: "Quarterly Value Review" }),
      ),
    );

    expect(responses.slice(0, 5).every((r) => r.status === 200)).toBe(true);
    expect(responses[5].status).toBe(429);
  });

  it("isolates strict limits by tenant and user rate-limit keying", async () => {
    const app = await buildApp();

    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post("/api/v1/cases/case-1/export/pptx")
        .set("x-tenant-id", "tenant-a")
        .set("x-user-id", "shared-user")
        .send({ title: "Value Deck" })
        .expect(200);
    }

    await request(app)
      .post("/api/v1/cases/case-1/export/pptx")
      .set("x-tenant-id", "tenant-a")
      .set("x-user-id", "shared-user")
      .send({ title: "Value Deck" })
      .expect(429);

    await request(app)
      .post("/api/v1/cases/case-1/export/pptx")
      .set("x-tenant-id", "tenant-b")
      .set("x-user-id", "shared-user")
      .send({ title: "Value Deck" })
      .expect(200);

    await request(app)
      .post("/api/v1/cases/case-1/export/pptx")
      .set("x-tenant-id", "tenant-a")
      .set("x-user-id", "different-user")
      .send({ title: "Value Deck" })
      .expect(200);
  });
});
