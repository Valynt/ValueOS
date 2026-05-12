import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';

import { createLogger } from '../lib/logger.js';
import { createCounter } from '../lib/observability/index.js';
import { createWorkerServiceSupabaseClient } from '../lib/supabase/privileged/index.js';
import { evaluateGovernanceDrift } from '../lib/governance/driftPrimitives.js';
import type { DriftAssessment, GovernanceContext } from '../lib/rules.js';

const logger = createLogger({ component: 'GovernanceDriftReconciliationWorker' });
export const GOVERNANCE_DRIFT_RECONCILIATION_QUEUE = 'governance-drift-reconciliation';
const INTERVAL_MINUTES = Number(process.env.GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES ?? 15);
const DEFAULT_BATCH_SIZE = Number(process.env.GOVERNANCE_DRIFT_RECONCILIATION_BATCH_SIZE ?? 250);
const MAX_RETRIES = Number(process.env.GOVERNANCE_DRIFT_RECONCILIATION_MAX_RETRIES ?? 5);

const GOVERNANCE_DRIFT_RECONCILIATION_DLQ = 'governance-drift-reconciliation-dlq';

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
  kind: 'produce';
}

export interface GovernanceDriftReconciliationEvalJobPayload {
  kind: 'evaluate';
  context: GovernanceContext;
  grantedPermissions: string[];
  remediationMode: 'auto-safe' | 'approval-gated';
  idempotencyKey: string;
}

export type GovernanceDriftQueuePayload = GovernanceDriftReconciliationJobPayload | GovernanceDriftReconciliationEvalJobPayload;

let _redis: Redis | null = null;
const getRedis = () => (_redis ??= new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null }));
let _queue: Queue<GovernanceDriftQueuePayload> | null = null;
export const getGovernanceDriftReconciliationQueue = () => (_queue ??= new Queue(GOVERNANCE_DRIFT_RECONCILIATION_QUEUE, {
  connection: getRedis(),
  defaultJobOptions: {
    attempts: MAX_RETRIES,
    backoff: { type: 'exponential', delay: 1_500, jitter: 0.35 },
    removeOnComplete: { age: 7 * 86_400 },
    removeOnFail: { age: 30 * 86_400 },
  },
}));

export async function scheduleGovernanceDriftReconciliationJob(): Promise<void> {
  await getGovernanceDriftReconciliationQueue().add('reconcile-governance-drift', {
    kind: 'produce',
  }, { repeat: { every: INTERVAL_MINUTES * 60 * 1000 }, jobId: 'governance-drift-reconciliation-repeatable' });
}

async function resolveGrantedPermissions(userId: string, tenantId: string): Promise<string[]> {
  const supabase = createWorkerServiceSupabaseClient({ justification: 'service-role:justified governance reconciliation requires tenant-scoped permission resolution' });
  const [{ data: roles }, { data: permissions }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId).eq('tenant_id', tenantId),
    supabase.from('user_permissions').select('permission').eq('user_id', userId).eq('tenant_id', tenantId),
  ]);
  const { USER_ROLE_PERMISSIONS } = await import('@shared/lib/permissions');
  const granted = new Set<string>();
  for (const row of roles ?? []) {
    const rolePerms = USER_ROLE_PERMISSIONS[row.role as keyof typeof USER_ROLE_PERMISSIONS] ?? [];
    for (const p of rolePerms as string[]) granted.add(p);
  }
  for (const row of permissions ?? []) {
    if (row.permission) granted.add(row.permission as string);
  }
  return [...granted];
}

export async function produceGovernanceDriftReconciliationJobs(batchSize = DEFAULT_BATCH_SIZE): Promise<number> {
  const supabase = createWorkerServiceSupabaseClient({ justification: 'service-role:justified governance reconciliation producer discovers tenant workflow contexts' });
  const nowIso = new Date().toISOString();

  const { data: activeMemberships, error: membershipsError } = await supabase
    .from('user_tenants')
    .select('tenant_id,user_id')
    .eq('status', 'active')
    .limit(batchSize);
  if (membershipsError) throw new Error(`governance reconciliation membership discovery failed: ${membershipsError.message}`);

  const queue = getGovernanceDriftReconciliationQueue();
  let enqueued = 0;
  for (const membership of activeMemberships ?? []) {
    const tenantId = membership.tenant_id as string;
    const userId = membership.user_id as string;
    const grantedPermissions = await resolveGrantedPermissions(userId, tenantId);

    const { data: workflowRows } = await supabase
      .from('workflow_executions')
      .select('workflow_id,current_stage')
      .eq('tenant_id', tenantId)
      .limit(5);

    const contexts = (workflowRows ?? []).map((row) => ({
      actionName: 'proposal.publish',
      workflowId: row.workflow_id as string | undefined,
      workflowStep: row.current_stage as string | undefined,
    }));
    if (contexts.length === 0) contexts.push({ actionName: 'governance.reconcile', workflowId: undefined, workflowStep: undefined });

    for (const c of contexts) {
      const idempotencyKey = `gov-drift:${tenantId}:${userId}:${c.actionName}:${c.workflowId ?? 'none'}`;
      await queue.add('evaluate-governance-drift', {
        kind: 'evaluate',
        idempotencyKey,
        remediationMode: 'approval-gated',
        grantedPermissions,
        context: {
          actor: { userId, tenantId, roles: [] },
          action: { type: c.actionName, name: c.actionName },
          environment: { stage: 'prod', nowIso },
          workflow: { workflowId: c.workflowId, step: c.workflowStep, approvals: [] },
        },
      }, { jobId: idempotencyKey });
      enqueued++;
    }
  }
  return enqueued;
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

export async function runGovernanceDriftReconciliationJob(job: Pick<Job<GovernanceDriftQueuePayload>, 'id' | 'data' | 'attemptsMade'>): Promise<ReconciliationDriftRecord[]> {
  if (job.data.kind === 'produce') {
    await produceGovernanceDriftReconciliationJobs();
    return [];
  }

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

export function initGovernanceDriftReconciliationWorker(): Worker<GovernanceDriftQueuePayload> {
  const dlq = new Queue<GovernanceDriftQueuePayload>(GOVERNANCE_DRIFT_RECONCILIATION_DLQ, { connection: getRedis() });
  return new Worker(GOVERNANCE_DRIFT_RECONCILIATION_QUEUE, async (job) => {
    try {
      return await runGovernanceDriftReconciliationJob(job);
    } catch (error) {
      if (job.attemptsMade + 1 >= MAX_RETRIES) {
        await dlq.add('dead-letter', job.data, { jobId: `dlq:${String(job.id)}` });
        logger.error('governance.drift.reconciliation.dead_lettered', error as Error, { jobId: job.id });
      }
      throw error;
    }
  }, { connection: getRedis() });
}
