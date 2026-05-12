import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';

import { createLogger } from '../lib/logger.js';
import { createCounter } from '../lib/observability/index.js';
import { evaluateGovernanceDrift } from '../lib/governance/driftPrimitives.js';
import type { DriftAssessment, GovernanceContext } from '../lib/rules.js';

const logger = createLogger({ component: 'GovernanceDriftReconciliationWorker' });
export const GOVERNANCE_DRIFT_RECONCILIATION_QUEUE = 'governance-drift-reconciliation';
const INTERVAL_MINUTES = Number(process.env.GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES ?? 15);

const driftDetected = createCounter('governance_drift_reconciliation_detected_total', 'Detected drift events during reconciliation', ['drift_type', 'severity']);
const driftRemediated = createCounter('governance_drift_reconciliation_remediated_total', 'Auto-remediated drift events during reconciliation', ['drift_type', 'severity']);
const driftUnresolved = createCounter('governance_drift_reconciliation_unresolved_total', 'Unresolved drift events during reconciliation', ['drift_type', 'severity']);

export interface ReconciliationDriftRecord {
  severity: 'low' | 'medium' | 'high';
  driftType: NonNullable<DriftAssessment['driftType']>;
  tenantId?: string;
  workflowId?: string;
  remediationRecommendation: string;
  remediated: boolean;
  escalatedForApproval: boolean;
}

export interface GovernanceDriftReconciliationJobPayload {
  context: GovernanceContext;
  grantedPermissions: string[];
  remediationMode: 'auto-safe' | 'approval-gated';
}

let _redis: Redis | null = null;
const getRedis = () => (_redis ??= new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null }));
let _queue: Queue<GovernanceDriftReconciliationJobPayload> | null = null;
export const getGovernanceDriftReconciliationQueue = () => (_queue ??= new Queue(GOVERNANCE_DRIFT_RECONCILIATION_QUEUE, { connection: getRedis() }));

export async function scheduleGovernanceDriftReconciliationJob(): Promise<void> {
  await getGovernanceDriftReconciliationQueue().add('reconcile-governance-drift', {
    context: {
      actor: { userId: 'system', tenantId: 'system', roles: [] },
      action: { type: 'governance.reconcile', name: 'governance.reconcile' },
      environment: { stage: 'prod', nowIso: new Date().toISOString() },
    },
    grantedPermissions: [],
    remediationMode: 'approval-gated',
  }, { repeat: { every: INTERVAL_MINUTES * 60 * 1000 }, jobId: 'governance-drift-reconciliation-repeatable' });
}

function toRecord(ctx: GovernanceContext, d: DriftAssessment, remediated: boolean, escalatedForApproval: boolean): ReconciliationDriftRecord {
  return {
    severity: d.severity ?? 'medium',
    driftType: d.driftType ?? 'CRITICAL_CONFIG_INVARIANT',
    tenantId: ctx.actor.tenantId,
    workflowId: ctx.workflow?.workflowId,
    remediationRecommendation: d.remediationAction === 'REFRESH_PERMISSIONS' ? 'Refresh cache/state permissions and retry validation.' : d.remediationAction === 'REQUIRE_APPROVAL' ? 'Escalate to approval workflow and block risky mutation.' : 'Constrain operation to read-only mode and investigate.',
    remediated,
    escalatedForApproval,
  };
}

export async function runGovernanceDriftReconciliationJob(job: Pick<Job<GovernanceDriftReconciliationJobPayload>, 'id' | 'data'>): Promise<ReconciliationDriftRecord[]> {
  const { context, grantedPermissions, remediationMode } = job.data;
  const drift = evaluateGovernanceDrift(context, grantedPermissions).filter((d) => d.driftDetected);
  if (drift.length === 0) return [];

  const records: ReconciliationDriftRecord[] = [];
  for (const d of drift) {
    driftDetected.inc({ drift_type: d.driftType ?? 'UNKNOWN', severity: d.severity ?? 'unknown' });
    const safe = d.remediationAction === 'REFRESH_PERMISSIONS' || d.remediationAction === 'READ_ONLY';
    const remediated = remediationMode === 'auto-safe' && safe;
    const escalatedForApproval = !remediated;
    if (remediated) driftRemediated.inc({ drift_type: d.driftType ?? 'UNKNOWN', severity: d.severity ?? 'unknown' });
    else driftUnresolved.inc({ drift_type: d.driftType ?? 'UNKNOWN', severity: d.severity ?? 'unknown' });

    const rec = toRecord(context, d, remediated, escalatedForApproval);
    records.push(rec);
    logger.warn('governance.drift.reconciliation', { jobId: job.id, ...rec });
  }

  return records;
}

export function initGovernanceDriftReconciliationWorker(): Worker<GovernanceDriftReconciliationJobPayload> {
  return new Worker(GOVERNANCE_DRIFT_RECONCILIATION_QUEUE, async (job) => runGovernanceDriftReconciliationJob(job), { connection: getRedis() });
}
