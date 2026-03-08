import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as autonomyModule from '../../config/autonomy.js';
import { PolicyEngine } from './index.js';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/SecurityLogger', () => ({
  securityLogger: { log: vi.fn() },
}));

vi.mock('../../services/ComplianceEvidenceService', () => ({
  complianceEvidenceService: { appendEvidence: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/AgentAuditLogger', () => ({
  logAgentResponse: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/AgentAPI', () => ({
  getAgentAPI: vi.fn(() => ({
    invokeAgent: vi.fn().mockResolvedValue({ success: true, data: {} }),
  })),
}));

vi.mock('../../services/GroundTruthIntegrationService', () => ({
  GroundTruthIntegrationService: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      validateClaim: vi.fn().mockResolvedValue({}),
      getBenchmark: vi.fn().mockResolvedValue({ value: undefined }),
    })),
  },
}));

vi.mock('../../services/ConfidenceMonitor', () => ({
  ConfidenceMonitor: vi.fn(() => ({
    getMetrics: vi.fn().mockResolvedValue({ avgConfidenceScore: 1.0 }),
  })),
}));

vi.mock('../../services/billing/TenantExecutionStateService', () => ({
  TenantExecutionStateService: vi.fn(() => ({
    getActiveState: vi.fn().mockResolvedValue(null),
  })),
}));

vi.mock('../../services/CircuitBreaker', () => ({
  CircuitBreakerManager: vi.fn(() => ({
    execute: vi.fn((_key: string, fn: () => unknown) => fn()),
  })),
}));

vi.mock('../../services/AgentRegistry', () => ({
  AgentRegistry: vi.fn(() => ({
    getAgent: vi.fn().mockReturnValue(null),
  })),
}));

vi.mock('../../services/workflows/IntegrityVetoService', () => ({
  DefaultIntegrityVetoService: vi.fn(() => ({
    evaluateIntegrityVeto: vi.fn().mockResolvedValue({ vetoed: false }),
    evaluateStructuralTruthVeto: vi.fn().mockResolvedValue({ vetoed: false }),
    performReRefine: vi.fn().mockResolvedValue({ success: false, attempts: 2 }),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEngine() {
  return new PolicyEngine();
}

// ---------------------------------------------------------------------------
// assertTenantExecutionAllowed
// ---------------------------------------------------------------------------

describe('PolicyEngine.assertTenantExecutionAllowed', () => {
  it('resolves when tenant is not paused', async () => {
    const engine = makeEngine();
    await expect(engine.assertTenantExecutionAllowed('org-1')).resolves.toBeUndefined();
  });

  it('throws when tenant execution is paused', async () => {
    const { TenantExecutionStateService } = await import('../../services/billing/TenantExecutionStateService.js');
    vi.mocked(TenantExecutionStateService).mockImplementationOnce(() => ({
      getActiveState: vi.fn().mockResolvedValue({
        is_paused: true,
        paused_at: '2024-01-01T00:00:00Z',
        reason: 'billing overdue',
      }),
    }) as never);

    const engine = new PolicyEngine();
    await expect(engine.assertTenantExecutionAllowed('org-paused')).rejects.toThrow(
      'Tenant execution is paused',
    );
  });
});

// ---------------------------------------------------------------------------
// checkAutonomyGuardrails
// ---------------------------------------------------------------------------

describe('PolicyEngine.checkAutonomyGuardrails', () => {
  const baseContext = { organizationId: 'org-1' };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes when no guardrail conditions are triggered', async () => {
    const engine = makeEngine();
    await expect(
      engine.checkAutonomyGuardrails('exec-1', 'stage-1', baseContext, Date.now()),
    ).resolves.toBeUndefined();
  });

  it('throws when global kill switch is enabled', async () => {
    vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
      max_autonomous_actions: 10,
      require_approval_threshold: 0.8,
      enabled: true,
      serviceIdentityToken: '',
      killSwitchEnabled: true,
    } as never);

    const engine = makeEngine();
    await expect(
      engine.checkAutonomyGuardrails('exec-1', 'stage-1', baseContext, Date.now()),
    ).rejects.toThrow('Autonomy kill switch is enabled');
  });

  it('throws when max duration is exceeded', async () => {
    vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
      max_autonomous_actions: 10,
      require_approval_threshold: 0.8,
      enabled: true,
      serviceIdentityToken: '',
      maxDurationMs: 1,
    } as never);

    const engine = makeEngine();
    const startTime = Date.now() - 1000; // already exceeded
    await expect(
      engine.checkAutonomyGuardrails('exec-1', 'stage-1', baseContext, startTime),
    ).rejects.toThrow('max duration exceeded');
  });

  it('throws when agent is observe-only', async () => {
    vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
      max_autonomous_actions: 10,
      require_approval_threshold: 0.8,
      enabled: true,
      serviceIdentityToken: '',
      agentAutonomyLevels: { 'agent-x': 'observe' },
    } as never);

    const engine = makeEngine();
    const context = { ...baseContext, current_agent_id: 'agent-x' };
    await expect(
      engine.checkAutonomyGuardrails('exec-1', 'stage-1', context, Date.now()),
    ).rejects.toThrow('observe-only agent');
  });

  it('throws when agent kill switch is active', async () => {
    vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
      max_autonomous_actions: 10,
      require_approval_threshold: 0.8,
      enabled: true,
      serviceIdentityToken: '',
      agentKillSwitches: { 'agent-y': true },
    } as never);

    const engine = makeEngine();
    const context = { ...baseContext, current_agent_id: 'agent-y' };
    await expect(
      engine.checkAutonomyGuardrails('exec-1', 'stage-1', context, Date.now()),
    ).rejects.toThrow('agent disabled');
  });

  it('throws when iteration limit is exceeded', async () => {
    vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
      max_autonomous_actions: 10,
      require_approval_threshold: 0.8,
      enabled: true,
      serviceIdentityToken: '',
      agentMaxIterations: { 'agent-z': 2 },
    } as never);

    const engine = makeEngine();
    const context = {
      ...baseContext,
      current_agent_id: 'agent-z',
      executed_steps: [{ agent_id: 'agent-z' }, { agent_id: 'agent-z' }],
    };
    await expect(
      engine.checkAutonomyGuardrails('exec-1', 'stage-1', context, Date.now()),
    ).rejects.toThrow('iteration limit exceeded');
  });
});

// ---------------------------------------------------------------------------
// evaluateIntegrityVeto / evaluateStructuralTruthVeto
// ---------------------------------------------------------------------------

describe('PolicyEngine integrity veto delegation', () => {
  it('returns vetoed: false when veto service clears', async () => {
    const engine = makeEngine();
    const result = await engine.evaluateIntegrityVeto({}, { traceId: 't1', agentType: 'coordinator' });
    expect(result.vetoed).toBe(false);
  });

  it('returns vetoed: true when veto service flags payload', async () => {
    const { DefaultIntegrityVetoService } = await import('../../services/workflows/IntegrityVetoService.js');
    vi.mocked(DefaultIntegrityVetoService).mockImplementationOnce(() => ({
      evaluateIntegrityVeto: vi.fn().mockResolvedValue({ vetoed: true, metadata: { integrityVeto: true, deviationPercent: 20, benchmark: 100, metricId: 'roi', claimedValue: 120 } }),
      evaluateStructuralTruthVeto: vi.fn().mockResolvedValue({ vetoed: false }),
      performReRefine: vi.fn().mockResolvedValue({ success: false, attempts: 2 }),
    }) as never);

    const engine = new PolicyEngine();
    const result = await engine.evaluateIntegrityVeto(
      { metrics: [{ metricId: 'roi', claimedValue: 120 }] },
      { traceId: 't2', agentType: 'financial-modeling' },
    );
    expect(result.vetoed).toBe(true);
    expect(result.metadata?.integrityVeto).toBe(true);
  });

  it('returns reRefine: true when confidence is low', async () => {
    const { DefaultIntegrityVetoService } = await import('../../services/workflows/IntegrityVetoService.js');
    vi.mocked(DefaultIntegrityVetoService).mockImplementationOnce(() => ({
      evaluateIntegrityVeto: vi.fn().mockResolvedValue({ vetoed: false, reRefine: true }),
      evaluateStructuralTruthVeto: vi.fn().mockResolvedValue({ vetoed: false }),
      performReRefine: vi.fn().mockResolvedValue({ success: false, attempts: 2 }),
    }) as never);

    const engine = new PolicyEngine();
    const result = await engine.evaluateIntegrityVeto({}, { traceId: 't3', agentType: 'coordinator' });
    expect(result.reRefine).toBe(true);
    expect(result.vetoed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// performReRefine — loop terminates
// ---------------------------------------------------------------------------

describe('PolicyEngine.performReRefine', () => {
  it('returns success: false when all attempts fail', async () => {
    const engine = makeEngine();
    const result = await engine.performReRefine(
      'coordinator',
      'original query',
      { userId: 'u1', sessionId: 's1', organizationId: 'org-1' },
      'trace-1',
    );
    expect(result.success).toBe(false);
    expect(typeof result.attempts).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// groundTruth init — Promise-based guard prevents double-initialization
// ---------------------------------------------------------------------------

describe('PolicyEngine ground truth initialization', () => {
  it('stores a single Promise so concurrent callers share one initialization', async () => {
    const engine = makeEngine();

    // Spy on the private groundTruthService captured at construction time.
    type EnginePrivate = {
      groundTruthService: { initialize: () => Promise<void> };
      ensureGroundTruthInitialized: () => Promise<void>;
      groundTruthInitPromise: Promise<void> | null;
    };
    const priv = engine as unknown as EnginePrivate;
    const initSpy = vi.spyOn(priv.groundTruthService, 'initialize').mockResolvedValue(undefined);

    // Call the private method directly twice concurrently.
    await Promise.all([
      priv.ensureGroundTruthInitialized(),
      priv.ensureGroundTruthInitialized(),
    ]);

    // The ??= guard means initialize() is called exactly once; both callers
    // await the same stored Promise.
    expect(initSpy).toHaveBeenCalledTimes(1);
  });

  it('reuses the stored Promise on subsequent calls after initialization', async () => {
    const engine = makeEngine();
    type EnginePrivate = {
      groundTruthService: { initialize: () => Promise<void> };
      ensureGroundTruthInitialized: () => Promise<void>;
    };
    const priv = engine as unknown as EnginePrivate;
    const initSpy = vi.spyOn(priv.groundTruthService, 'initialize').mockResolvedValue(undefined);

    await priv.ensureGroundTruthInitialized();
    await priv.ensureGroundTruthInitialized();
    await priv.ensureGroundTruthInitialized();

    expect(initSpy).toHaveBeenCalledTimes(1);
  });
});
