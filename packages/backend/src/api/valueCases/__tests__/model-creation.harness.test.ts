/**
 * E2E harness: Model Creation flow
 *
 * Tests the full financial modeling lifecycle via HTTP (supertest):
 *   1. Create value case
 *   2. Calculate financial metrics (Economic Kernel)
 *   3. Generate scenarios (conservative / base / upside)
 *   4. Update an assumption and trigger recalculation
 *   5. Fetch latest snapshot
 *   6. Fetch integrity output
 *
 * Mocking strategy:
 * - Supabase: in-memory store (no live DB required)
 * - Auth middleware: injects fixed tenantId + userId
 * - Rate limiters: pass-through
 * - Economic Kernel: NOT mocked — runs real Decimal.js calculations
 *
 * Timing gate: full flow must complete in < 5 seconds.
 */

import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'org-e2e-test-1';
const USER_ID = 'user-e2e-test-1';
const DISCOUNT_RATE = '0.10';

// ---------------------------------------------------------------------------
// In-memory snapshot store (replaces Supabase for this harness)
// ---------------------------------------------------------------------------

interface SnapshotRecord {
  id: string;
  case_id: string;
  organization_id: string;
  snapshot_version: number;
  roi: number | null;
  npv: number | null;
  payback_period_months: number | null;
  assumptions_json: unknown[];
  outputs_json: Record<string, unknown>;
  source_agent: string | null;
  created_at: string;
}

const snapshotStore = new Map<string, SnapshotRecord[]>();

function storeKey(caseId: string, orgId: string) {
  return `${orgId}::${caseId}`;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../middleware/auth', () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  requireRole: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock('../../../middleware/tenantContext', () => ({
  // Pass-through: tenantId is injected by the test app's own middleware so
  // that per-test tenant overrides (e.g. T5 isolation) are respected.
  tenantContextMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../middleware/tenantDbContext', () => ({
  tenantDbContextMiddleware: () => (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req['supabase'] = { from: vi.fn() };
    next();
  },
}));

const passThroughMiddleware = (_req: unknown, _res: unknown, next: () => void) => next();
vi.mock('../../../middleware/rateLimiter', () => ({
  createRateLimiter: vi.fn(() => passThroughMiddleware),
  rateLimiters: { standard: passThroughMiddleware, strict: passThroughMiddleware },
  RateLimitTier: { STANDARD: 'standard', STRICT: 'strict' },
}));

const fakeClient = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() }) };

vi.mock('../../../lib/supabase', () => ({
  assertNotTestEnv: vi.fn(),
  supabase: fakeClient,
  createServerSupabaseClient: vi.fn().mockReturnValue(fakeClient),
  createServiceRoleSupabaseClient: vi.fn().mockReturnValue(fakeClient),
  createUserSupabaseClient: vi.fn().mockReturnValue(fakeClient),
  createRequestSupabaseClient: vi.fn().mockReturnValue(fakeClient),
}));

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

// ValueCasesRepository — in-memory CRUD
const caseStore = new Map<string, Record<string, unknown>>();

vi.mock('../repository', () => {
  class ValueCasesRepository {
    static fromRequest() { return new ValueCasesRepository(); }
    async create(data: Record<string, unknown>) {
      const id = uuidv4();
      const record = { ...data, id, created_at: new Date().toISOString() };
      caseStore.set(id, record);
      return record;
    }
    async findById(id: string, orgId: string) {
      const r = caseStore.get(id);
      return r && r['organization_id'] === orgId ? r : null;
    }
    async list() { return { data: [...caseStore.values()], total: caseStore.size }; }
    async update(id: string, _orgId: string, data: Record<string, unknown>) {
      const existing = caseStore.get(id) ?? {};
      const updated = { ...existing, ...data };
      caseStore.set(id, updated);
      return updated;
    }
    async delete(id: string) { caseStore.delete(id); }
  }
  class ConflictError extends Error { constructor(msg: string) { super(msg); this.name = 'ConflictError'; } }
  class NotFoundError extends Error { constructor(msg: string) { super(msg); this.name = 'NotFoundError'; } }
  class DatabaseError extends Error { constructor(msg: string) { super(msg); this.name = 'DatabaseError'; } }
  return { ValueCasesRepository, ConflictError, NotFoundError, DatabaseError };
});

// FinancialModelSnapshotRepository — in-memory
vi.mock('../../../repositories/FinancialModelSnapshotRepository', () => {
  class FinancialModelSnapshotRepository {
    async createSnapshot(input: {
      case_id: string;
      organization_id: string;
      roi?: number;
      npv?: number;
      payback_period_months?: number;
      assumptions_json: unknown[];
      outputs_json: Record<string, unknown>;
      source_agent?: string;
    }): Promise<SnapshotRecord> {
      const key = storeKey(input.case_id, input.organization_id);
      const existing = snapshotStore.get(key) ?? [];
      const nextVersion = (existing[existing.length - 1]?.snapshot_version ?? 0) + 1;
      const record: SnapshotRecord = {
        id: uuidv4(),
        case_id: input.case_id,
        organization_id: input.organization_id,
        snapshot_version: nextVersion,
        roi: input.roi ?? null,
        npv: input.npv ?? null,
        payback_period_months: input.payback_period_months ?? null,
        assumptions_json: input.assumptions_json,
        outputs_json: input.outputs_json,
        source_agent: input.source_agent ?? null,
        created_at: new Date().toISOString(),
      };
      snapshotStore.set(key, [...existing, record]);
      return record;
    }

    async getLatestSnapshotForCase(caseId: string, orgId: string): Promise<SnapshotRecord | null> {
      const key = storeKey(caseId, orgId);
      const records = snapshotStore.get(key) ?? [];
      return records[records.length - 1] ?? null;
    }
  }
  return { FinancialModelSnapshotRepository };
});

// IntegrityOutputRepository — returns a passing score
vi.mock('../../../repositories/IntegrityOutputRepository', () => ({
  integrityOutputRepository: {
    getLatestForCase: vi.fn().mockResolvedValue({
      id: uuidv4(),
      score: 0.85,
      violations: [],
      evaluated_at: new Date().toISOString(),
    }),
    getForCase: vi.fn().mockResolvedValue({
      id: uuidv4(),
      score: 0.85,
      violations: [],
      evaluated_at: new Date().toISOString(),
    }),
  },
}));

// ValueTreeRepository — minimal stub
vi.mock('../../../repositories/ValueTreeRepository', () => ({
  ValueTreeRepository: vi.fn().mockImplementation(() => ({
    getForCase: vi.fn().mockResolvedValue(null),
  })),
}));

// CaseValueTreeService — stub
vi.mock('../../../services/value/CaseValueTreeService', () => ({
  caseValueTreeService: { getOrCreate: vi.fn().mockResolvedValue({ nodes: [] }) },
  ValueTreeNodeInputSchema: { parse: vi.fn((x: unknown) => x) },
}));

// HypothesisOutputService — stub
vi.mock('../../../services/value/HypothesisOutputService', () => ({
  hypothesisOutputService: { getForCase: vi.fn().mockResolvedValue([]) },
}));

// ReadinessScorer — stub
vi.mock('../../../services/integrity/ReadinessScorer', () => ({
  ReadinessScorer: vi.fn().mockImplementation(() => ({
    score: vi.fn().mockResolvedValue({ score: 0.85, breakdown: {} }),
  })),
}));

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

async function buildApp() {
  const { default: router } = await import('../index');
  const app = express();
  app.use(express.json());
  // Inject auth context
  app.use((req: express.Request & Record<string, unknown>, _res: express.Response, next: express.NextFunction) => {
    req['user'] = { id: USER_ID, tenant_id: TENANT_ID };
    req['tenantId'] = TENANT_ID;
    req['correlationId'] = uuidv4();
    next();
  });
  app.use('/api/v1/cases', router);
  return app;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_ASSUMPTIONS = [
  {
    id: uuidv4(),
    name: 'Annual Revenue Uplift',
    value: '500000',
    unit: 'USD',
    sensitivity_low: '0.8',
    sensitivity_high: '1.2',
  },
  {
    id: uuidv4(),
    name: 'Implementation Cost',
    value: '100000',
    unit: 'USD',
    sensitivity_low: '0.9',
    sensitivity_high: '1.1',
  },
];

const CASH_FLOWS = [
  { period: 0, amount: '-100000', description: 'Initial investment' },
  { period: 1, amount: '500000', description: 'Year 1 revenue' },
  { period: 2, amount: '500000', description: 'Year 2 revenue' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Model Creation E2E flow', () => {
  let app: express.Express;
  let caseId: string;

  beforeEach(async () => {
    caseStore.clear();
    snapshotStore.clear();
    app = await buildApp();
  });

  it('T1: full happy path — all 6 steps return 2xx and snapshotId is consistent', async () => {
    const start = Date.now();

    // Step 1: Create value case
    const createRes = await request(app)
      .post('/api/v1/cases')
      .send({
        name: 'E2E Test Case',
        companyName: 'Acme Corp',
        description: 'Model creation harness',
      })
      .expect(201);

    caseId = createRes.body.data?.id ?? createRes.body.id;
    expect(caseId).toBeTruthy();

    // Step 2: Calculate financial metrics
    const calcRes = await request(app)
      .post(`/api/v1/cases/${caseId}/calculate`)
      .send({ cashFlows: CASH_FLOWS, discountRate: DISCOUNT_RATE })
      .expect(200);

    expect(calcRes.body.data).toHaveProperty('npv');
    expect(calcRes.body.data).toHaveProperty('irr');

    // Step 3: Generate scenarios
    const scenarioRes = await request(app)
      .post(`/api/v1/cases/${caseId}/scenarios`)
      .send({
        baseAssumptions: BASE_ASSUMPTIONS,
        discountRate: DISCOUNT_RATE,
        scenarioMultipliers: {
          conservative: { [BASE_ASSUMPTIONS[0].id]: '0.8' },
          upside: { [BASE_ASSUMPTIONS[0].id]: '1.2' },
        },
        mode: 'manual',
      })
      .expect(200);

    const snapshotId = scenarioRes.body.data?.snapshotId;
    expect(snapshotId).toBeTruthy();
    expect(scenarioRes.body.data.source).toBe('manual');
    expect(scenarioRes.body.data.scenarios).toHaveLength(3);

    // Step 4: Update an assumption with recalc
    const assumptionId = BASE_ASSUMPTIONS[0].id;
    const patchRes = await request(app)
      .patch(`/api/v1/cases/${caseId}/assumptions/${assumptionId}`)
      .send({ value: '600000', recalc: true })
      .expect(200);

    expect(patchRes.body.data.assumption.value).toBe('600000');
    expect(patchRes.body.data.recalculation).not.toBeNull();
    expect(patchRes.body.data.recalculation.snapshotId).toBeTruthy();

    // Step 5: Fetch latest snapshot
    const latestRes = await request(app)
      .get(`/api/v1/cases/${caseId}/model-snapshots/latest`)
      .expect(200);

    // Latest snapshot should be the one created by the assumption update
    expect(latestRes.body.data?.id).toBe(patchRes.body.data.recalculation.snapshotId);

    // Step 6: Fetch integrity
    await request(app)
      .get(`/api/v1/cases/${caseId}/integrity`)
      .expect(200);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  it('T2: scenario NPV ordering — conservative NPV < base NPV < upside NPV', async () => {
    const createRes = await request(app)
      .post('/api/v1/cases')
      .send({ name: 'NPV Order Test', companyName: 'Acme Corp' })
      .expect(201);
    caseId = createRes.body.data?.id ?? createRes.body.id;

    // Explicit cash flows with a positive base NPV (inflow >> outflow).
    // Multipliers on the revenue assumption scale the inflows via netMultiplier,
    // so conservative produces a lower NPV and upside a higher NPV than base.
    const revenueId = uuidv4();
    const revenueAssumption = [{ id: revenueId, name: 'Revenue', value: '100000', unit: 'USD' }];

    const scenarioRes = await request(app)
      .post(`/api/v1/cases/${caseId}/scenarios`)
      .send({
        baseAssumptions: revenueAssumption,
        discountRate: DISCOUNT_RATE,
        cashFlows: [
          { period: 0, amount: '-50000' },
          { period: 1, amount: '100000' },
          { period: 2, amount: '100000' },
        ],
        scenarioMultipliers: {
          conservative: { [revenueId]: '0.5' },
          upside: { [revenueId]: '2.0' },
        },
        mode: 'manual',
      })
      .expect(200);

    const scenarios = scenarioRes.body.data.scenarios as Array<{
      scenario: string;
      npv: string;
    }>;

    const byType = Object.fromEntries(scenarios.map(s => [s.scenario, parseFloat(s.npv)]));
    // Conservative scales inflows by 0.5 → lower NPV; upside by 2.0 → higher NPV
    expect(byType['conservative']).toBeLessThan(byType['base']);
    expect(byType['base']).toBeLessThan(byType['upside']);
  });

  it('T3: assumption recalc produces a new snapshot with a different NPV', async () => {
    const createRes = await request(app)
      .post('/api/v1/cases')
      .send({ name: 'Recalc Test', companyName: 'Acme Corp' })
      .expect(201);
    caseId = createRes.body.data?.id ?? createRes.body.id;

    // Generate initial scenarios to create a snapshot
    const scenarioRes = await request(app)
      .post(`/api/v1/cases/${caseId}/scenarios`)
      .send({
        baseAssumptions: BASE_ASSUMPTIONS,
        discountRate: DISCOUNT_RATE,
        mode: 'manual',
      })
      .expect(200);

    const initialSnapshotId = scenarioRes.body.data.snapshotId;
    const initialNpv = parseFloat(
      scenarioRes.body.data.scenarios.find((s: { scenario: string }) => s.scenario === 'base').npv,
    );

    // Update only the first assumption value — recalc derives new cash flows
    const patchRes = await request(app)
      .patch(`/api/v1/cases/${caseId}/assumptions/${BASE_ASSUMPTIONS[0].id}`)
      .send({ value: '999999', recalc: true })
      .expect(200);

    const recalc = patchRes.body.data.recalculation;
    // A new snapshot must have been created
    expect(recalc.snapshotId).toBeTruthy();
    expect(recalc.snapshotId).not.toBe(initialSnapshotId);
    // NPV must have changed (different assumption value → different cash flows)
    const newNpv = parseFloat(recalc.npv);
    expect(newNpv).not.toBeCloseTo(initialNpv, 2);
  });

  it('T4: NPV values are strings (Decimal precision — no float drift)', async () => {
    const createRes = await request(app)
      .post('/api/v1/cases')
      .send({ name: 'Decimal Test', companyName: 'Acme Corp' })
      .expect(201);
    caseId = createRes.body.data?.id ?? createRes.body.id;

    // Use assumptions that would produce 0.1 + 0.2 float drift if not using Decimal
    const precisionAssumptions = [
      { id: uuidv4(), name: 'A', value: '0.1', unit: 'USD' },
      { id: uuidv4(), name: 'B', value: '0.2', unit: 'USD' },
    ];

    const scenarioRes = await request(app)
      .post(`/api/v1/cases/${caseId}/scenarios`)
      .send({
        baseAssumptions: precisionAssumptions,
        discountRate: DISCOUNT_RATE,
        mode: 'manual',
      })
      .expect(200);

    const baseScenario = scenarioRes.body.data.scenarios.find(
      (s: { scenario: string }) => s.scenario === 'base',
    );

    // NPV must be a string, not a float
    expect(typeof baseScenario.npv).toBe('string');
    // Must not contain float drift (e.g. "0.30000000000000004")
    expect(baseScenario.npv).not.toMatch(/0{5,}/);
  });

  it('T5: tenant isolation — assumption update for wrong tenant returns 404 NO_SNAPSHOT', async () => {
    const createRes = await request(app)
      .post('/api/v1/cases')
      .send({ name: 'Isolation Test', companyName: 'Acme Corp' })
      .expect(201);
    caseId = createRes.body.data?.id ?? createRes.body.id;

    // Create a snapshot under TENANT_ID
    await request(app)
      .post(`/api/v1/cases/${caseId}/scenarios`)
      .send({ baseAssumptions: BASE_ASSUMPTIONS, discountRate: DISCOUNT_RATE, mode: 'manual' })
      .expect(200);

    // Build an app with a different tenant using the same cached router module.
    // snapshotStore is keyed by (caseId, orgId) so 'org-other' has no snapshot.
    const { default: router } = await import('../index');
    const otherTenantApp = express();
    otherTenantApp.use(express.json());
    otherTenantApp.use(
      (req: express.Request & Record<string, unknown>, _res: express.Response, next: express.NextFunction) => {
        req['user'] = { id: 'other-user', tenant_id: 'org-other' };
        req['tenantId'] = 'org-other';
        req['correlationId'] = uuidv4();
        next();
      },
    );
    otherTenantApp.use('/api/v1/cases', router);

    // The other tenant has no snapshot for this caseId → 404 NO_SNAPSHOT
    const res = await request(otherTenantApp)
      .patch(`/api/v1/cases/${caseId}/assumptions/${BASE_ASSUMPTIONS[0].id}`)
      .send({ value: '1', recalc: true });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NO_SNAPSHOT');
  });

  it('T6: assumption update before any snapshot returns 404 NO_SNAPSHOT', async () => {
    const createRes = await request(app)
      .post('/api/v1/cases')
      .send({ name: 'No Snapshot Test', companyName: 'Acme Corp' })
      .expect(201);
    caseId = createRes.body.data?.id ?? createRes.body.id;

    // Attempt to update assumption without first generating a snapshot
    const res = await request(app)
      .patch(`/api/v1/cases/${caseId}/assumptions/${BASE_ASSUMPTIONS[0].id}`)
      .send({ value: '999', recalc: true })
      .expect(404);

    expect(res.body.error).toBe('NO_SNAPSHOT');
  });

  it('T7: mode rerun returns status running with agentRunId', async () => {
    const createRes = await request(app)
      .post('/api/v1/cases')
      .send({ name: 'Rerun Test', companyName: 'Acme Corp' })
      .expect(201);
    caseId = createRes.body.data?.id ?? createRes.body.id;

    const res = await request(app)
      .post(`/api/v1/cases/${caseId}/scenarios`)
      .send({
        baseAssumptions: BASE_ASSUMPTIONS,
        discountRate: DISCOUNT_RATE,
        mode: 'rerun',
      })
      .expect(200);

    expect(res.body.data.status).toBe('running');
    expect(res.body.data.agentRunId).toBeTruthy();
    expect(res.body.data.snapshotId).toBeNull();
    expect(res.body.data.source).toBe('agent');
  });
});
