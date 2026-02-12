/**
 * Integration Tests: HypothesisLoop with Mock Agents
 *
 * Instantiates HypothesisLoop with mock agents from mock-agents.ts
 * and the fixtures from integration/hypothesis-loop-fixtures.ts.
 * Validates end-to-end loop execution, state transitions, and failure handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HypothesisLoop } from '../../orchestration/HypothesisLoop.js';
import { ValueCaseSaga, SagaState } from '../../core/ValueCaseSaga.js';
import { IdempotencyGuard } from '../../core/IdempotencyGuard.js';
import { DeadLetterQueue } from '../../core/DeadLetterQueue.js';
import {
  createMockOpportunityAgent,
  createMockFinancialModelingAgent,
  createMockGroundTruthAgent,
  createMockNarrativeAgent,
  createMockRedTeamAgent,
  createMockIdempotencyStore,
  createMockDLQStore,
  createMockEventEmitter,
  createMockAuditLogger,
  createMockSagaPersistence,
} from '../mock-agents.js';
import {
  happyPathFixture,
  revisionPathFixture,
  failureFixture,
  type LoopFixture,
} from '../datasets/integration/hypothesis-loop-fixtures.js';
import type { LoopProgress } from '../../orchestration/HypothesisLoop.js';

// ============================================================================
// Helpers
// ============================================================================

function buildLoop(fixture: LoopFixture, opts?: { simulateError?: boolean }) {
  const persistence = createMockSagaPersistence();
  const eventEmitter = createMockEventEmitter();
  const auditLogger = createMockAuditLogger();
  const idempotencyStore = createMockIdempotencyStore();
  const dlqStore = createMockDLQStore();

  const saga = new ValueCaseSaga({ persistence, eventEmitter, auditLogger });
  const idempotencyGuard = new IdempotencyGuard(idempotencyStore);
  const dlq = new DeadLetterQueue(dlqStore, eventEmitter);

  const { agentResponses } = fixture;

  const opportunityAgent = createMockOpportunityAgent(
    new Map([[fixture.tenantId, agentResponses.opportunity]])
  );

  // For the failure fixture, make financial modeling throw
  const financialModelingAgent = createMockFinancialModelingAgent(
    opts?.simulateError
      ? new Map() // Empty map → will throw "No mock response configured"
      : new Map([[fixture.tenantId, agentResponses.financialModeling]])
  );

  const groundTruthAgent = createMockGroundTruthAgent(
    new Map([[fixture.tenantId, agentResponses.groundtruth]])
  );

  const narrativeAgent = createMockNarrativeAgent(
    new Map([[fixture.tenantId, agentResponses.narrative]])
  );

  const redTeamAgent = createMockRedTeamAgent(
    new Map([[fixture.tenantId, agentResponses.redTeam]])
  );

  const loop = new HypothesisLoop({
    saga,
    idempotencyGuard,
    dlq,
    opportunityAgent,
    financialModelingAgent,
    groundTruthAgent,
    narrativeAgent,
    redTeamAgent,
    config: { maxRevisionCycles: 3 },
  });

  return { loop, saga, persistence, eventEmitter, auditLogger, dlqStore, idempotencyStore };
}

// ============================================================================
// Happy Path
// ============================================================================

describe('HypothesisLoop — happy path', () => {
  it('runs end-to-end and reaches FINALIZED', async () => {
    const fixture = happyPathFixture;
    const { loop, persistence, eventEmitter } = buildLoop(fixture);

    // Initialize saga
    const { saga } = buildLoop(fixture);
    // Use the loop's internal saga — we need to initialize before running
    // The loop calls saga.transition, so we need to initialize the saga state first
    const { loop: testLoop, persistence: testPersistence, eventEmitter: testEmitter } = buildLoop(fixture);

    // Initialize saga state
    const testSaga = new ValueCaseSaga({
      persistence: testPersistence,
      eventEmitter: testEmitter,
      auditLogger: createMockAuditLogger(),
    });
    await testSaga.initialize(fixture.valueCaseId, fixture.tenantId, fixture.correlationId);

    const result = await testLoop.run(
      fixture.valueCaseId,
      fixture.tenantId,
      fixture.correlationId
    );

    expect(result.success).toBe(fixture.expected.success);
    expect(result.finalState).toBe(fixture.expected.finalState);
    expect(result.hypotheses.length).toBeGreaterThanOrEqual(fixture.expected.minHypotheses);
    expect(result.revisionCount).toBe(fixture.expected.revisionCount);

    if (fixture.expected.hasValueTree) {
      expect(result.valueTree).not.toBeNull();
    }
    if (fixture.expected.hasNarrative) {
      expect(result.narrative).not.toBeNull();
    }
    if (fixture.expected.hasObjections) {
      expect(result.objections.length).toBeGreaterThan(0);
    }
  });

  it('emits SSE progress events for each step', async () => {
    const fixture = happyPathFixture;
    const { loop, persistence, eventEmitter } = buildLoop(fixture);

    const testSaga = new ValueCaseSaga({
      persistence,
      eventEmitter,
      auditLogger: createMockAuditLogger(),
    });
    await testSaga.initialize(fixture.valueCaseId, fixture.tenantId, fixture.correlationId);

    const progressEvents: LoopProgress[] = [];
    const sse = { send: (data: LoopProgress) => progressEvents.push(data) };

    await loop.run(fixture.valueCaseId, fixture.tenantId, fixture.correlationId, sse);

    // Should have progress events for each step (running + completed)
    expect(progressEvents.length).toBeGreaterThanOrEqual(10); // 5 steps * 2 (running + completed) + approval
    expect(progressEvents.some((e) => e.stepName === 'Hypothesis')).toBe(true);
    expect(progressEvents.some((e) => e.stepName === 'Model')).toBe(true);
    expect(progressEvents.some((e) => e.stepName === 'Evidence')).toBe(true);
    expect(progressEvents.some((e) => e.stepName === 'Narrative')).toBe(true);
    expect(progressEvents.some((e) => e.stepName === 'Objection')).toBe(true);
    expect(progressEvents.some((e) => e.stepName === 'Approval')).toBe(true);
  });

  it('emits saga.state.transitioned domain events', async () => {
    const fixture = happyPathFixture;
    const { loop, persistence, eventEmitter } = buildLoop(fixture);

    const testSaga = new ValueCaseSaga({
      persistence,
      eventEmitter,
      auditLogger: createMockAuditLogger(),
    });
    await testSaga.initialize(fixture.valueCaseId, fixture.tenantId, fixture.correlationId);

    await loop.run(fixture.valueCaseId, fixture.tenantId, fixture.correlationId);

    const sagaEvents = eventEmitter.events.filter(
      (e) => e.type === 'saga.state.transitioned'
    );
    // INITIATED (from initialize) + DRAFTING + VALIDATING + COMPOSING + REFINING + FINALIZED
    expect(sagaEvents.length).toBeGreaterThanOrEqual(5);
  });
});

// ============================================================================
// Revision Path (critical objection triggers re-draft)
// ============================================================================

describe('HypothesisLoop — revision path', () => {
  it('re-enters DRAFTING on critical objection', async () => {
    const fixture = revisionPathFixture;
    const { loop, persistence, eventEmitter } = buildLoop(fixture);

    const testSaga = new ValueCaseSaga({
      persistence,
      eventEmitter,
      auditLogger: createMockAuditLogger(),
    });
    await testSaga.initialize(fixture.valueCaseId, fixture.tenantId, fixture.correlationId);

    const result = await loop.run(
      fixture.valueCaseId,
      fixture.tenantId,
      fixture.correlationId
    );

    expect(result.success).toBe(fixture.expected.success);
    expect(result.finalState).toBe(fixture.expected.finalState);
    // The loop should have done at least 1 revision
    expect(result.revisionCount).toBeGreaterThanOrEqual(1);
    expect(result.objections.length).toBeGreaterThan(0);
    expect(result.objections.some((o) => o.severity === 'critical')).toBe(true);
  });

  it('records state transitions including backward flow', async () => {
    const fixture = revisionPathFixture;
    const { loop, persistence, eventEmitter } = buildLoop(fixture);

    const testSaga = new ValueCaseSaga({
      persistence,
      eventEmitter,
      auditLogger: createMockAuditLogger(),
    });
    await testSaga.initialize(fixture.valueCaseId, fixture.tenantId, fixture.correlationId);

    await loop.run(fixture.valueCaseId, fixture.tenantId, fixture.correlationId);

    const transitions = persistence.transitions;
    // Should include backward transitions (REFINING → DRAFTING or COMPOSING → DRAFTING)
    const backwardTransitions = transitions.filter(
      (t) => t.toState === 'DRAFTING' && t.fromState !== 'INITIATED'
    );
    expect(backwardTransitions.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Failure Path (agent error → compensation + DLQ)
// ============================================================================

describe('HypothesisLoop — failure path', () => {
  it('handles agent failure gracefully', async () => {
    const fixture = failureFixture;
    const { loop, persistence, eventEmitter, dlqStore } = buildLoop(fixture, {
      simulateError: true,
    });

    const testSaga = new ValueCaseSaga({
      persistence,
      eventEmitter,
      auditLogger: createMockAuditLogger(),
    });
    await testSaga.initialize(fixture.valueCaseId, fixture.tenantId, fixture.correlationId);

    const result = await loop.run(
      fixture.valueCaseId,
      fixture.tenantId,
      fixture.correlationId
    );

    expect(result.success).toBe(false);
    expect(result.finalState).toBe('FAILED');
    expect(result.error).toBeTruthy();
  });

  it('routes failed tasks to DLQ', async () => {
    const fixture = failureFixture;
    const { loop, persistence, eventEmitter, dlqStore } = buildLoop(fixture, {
      simulateError: true,
    });

    const testSaga = new ValueCaseSaga({
      persistence,
      eventEmitter,
      auditLogger: createMockAuditLogger(),
    });
    await testSaga.initialize(fixture.valueCaseId, fixture.tenantId, fixture.correlationId);

    await loop.run(fixture.valueCaseId, fixture.tenantId, fixture.correlationId);

    // DLQ should have at least one entry
    expect(dlqStore.entries.length).toBeGreaterThanOrEqual(1);

    const dlqEntry = JSON.parse(dlqStore.entries[0]!);
    expect(dlqEntry.agentType).toBeTruthy();
    expect(dlqEntry.error).toBeTruthy();
    expect(dlqEntry.correlationId).toBe(fixture.correlationId);
    expect(dlqEntry.tenantId).toBe(fixture.tenantId);
  });

  it('emits system.dlq.enqueued event on failure', async () => {
    const fixture = failureFixture;
    const { loop, persistence, eventEmitter } = buildLoop(fixture, {
      simulateError: true,
    });

    const testSaga = new ValueCaseSaga({
      persistence,
      eventEmitter,
      auditLogger: createMockAuditLogger(),
    });
    await testSaga.initialize(fixture.valueCaseId, fixture.tenantId, fixture.correlationId);

    await loop.run(fixture.valueCaseId, fixture.tenantId, fixture.correlationId);

    const dlqEvents = eventEmitter.events.filter(
      (e) => e.type === 'system.dlq.enqueued'
    );
    expect(dlqEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// ValueCaseSaga unit tests (via integration infrastructure)
// ============================================================================

describe('ValueCaseSaga — state machine', () => {
  let saga: ValueCaseSaga;
  let persistence: ReturnType<typeof createMockSagaPersistence>;
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;

  const valueCaseId = '550e8400-e29b-41d4-a716-446655440099';
  const tenantId = 'tenant-test';
  const correlationId = '660e8400-e29b-41d4-a716-446655440099';

  beforeEach(async () => {
    persistence = createMockSagaPersistence();
    eventEmitter = createMockEventEmitter();
    saga = new ValueCaseSaga({
      persistence,
      eventEmitter,
      auditLogger: createMockAuditLogger(),
    });
    await saga.initialize(valueCaseId, tenantId, correlationId);
  });

  it('initializes in INITIATED state', async () => {
    const state = await saga.getState(valueCaseId);
    expect(state?.state).toBe(SagaState.INITIATED);
  });

  it('transitions through the forward path', async () => {
    await saga.transition(valueCaseId, 'OPPORTUNITY_INGESTED', correlationId);
    expect((await saga.getState(valueCaseId))?.state).toBe('DRAFTING');

    await saga.transition(valueCaseId, 'HYPOTHESIS_CONFIRMED', correlationId);
    expect((await saga.getState(valueCaseId))?.state).toBe('VALIDATING');

    await saga.transition(valueCaseId, 'INTEGRITY_PASSED', correlationId);
    expect((await saga.getState(valueCaseId))?.state).toBe('COMPOSING');

    await saga.transition(valueCaseId, 'FEEDBACK_RECEIVED', correlationId);
    expect((await saga.getState(valueCaseId))?.state).toBe('REFINING');

    await saga.transition(valueCaseId, 'VE_APPROVED', correlationId);
    expect((await saga.getState(valueCaseId))?.state).toBe('FINALIZED');
  });

  it('supports backward transitions (integrity veto)', async () => {
    await saga.transition(valueCaseId, 'OPPORTUNITY_INGESTED', correlationId);
    await saga.transition(valueCaseId, 'HYPOTHESIS_CONFIRMED', correlationId);
    expect((await saga.getState(valueCaseId))?.state).toBe('VALIDATING');

    await saga.transition(valueCaseId, 'INTEGRITY_VETOED', correlationId);
    expect((await saga.getState(valueCaseId))?.state).toBe('DRAFTING');
  });

  it('supports backward transitions (red team objection)', async () => {
    await saga.transition(valueCaseId, 'OPPORTUNITY_INGESTED', correlationId);
    await saga.transition(valueCaseId, 'HYPOTHESIS_CONFIRMED', correlationId);
    await saga.transition(valueCaseId, 'INTEGRITY_PASSED', correlationId);
    expect((await saga.getState(valueCaseId))?.state).toBe('COMPOSING');

    await saga.transition(valueCaseId, 'REDTEAM_OBJECTION', correlationId);
    expect((await saga.getState(valueCaseId))?.state).toBe('DRAFTING');
  });

  it('supports backward transitions (user feedback)', async () => {
    await saga.transition(valueCaseId, 'OPPORTUNITY_INGESTED', correlationId);
    await saga.transition(valueCaseId, 'HYPOTHESIS_CONFIRMED', correlationId);
    await saga.transition(valueCaseId, 'INTEGRITY_PASSED', correlationId);
    await saga.transition(valueCaseId, 'FEEDBACK_RECEIVED', correlationId);
    expect((await saga.getState(valueCaseId))?.state).toBe('REFINING');

    await saga.transition(valueCaseId, 'USER_FEEDBACK', correlationId);
    expect((await saga.getState(valueCaseId))?.state).toBe('DRAFTING');
  });

  it('throws on invalid transitions', async () => {
    // Cannot go from INITIATED to VALIDATING directly
    await expect(
      saga.transition(valueCaseId, 'HYPOTHESIS_CONFIRMED', correlationId)
    ).rejects.toThrow(/Invalid transition/);
  });

  it('records transitions in persistence', async () => {
    await saga.transition(valueCaseId, 'OPPORTUNITY_INGESTED', correlationId);
    expect(persistence.transitions).toHaveLength(1);
    expect(persistence.transitions[0]!.fromState).toBe('INITIATED');
    expect(persistence.transitions[0]!.toState).toBe('DRAFTING');
  });

  it('emits domain events on transitions', async () => {
    await saga.transition(valueCaseId, 'OPPORTUNITY_INGESTED', correlationId);
    const sagaEvents = eventEmitter.events.filter(
      (e) => e.type === 'saga.state.transitioned'
    );
    // 1 from initialize + 1 from transition
    expect(sagaEvents.length).toBe(2);
  });

  it('executes compensation handlers', async () => {
    await saga.transition(valueCaseId, 'OPPORTUNITY_INGESTED', correlationId);
    const results = await saga.compensate(valueCaseId, correlationId);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.success).toBe(true);
  });
});

// ============================================================================
// IdempotencyGuard unit tests
// ============================================================================

describe('IdempotencyGuard', () => {
  it('returns cached result on duplicate key', async () => {
    const store = createMockIdempotencyStore();
    const guard = new IdempotencyGuard(store);
    const key = crypto.randomUUID();

    let callCount = 0;
    const fn = async () => {
      callCount++;
      return { value: 42 };
    };

    const first = await guard.execute(key, fn);
    expect(first.cached).toBe(false);
    expect(first.result).toEqual({ value: 42 });
    expect(callCount).toBe(1);

    const second = await guard.execute(key, fn);
    expect(second.cached).toBe(true);
    expect(second.result).toEqual({ value: 42 });
    expect(callCount).toBe(1); // Not called again
  });

  it('rejects invalid idempotency keys', async () => {
    const store = createMockIdempotencyStore();
    const guard = new IdempotencyGuard(store);

    await expect(
      guard.execute('not-a-uuid', async () => 'result')
    ).rejects.toThrow(/Invalid idempotency key/);
  });
});

// ============================================================================
// DeadLetterQueue unit tests
// ============================================================================

describe('DeadLetterQueue', () => {
  it('enqueues and lists entries', async () => {
    const store = createMockDLQStore();
    const emitter = createMockEventEmitter();
    const dlq = new DeadLetterQueue(store, emitter);

    await dlq.enqueue({
      taskId: 'task-1',
      agentType: 'test-agent',
      input: { foo: 'bar' },
      error: 'Something failed',
      timestamp: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
      tenantId: 'tenant-1',
      retryCount: 0,
    });

    const entries = await dlq.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.taskId).toBe('task-1');

    const count = await dlq.count();
    expect(count).toBe(1);
  });

  it('emits system.dlq.enqueued event', async () => {
    const store = createMockDLQStore();
    const emitter = createMockEventEmitter();
    const dlq = new DeadLetterQueue(store, emitter);

    await dlq.enqueue({
      taskId: 'task-2',
      agentType: 'test-agent',
      input: {},
      error: 'Timeout',
      timestamp: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
      tenantId: 'tenant-2',
      retryCount: 3,
    });

    const dlqEvents = emitter.events.filter((e) => e.type === 'system.dlq.enqueued');
    expect(dlqEvents).toHaveLength(1);
    expect(dlqEvents[0]!.payload.taskId).toBe('task-2');
  });
});
