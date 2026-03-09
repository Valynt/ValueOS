/**
 * backHalf router — regression tests
 *
 * Covers the lifecycle_stage bug where the narrative/run endpoint was
 * incorrectly passing 'integrity' instead of 'narrative'.
 */

import express from 'express';
import request from 'supertest';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../middleware/auth', () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock('../../../middleware/tenantContext', () => ({
  tenantContextMiddleware: () => (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req['tenantId'] = 'tenant-abc';
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

vi.mock('../../../services/PdfExportService', () => ({
  getPdfExportService: vi.fn(),
}));

vi.mock('../../../services/SemanticMemory', () => ({
  semanticMemory: {},
}));

vi.mock('../../../lib/agent-fabric/SupabaseMemoryBackend', () => {
  const SupabaseMemoryBackend = vi.fn();
  return { SupabaseMemoryBackend };
});

// Capture the LifecycleContext passed to agent.execute so we can assert on it
let capturedContext: Record<string, unknown> | null = null;

vi.mock('../../../lib/agent-fabric/AgentFactory', () => ({
  createAgentFactory: vi.fn().mockReturnValue({
    hasFabricAgent: vi.fn().mockReturnValue(true),
    create: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation((ctx: Record<string, unknown>) => {
        capturedContext = ctx;
        return Promise.resolve({ status: 'completed', result: {}, confidence: 'high' });
      }),
    }),
  }),
}));

vi.mock('../../../lib/agent-fabric/LLMGateway', () => {
  const LLMGateway = vi.fn();
  return { LLMGateway };
});

vi.mock('../../../lib/agent-fabric/MemorySystem', () => {
  const MemorySystem = vi.fn();
  return { MemorySystem };
});

vi.mock('../../../lib/agent-fabric/CircuitBreaker', () => {
  const CircuitBreaker = vi.fn();
  return { CircuitBreaker };
});

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

async function buildApp() {
  const { backHalfRouter } = await import('../backHalf.js');
  const app = express();
  app.use(express.json());
  // Mount with the same prefix used in production
  app.use('/api/v1/cases', backHalfRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('backHalf router', () => {
  beforeEach(() => {
    capturedContext = null;
    vi.clearAllMocks();
  });

  it('passes lifecycle_stage "narrative" when running the narrative agent', async () => {
    const app = await buildApp();

    await request(app)
      .post('/api/v1/cases/case-123/narrative/run')
      .send({})
      .expect(200);

    expect(capturedContext).not.toBeNull();
    expect(capturedContext!['lifecycle_stage']).toBe('narrative');
  });

  it('passes lifecycle_stage "integrity" when running the integrity agent', async () => {
    const app = await buildApp();

    await request(app)
      .post('/api/v1/cases/case-123/integrity/run')
      .send({})
      .expect(200);

    expect(capturedContext).not.toBeNull();
    expect(capturedContext!['lifecycle_stage']).toBe('integrity');
  });

  it('passes lifecycle_stage "realization" when running the realization agent', async () => {
    const app = await buildApp();

    await request(app)
      .post('/api/v1/cases/case-123/realization/run')
      .send({})
      .expect(200);

    expect(capturedContext).not.toBeNull();
    expect(capturedContext!['lifecycle_stage']).toBe('realization');
  });

  it('passes lifecycle_stage "expansion" when running the expansion agent', async () => {
    const app = await buildApp();

    await request(app)
      .post('/api/v1/cases/case-123/expansion/run')
      .send({})
      .expect(200);

    expect(capturedContext).not.toBeNull();
    expect(capturedContext!['lifecycle_stage']).toBe('expansion');
  });
});
