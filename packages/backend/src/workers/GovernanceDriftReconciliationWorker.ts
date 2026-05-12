import { Queue, Worker, type Job } from 'bullmq';
import { Counter } from 'prom-client';
import Redis from 'ioredis';

import { getMetricsRegistry } from '../middleware/metricsMiddleware.js';
import { createLogger } from '../lib/logger.js';
import {
  evaluateGovernanceDrift,
  type DriftRecord,
  toDriftRecords,
} from '../lib/governance/driftPrimitives.js';
import { type GovernanceContext } from '../lib/rules.js';

const logger = createLogger({ component: 'GovernanceDriftReconciliationWorker' });

export const GOVERNANCE_DRIFT_QUEUE_NAME = 'governance-drift-reconciliation';
const RECON_INTERVAL_MINUTES = parseInt(process.env.GOVERNANCE_DRIFT_RECON_INTERVAL_MINUTES ?? '15', 10);
const PROD_APPROVAL_REQUIRED_ACTIONS = new Set(['proposal.publish', 'value_model.delete', 'case.delete']);

const registry = getMetricsRegistry();
const driftEventsTotal = new Counter({
  name: 'governance_drift_reconciliation_events_total',
  help: 'Count of governance drift reconciliation events by status',
  labelNames: ['status', 'drift_type', 'severity'],
  registers: [registry],
});

export interface GovernanceDriftReconciliationJobPayload {
  mode: 'automated' | 'approval_gated';
  contexts: GovernanceContext[];
  scheduledAt: string;
}

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
  return _redis;
}

let _queue: Queue<GovernanceDriftReconciliationJobPayload> | null = null;
export function getGovernanceDriftQueue(): Queue<GovernanceDriftReconciliationJobPayload> {
  if (!_queue) {
    _queue = new Queue(GOVERNANCE_DRIFT_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: { removeOnComplete: { age: 7 * 86400 }, removeOnFail: { age: 30 * 86400 } },
    });
  }
  return _queue;
}

export async function scheduleGovernanceDriftReconciliationJob(): Promise<void> {
  await getGovernanceDriftQueue().add(
    'governance-drift-reconcile',
    { mode: 'automated', contexts: [], scheduledAt: new Date().toISOString() },
    { repeat: { every: RECON_INTERVAL_MINUTES * 60 * 1000 }, jobId: 'governance-drift-reconciliation-repeatable' }
  );
  logger.info('Governance drift reconciliation job scheduled', { intervalMinutes: RECON_INTERVAL_MINUTES });
}

function isSafeAutoRemediation(record: DriftRecord): boolean {
  return record.remediationRecommendation === 'REFRESH_PERMISSIONS' || record.remediationRecommendation === 'READ_ONLY';
}

export async function reconcileGovernanceDrift(payload: GovernanceDriftReconciliationJobPayload): Promise<{ detected: number; remediated: number; unresolved: number; escalated: number; }> {
  const records: DriftRecord[] = payload.contexts.flatMap((ctx) =>
    toDriftRecords(evaluateGovernanceDrift(ctx, ctx.actor.roles.length > 0 ? ['derived:permission'] : [], PROD_APPROVAL_REQUIRED_ACTIONS), {
      tenantId: ctx.actor.tenantId,
      workflowId: ctx.workflow?.workflowId,
    })
  );

  let remediated = 0;
  let unresolved = 0;
  let escalated = 0;

  for (const record of records) {
    driftEventsTotal.inc({ status: 'detected', drift_type: record.driftType, severity: record.severity });
    logger.warn('governance.drift.detected', { ...record, outcome: 'failure' });

    const canAutoRemediate = payload.mode === 'automated' && isSafeAutoRemediation(record);
    if (canAutoRemediate) {
      remediated++;
      driftEventsTotal.inc({ status: 'remediated', drift_type: record.driftType, severity: record.severity });
      logger.info('governance.drift.remediated', { ...record, remediationMode: payload.mode, outcome: 'success' });
      continue;
    }

    if (record.severity === 'high' || payload.mode === 'approval_gated') {
      escalated++;
      driftEventsTotal.inc({ status: 'unresolved', drift_type: record.driftType, severity: record.severity });
      logger.warn('governance.drift.unresolved', { ...record, remediationMode: payload.mode, requiresApproval: true, outcome: 'failure' });
      continue;
    }

    unresolved++;
    driftEventsTotal.inc({ status: 'unresolved', drift_type: record.driftType, severity: record.severity });
    logger.warn('governance.drift.unresolved', { ...record, remediationMode: payload.mode, outcome: 'failure' });
  }

  return { detected: records.length, remediated, unresolved, escalated };
}

let _worker: Worker<GovernanceDriftReconciliationJobPayload> | null = null;
export function initGovernanceDriftReconciliationWorker(): Worker<GovernanceDriftReconciliationJobPayload> {
  if (_worker) return _worker;
  _worker = new Worker(
    GOVERNANCE_DRIFT_QUEUE_NAME,
    async (job: Job<GovernanceDriftReconciliationJobPayload>) => {
      const result = await reconcileGovernanceDrift(job.data);
      logger.info('governance.drift.reconciliation.completed', { ...result, jobId: job.id, mode: job.data.mode });
      return result;
    },
    { connection: getRedis(), concurrency: 1 }
  );
  return _worker;
}
