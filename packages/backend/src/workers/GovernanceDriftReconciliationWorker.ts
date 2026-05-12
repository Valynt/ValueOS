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
const MAX_BATCH_SIZE = Number(process.env.GOVERNANCE_DRIFT_RECONCILIATION_MAX_BATCH_SIZE ?? 500);
const MAX_RETRIES = Number(process.env.GOVERNANCE_DRIFT_RECONCILIATION_MAX_RETRIES ?? 5);
const JOB_TIMEOUT_MS = Number(process.env.GOVERNANCE_DRIFT_RECONCILIATION_JOB_TIMEOUT_MS ?? 30_000);
const REMEDIATION_MODE_ENV_KEY = 'GOVERNANCE_DRIFT_RECONCILIATION_MODE';

const ALLOWED_REMEDIATION_MODES = ['auto-safe', 'approval-gated'] as const;
type GovernanceDriftRemediationMode = (typeof ALLOWED_REMEDIATION_MODES)[number];

function getGovernanceDriftRemediationModeFromEnv(env: NodeJS.ProcessEnv = process.env): GovernanceDriftRemediationMode {
  const configuredMode = env[REMEDIATION_MODE_ENV_KEY] ?? 'approval-gated';
  if ((ALLOWED_REMEDIATION_MODES as readonly string[]).includes(configuredMode)) return configuredMode as GovernanceDriftRemediationMode;
  throw new Error(`${REMEDIATION_MODE_ENV_KEY} must be one of ${ALLOWED_REMEDIATION_MODES.join('|')}; received ${configuredMode}`);
}

const GOVERNANCE_DRIFT_RECONCILIATION_DLQ = 'governance-drift-reconciliation-dlq';

const driftDetected = createCounter('governance_drift_reconciliation_detected_total', 'Detected drift events during reconciliation', ['drift_type', 'severity']);
const driftRemediated = createCounter('governance_drift_reconciliation_remediated_total', 'Auto-remediated drift events during reconciliation', ['drift_type', 'severity']);
const driftUnresolved = createCounter('governance_drift_reconciliation_unresolved_total', 'Unresolved drift events during reconciliation', ['drift_type', 'severity']);
const tenantActionEvaluated = createCounter('governance_drift_reconciliation_evaluated_total', 'Evaluated governance contexts by tenant/action', ['tenant_id', 'action_name']);
const tenantActionFailures = createCounter('governance_drift_reconciliation_failed_total', 'Failed governance context evaluation by tenant/action', ['tenant_id', 'action_name']);

export interface ReconciliationDriftRecord {
  severity: 'low' | 'medium' | 'high';
  driftType: NonNullable<DriftAssessment['driftType']>;
  tenantId?: string;
  workflowId?: string;
  actionName?: string;
  remediationRecommendation: string;
  remediated: boolean;
  escalatedForApproval: boolean;
}

export interface GovernanceDriftReconciliationJobPayload { kind: 'produce'; scan?: GovernanceDriftScanSpec; }
export interface GovernanceDriftScanSpec { cursor?: string; batchSize?: number; }
export interface GovernanceDriftReconciliationEvalJobPayload {
  kind: 'evaluate'; context: GovernanceContext; grantedPermissions: string[]; remediationMode: GovernanceDriftRemediationMode; idempotencyKey: string;
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
    timeout: JOB_TIMEOUT_MS,
    removeOnComplete: { age: 7 * 86_400 },
    removeOnFail: { age: 30 * 86_400 },
  },
}));

export async function scheduleGovernanceDriftReconciliationJob(): Promise<void> {
  await getGovernanceDriftReconciliationQueue().add('reconcile-governance-drift', { kind: 'produce', scan: { batchSize: DEFAULT_BATCH_SIZE } }, { repeat: { every: INTERVAL_MINUTES * 60 * 1000 }, jobId: 'governance-drift-reconciliation-repeatable' });
}

interface ResolvedActorAccess { roles: string[]; grantedPermissions: string[]; }

async function resolveActorAccess(userId: string, tenantId: string): Promise<ResolvedActorAccess> {
  const supabase = createWorkerServiceSupabaseClient({ justification: 'service-role:justified governance reconciliation requires tenant-scoped permission resolution' });
  const [{ data: roles, error: userRolesError }, { data: permissions, error: userPermissionsError }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId).eq('tenant_id', tenantId),
    supabase.from('user_permissions').select('permission').eq('user_id', userId).eq('tenant_id', tenantId),
  ]);
  if (userRolesError || userPermissionsError) throw new Error(`governance permission resolution failed tenant=${tenantId} user=${userId} details=${[userRolesError ? `user_roles=${userRolesError.message}` : null, userPermissionsError ? `user_permissions=${userPermissionsError.message}` : null].filter(Boolean).join(';')}`);
  const { USER_ROLE_PERMISSIONS } = await import('@shared/lib/permissions');
  const granted = new Set<string>();
  for (const row of roles ?? []) for (const p of (USER_ROLE_PERMISSIONS[row.role as keyof typeof USER_ROLE_PERMISSIONS] ?? []) as string[]) granted.add(p);
  for (const row of permissions ?? []) if (row.permission) granted.add(row.permission as string);
  return { roles: [...new Set((roles ?? []).map((row) => String(row.role)).filter(Boolean))], grantedPermissions: [...granted] };
}

function clampBatchSize(batchSize?: number): number { return Math.max(1, Math.min(batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE)); }

export async function produceGovernanceDriftReconciliationJobs(scan: GovernanceDriftScanSpec = {}): Promise<number> {
  const remediationMode = getGovernanceDriftRemediationModeFromEnv();
  const supabase = createWorkerServiceSupabaseClient({ justification: 'service-role:justified governance reconciliation producer discovers tenant workflow contexts' });
  const nowIso = new Date().toISOString();
  const boundedBatchSize = clampBatchSize(scan.batchSize);
  const cursor = scan.cursor ?? '';

  const { data: activeMemberships, error: membershipsError } = await supabase
    .from('user_tenants').select('tenant_id,user_id').eq('status', 'active').gt('tenant_id', cursor).order('tenant_id', { ascending: true }).limit(boundedBatchSize);
  if (membershipsError) throw new Error(`governance reconciliation membership discovery failed: ${membershipsError.message}`);

  const queue = getGovernanceDriftReconciliationQueue();
  let enqueued = 0;
  for (const membership of activeMemberships ?? []) {
    const tenantId = membership.tenant_id as string;
    const userId = membership.user_id as string;
    try {
      const { roles, grantedPermissions } = await resolveActorAccess(userId, tenantId);
      const { data: workflowRows } = await supabase.from('workflow_executions').select('workflow_id,current_stage,action_name').eq('tenant_id', tenantId).eq('status', 'active').limit(5);
      const contexts = (workflowRows ?? []).map((row) => ({ actionName: (row.action_name as string | null) ?? 'proposal.publish', workflowId: row.workflow_id as string | undefined, workflowStep: row.current_stage as string | undefined }));
      if (contexts.length === 0) contexts.push({ actionName: 'governance.reconcile', workflowId: undefined, workflowStep: undefined });
      for (const c of contexts) {
        const idempotencyKey = `gov-drift:${tenantId}:${userId}:${c.actionName}:${c.workflowId ?? 'none'}`;
        await queue.add('evaluate-governance-drift', { kind: 'evaluate', idempotencyKey, remediationMode, grantedPermissions, context: { actor: { userId, tenantId, roles }, action: { type: c.actionName, name: c.actionName }, environment: { stage: 'prod', nowIso }, workflow: { workflowId: c.workflowId, step: c.workflowStep, approvals: [] } } }, { jobId: idempotencyKey });
        enqueued++;
      }
    } catch (error) {
      logger.error('governance.drift.reconciliation.sample_failed', error as Error, { tenantId, userId });
      tenantActionFailures.inc({ tenant_id: tenantId, action_name: 'discovery' });
    }
  }
  return enqueued;
}

function toRecord(ctx: GovernanceContext, d: DriftAssessment, remediated: boolean, escalatedForApproval: boolean): ReconciliationDriftRecord {
  return { severity: d.severity ?? 'medium', driftType: d.driftType ?? 'CRITICAL_CONFIG_INVARIANT', tenantId: ctx.actor.tenantId, workflowId: ctx.workflow?.workflowId, actionName: ctx.action.name, remediationRecommendation: d.remediationAction === 'REFRESH_PERMISSIONS' ? 'Refresh cache/state permissions and retry validation.' : d.remediationAction === 'REQUIRE_APPROVAL' ? 'Escalate to approval workflow and block risky mutation.' : 'Constrain operation to read-only mode and investigate.', remediated, escalatedForApproval };
}

export async function runGovernanceDriftReconciliationJob(job: Pick<Job<GovernanceDriftQueuePayload>, 'id' | 'data' | 'attemptsMade'>): Promise<ReconciliationDriftRecord[]> {
  if (job.data.kind === 'produce') { await produceGovernanceDriftReconciliationJobs(job.data.scan); return []; }
  const { context, grantedPermissions, remediationMode } = job.data;
  tenantActionEvaluated.inc({ tenant_id: context.actor.tenantId, action_name: context.action.name });
  const drift = evaluateGovernanceDrift(context, grantedPermissions).filter((d) => d.driftDetected);
  if (drift.length === 0) return [];
  const records: ReconciliationDriftRecord[] = [];
  for (const d of drift) {
    driftDetected.inc({ drift_type: d.driftType ?? 'UNKNOWN', severity: d.severity ?? 'unknown' });
    const remediated = remediationMode === 'auto-safe' && (d.remediationAction === 'REFRESH_PERMISSIONS' || d.remediationAction === 'READ_ONLY');
    const escalatedForApproval = !remediated;
    if (remediated) driftRemediated.inc({ drift_type: d.driftType ?? 'UNKNOWN', severity: d.severity ?? 'unknown' }); else driftUnresolved.inc({ drift_type: d.driftType ?? 'UNKNOWN', severity: d.severity ?? 'unknown' });
    const rec = toRecord(context, d, remediated, escalatedForApproval);
    records.push(rec);
    logger.warn('governance.drift.reconciliation', { jobId: job.id, ...rec });
  }
  return records;
}

export function initGovernanceDriftReconciliationWorker(): Worker<GovernanceDriftQueuePayload> {
  const dlq = new Queue<GovernanceDriftQueuePayload>(GOVERNANCE_DRIFT_RECONCILIATION_DLQ, { connection: getRedis() });
  return new Worker(GOVERNANCE_DRIFT_RECONCILIATION_QUEUE, async (job) => {
    try { return await runGovernanceDriftReconciliationJob(job); } catch (error) {
      if (job.attemptsMade + 1 >= MAX_RETRIES) {
        await dlq.add('dead-letter', job.data, { jobId: `dlq:${String(job.id)}` });
        logger.error('governance.drift.reconciliation.dead_lettered', error as Error, { jobId: job.id });
      }
      throw error;
    }
  }, { connection: getRedis(), concurrency: Number(process.env.GOVERNANCE_DRIFT_RECONCILIATION_CONCURRENCY ?? 4) });
}
