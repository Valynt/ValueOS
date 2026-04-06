/**
 * PDF export SSRF guard tests (BUG-5 regression)
 *
 * BUG-5: getAllowedRenderOrigins() was called on every request, re-parsing
 * APP_URL each time and emitting a logger.error on every request when APP_URL
 * was misconfigured. The fix caches the result on first call.
 *
 * These tests verify:
 * 1. The SSRF guard blocks URLs outside the allowed origin.
 * 2. The SSRF guard allows URLs matching APP_URL.
 * 3. The allowed-origins list is computed once (cache hit on second call).
 *
 * Each test resets modules so the module-level cache is cleared between cases.
 */

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared mocks (must be hoisted before any dynamic import of backHalf)
// ---------------------------------------------------------------------------

vi.mock('../../../middleware/auth', () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock('../../../middleware/tenantContext', () => ({
  tenantContextMiddleware: () => (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req['tenantId'] = 'tenant-pdf-test';
    next();
  },
}));

vi.mock('../../../repositories/IntegrityResultRepository', () => {
  const IntegrityResultRepository = vi.fn();
  IntegrityResultRepository.prototype.getLatestForCase = vi.fn().mockResolvedValue(null);
  return { IntegrityResultRepository };
});

vi.mock('../../../repositories/NarrativeDraftRepository', () => {
  const NarrativeDraftRepository = vi.fn();
  NarrativeDraftRepository.prototype.getLatestForCase = vi.fn().mockResolvedValue(null);
  return { NarrativeDraftRepository };
});

vi.mock('../../../repositories/RealizationReportRepository', () => {
  const RealizationReportRepository = vi.fn();
  RealizationReportRepository.prototype.getLatestForCase = vi.fn().mockResolvedValue(null);
  return { RealizationReportRepository };
});

vi.mock('../../../repositories/ExpansionOpportunityRepository', () => {
  const ExpansionOpportunityRepository = vi.fn();
  ExpansionOpportunityRepository.prototype.getLatestRunForCase = vi.fn().mockResolvedValue([]);
  return { ExpansionOpportunityRepository };
});

vi.mock('../../../services/SemanticMemory', () => ({ semanticMemory: {} }));

const mockExportValueCase = vi.fn().mockResolvedValue({ sizeBytes: 1024, url: '/tmp/out.pdf' });
vi.mock('../../../services/PdfExportService', () => ({
  getPdfExportService: vi.fn(() => ({ exportValueCase: mockExportValueCase })),
}));

vi.mock('../../../lib/agent-fabric/SupabaseMemoryBackend', () => ({
  SupabaseMemoryBackend: vi.fn(),
}));

vi.mock('../../../lib/agent-fabric/AgentFactory', () => ({
  createAgentFactory: vi.fn().mockReturnValue({
    hasFabricAgent: vi.fn().mockReturnValue(false),
    create: vi.fn(),
  }),
}));

vi.mock('../../../lib/agent-fabric/LLMGateway', () => ({
  LLMGateway: vi.fn(),
}));

vi.mock('../../../lib/agent-fabric/MemorySystem', () => ({
  MemorySystem: vi.fn(),
}));

vi.mock('../../../middleware/tenantDbContext', () => ({
  tenantDbContextMiddleware: () => (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req['supabase'] = { from: vi.fn() };
    next();
  },
}));

vi.mock('../../../lib/supabase', () => ({
  assertNotTestEnv: vi.fn(),
  supabase: { from: vi.fn() },
  createServerSupabaseClient: vi.fn().mockReturnValue({ from: vi.fn() }),
}));

vi.mock('../../../middleware/rateLimiter', () => ({
  rateLimiters: { strict: (_req: unknown, _res: unknown, next: () => void) => next() },
}));

// Integrity check runs before the SSRF guard. Mock it to return a passing
// score so the guard is always reached in these tests.
vi.mock('../../../services/integrity/ValueIntegrityService', () => ({
  ValueIntegrityService: vi.fn().mockImplementation(() => ({
    calculateIntegrity: vi.fn().mockResolvedValue({
      score: 1.0,
      defenseReadiness: 1.0,
      violations: [],
    }),
  })),
}));

vi.mock('../../../lib/agent-fabric/CircuitBreaker', () => ({
  CircuitBreaker: vi.fn(),
}));

const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
vi.mock('../../../lib/logger', () => ({
  logger: mockLogger,
  createLogger: vi.fn(() => mockLogger),
  log: mockLogger,
  default: mockLogger,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildApp() {
  const { backHalfRouter } = await import('../backHalf.js');
  const app = express();
  app.use(express.json());
  app.use('/api/v1/cases', backHalfRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PDF export SSRF guard (BUG-5 regression)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore env vars modified per-test
    process.env.APP_URL = originalEnv.APP_URL;
    process.env.PDF_ALLOWED_ORIGINS = originalEnv.PDF_ALLOWED_ORIGINS;
  });

  it('blocks a renderUrl pointing to an internal network address', async () => {
    process.env.APP_URL = 'https://app.example.com';
    delete process.env.PDF_ALLOWED_ORIGINS;

    const app = await buildApp();

    const res = await request(app)
      .post('/api/v1/cases/case-1/export/pdf')
      .send({ renderUrl: 'http://169.254.169.254/latest/meta-data/' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/application origin/i);
  });

  it('blocks a renderUrl pointing to a different external origin', async () => {
    process.env.APP_URL = 'https://app.example.com';
    delete process.env.PDF_ALLOWED_ORIGINS;

    const app = await buildApp();

    const res = await request(app)
      .post('/api/v1/cases/case-1/export/pdf')
      .send({ renderUrl: 'https://evil.example.com/page' });

    expect(res.status).toBe(400);
  });

  it('allows a renderUrl matching APP_URL origin', async () => {
    process.env.APP_URL = 'https://app.example.com';
    delete process.env.PDF_ALLOWED_ORIGINS;

    const app = await buildApp();

    const res = await request(app)
      .post('/api/v1/cases/case-1/export/pdf')
      .send({ renderUrl: 'https://app.example.com/cases/case-1/print' });

    // 200 or 501 (Puppeteer not installed) — either means the SSRF guard passed
    expect([200, 501]).toContain(res.status);
  });

  it('respects PDF_ALLOWED_ORIGINS override', async () => {
    process.env.PDF_ALLOWED_ORIGINS = 'https://custom.example.com';
    delete process.env.APP_URL;

    const app = await buildApp();

    const res = await request(app)
      .post('/api/v1/cases/case-1/export/pdf')
      .send({ renderUrl: 'https://app.example.com/page' });

    // app.example.com is not in PDF_ALLOWED_ORIGINS — must be blocked
    expect(res.status).toBe(400);
  });

  it('logs the misconfiguration error only once when APP_URL is invalid (BUG-5 cache)', async () => {
    process.env.APP_URL = 'not-a-valid-url';
    delete process.env.PDF_ALLOWED_ORIGINS;

    const app = await buildApp();

    // Fire two requests — the error should be logged exactly once (cached after first call)
    await request(app)
      .post('/api/v1/cases/case-1/export/pdf')
      .send({ renderUrl: 'https://anywhere.example.com/page' });

    await request(app)
      .post('/api/v1/cases/case-1/export/pdf')
      .send({ renderUrl: 'https://anywhere.example.com/page' });

    const errorCalls = mockLogger.error.mock.calls.filter((args) =>
      String(args[0]).includes('APP_URL is not a valid URL')
    );
    expect(errorCalls).toHaveLength(1);
  });
});
