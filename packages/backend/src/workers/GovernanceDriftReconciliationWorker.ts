import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';

import { createLogger } from '../lib/logger.js';
import { createCounter } from '../lib/observability/index.js';
import { evaluateGovernanceDrift } from '../lib/governance/driftPrimitives.js';
import { createCronSupabaseClient } from '../lib/supabase/privileged/index.js';
import type { DriftAssessment, GovernanceContext } from '../lib/rules.js';

const logger = createLogger({ component: 'GovernanceDriftReconciliationWorker' });
export const GOVERNANCE_DRIFT_RECONCILIATION_QUEUE = 'governance-drift-reconciliation';
const INTERVAL_MINUTES = Number(process.env.GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES ?? 15);
const MAX_SCAN_BATCH_SIZE = Number(process.env.GOVERNANCE_DRIFT_RECONCILIATION_MAX_BATCH_SIZE ?? 100);
const DEFAULT_SCAN_BATCH_SIZE = Number(process.env.GOVERNANCE_DRIFT_RECONCILIATION_BATCH_SIZE ?? 25);
const SCAN_JOB_TIMEOUT_MS = Number(process.env.GOVERNANCE_DRIFT_RECONCILIATION_TIMEOUT_MS ?? 30_000);

const driftDetected = createCounter('governance_drift_reconciliation_detected_total', 'Detected drift events during reconciliation', ['drift_type', 'severity']);
const driftRemediated = createCounter('governance_drift_reconciliation_remediated_total', 'Auto-remediated drift events during reconciliation', ['drift_type', 'severity']);
const driftUnresolved = createCounter('governance_drift_reconciliation_unresolved_total', 'Unresolved drift events during reconciliation', ['drift_type', 'severity']);
const driftSampledByAction = createCounter('governance_drift_reconciliation_sampled_total', 'Sampled governance contexts during reconciliation', ['tenant_id', 'action_name']);
const driftSampleFailures = createCounter('governance_drift_reconciliation_sample_failures_total', 'Per-sample failures during reconciliation', ['tenant_id', 'action_name', 'failure_reason']);

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
  mode: 'explicit-context' | 'scan';
  context?: GovernanceContext;
  grantedPermissions?: string[];
  remediationMode: 'auto-safe' | 'approval-gated';
  cursor?: {
    tenantOffset?: number;
    workflowOffset?: number;
  };
  batchSize?: number;
}

let _redis: Redis | null = null;
const getRedis = () => (_redis ??= new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null }));
let _queue: Queue<GovernanceDriftReconciliationJobPayload> | null = null;
export const getGovernanceDriftReconciliationQueue = () => (_queue ??= new Queue(GOVERNANCE_DRIFT_RECONCILIATION_QUEUE, { connection: getRedis() }));

export async function scheduleGovernanceDriftReconciliationJob(): Promise<void> {
  await getGovernanceDriftReconciliationQueue().add('reconcile-governance-drift', {
    mode: 'scan',
    remediationMode: 'approval-gated',
    batchSize: DEFAULT_SCAN_BATCH_SIZE,
    cursor: { tenantOffset: 0, workflowOffset: 0 },
  }, {
    repeat: { every: INTERVAL_MINUTES * 60 * 1000 },
    jobId: 'governance-drift-reconciliation-repeatable',
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    timeout: SCAN_JOB_TIMEOUT_MS,
  });
}

interface GovernanceScanCandidate { tenantId: string; workflowId: string; actionName: string; userId: string; roles: string[]; permissions: string[]; }
async function loadGovernanceScanCandidates(batchSize: number, tenantOffset: number, workflowOffset: number): Promise<GovernanceScanCandidate[]> {
  const supabase = createCronSupabaseClient({ justification: 'service-role:justified governance reconciliation sampling' });
  const boundedBatchSize = Math.max(1, Math.min(batchSize, MAX_SCAN_BATCH_SIZE));
  const { data: tenants, error: tenantError } = await supabase.from('tenants').select('id').eq('status', 'active').range(tenantOffset, tenantOffset + boundedBatchSize - 1);
  if (tenantError) throw tenantError;
  if (!tenants?.length) return [];
  const tenantIds = tenants.map((t) => (t as { id: string }).id);
  const { data: workflows, error: workflowError } = await supabase.from('workflows').select('organization_id,id,current_step').in('organization_id', tenantIds).range(workflowOffset, workflowOffset + boundedBatchSize - 1);
  if (workflowError) throw workflowError;
  const { data: memberships, error: membershipsError } = await supabase.from('user_tenants').select('tenant_id,user_id,status').in('tenant_id', tenantIds).eq('status', 'active');
  if (membershipsError) throw membershipsError;
  const membershipByTenant = new Map<string, { user_id: string }[]>();
  for (const m of memberships ?? []) {
    const row = m as { tenant_id: string; user_id: string };
    membershipByTenant.set(row.tenant_id, [...(membershipByTenant.get(row.tenant_id) ?? []), { user_id: row.user_id }]);
  }

  return (workflows ?? []).map((wf) => {
    const workflow = wf as { organization_id: string; id: string; current_step?: string };
    const member = membershipByTenant.get(workflow.organization_id)?.[0];
    return {
      tenantId: workflow.organization_id,
      workflowId: workflow.id,
      actionName: workflow.current_step ?? 'workflow.step.evaluate',
      userId: member?.user_id ?? 'system',
      roles: member ? ['member'] : ['system'],
      permissions: [workflow.current_step ?? 'workflow.step.evaluate'],
    };
  });
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
  const records: ReconciliationDriftRecord[] = [];
  const { remediationMode } = job.data;
  const candidates = job.data.mode === 'scan'
    ? await loadGovernanceScanCandidates(job.data.batchSize ?? DEFAULT_SCAN_BATCH_SIZE, job.data.cursor?.tenantOffset ?? 0, job.data.cursor?.workflowOffset ?? 0)
    : [{
      tenantId: job.data.context?.actor.tenantId ?? 'unknown',
      workflowId: job.data.context?.workflow?.workflowId ?? 'unknown',
      actionName: job.data.context?.action.name ?? 'unknown',
      userId: job.data.context?.actor.userId ?? 'unknown',
      roles: job.data.context?.actor.roles ?? [],
      permissions: job.data.grantedPermissions ?? [],
    }];

  for (const candidate of candidates) {
    const context: GovernanceContext = job.data.mode === 'explicit-context' && job.data.context
      ? job.data.context
      : {
        actor: { userId: candidate.userId, tenantId: candidate.tenantId, roles: candidate.roles },
        action: { type: candidate.actionName, name: candidate.actionName },
        environment: { stage: 'prod', nowIso: new Date().toISOString() },
        workflow: { workflowId: candidate.workflowId },
      };
    driftSampledByAction.inc({ tenant_id: candidate.tenantId, action_name: candidate.actionName });
    try {
      const drift = evaluateGovernanceDrift(context, candidate.permissions).filter((d) => d.driftDetected);
      for (const d of drift) {
        driftDetected.inc({ drift_type: d.driftType ?? 'UNKNOWN', severity: d.severity ?? 'unknown' });
        const safe = d.remediationAction === 'REFRESH_PERMISSIONS' || d.remediationAction === 'READ_ONLY';
        const remediated = remediationMode === 'auto-safe' && safe;
        const escalatedForApproval = !remediated;
        if (remediated) driftRemediated.inc({ drift_type: d.driftType ?? 'UNKNOWN', severity: d.severity ?? 'unknown' });
        else driftUnresolved.inc({ drift_type: d.driftType ?? 'UNKNOWN', severity: d.severity ?? 'unknown' });
        const rec = toRecord(context, d, remediated, escalatedForApproval);
        records.push(rec);
        logger.warn('governance.drift.reconciliation', { jobId: job.id, tenantId: candidate.tenantId, actionName: candidate.actionName, ...rec });
      }
    } catch (error) {
      driftSampleFailures.inc({ tenant_id: candidate.tenantId, action_name: candidate.actionName, failure_reason: 'evaluation_error' });
      logger.error('governance.drift.reconciliation.sample_failed', error instanceof Error ? error : undefined, { jobId: job.id, tenantId: candidate.tenantId, actionName: candidate.actionName });
    }
  }

  return records;
}

export function initGovernanceDriftReconciliationWorker(): Worker<GovernanceDriftReconciliationJobPayload> {
  // WORKER_CLASSIFICATION: tenant-context-restored
  return new Worker(GOVERNANCE_DRIFT_RECONCILIATION_QUEUE, async (job) => runGovernanceDriftReconciliationJob(job), { connection: getRedis(), concurrency: 3 });
}
