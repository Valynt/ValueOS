/**
 * ArtifactGenerationWorker
 *
 * BullMQ worker that processes 'generate-artifact' jobs.
 *
 * For each job it:
 *   1. Marks the artifact_jobs row as 'running'
 *   2. Loads full case context from Supabase
 *   3. Invokes NarrativeAgent.execute() with the assembled context
 *   4. Persists the generated artifact to case_artifacts
 *   5. Marks the job 'completed' with the artifact id
 *
 * On any error the job is marked 'failed' with the error message so the
 * frontend can surface it. The error is then rethrown so BullMQ records the
 * failure and can retry according to the queue's retry policy.
 */

import { Queue, Worker, type Job } from 'bullmq';

import { NarrativeAgent } from '../lib/agent-fabric/agents/NarrativeAgent.js';
import { LLMGateway } from '../lib/agent-fabric/LLMGateway.js';
import { MemorySystem } from '../lib/agent-fabric/MemorySystem.js';
import { CircuitBreaker } from '../lib/resilience/CircuitBreaker.js';
import { logger } from '../lib/logger.js';
import { createServerSupabaseClient } from '../lib/supabase.js';
import { getAgentMessageQueueConfig } from '../config/ServiceConfigManager.js';
import { attachQueueMetrics } from '../observability/queueMetrics.js';
import { ArtifactJobRepository } from '../services/artifacts/ArtifactJobRepository.js';
import { runJobWithTenantContext } from './tenantContextBootstrap.js';
import { ArtifactRepository } from '../services/artifacts/ArtifactRepository.js';
import type { LifecycleContext } from '../types/agent.js';

// ---------------------------------------------------------------------------
// Job payload type — must match what ArtifactsRoute enqueues
// ---------------------------------------------------------------------------

export interface ArtifactGenerationJobPayload {
  jobId: string;
  tenantId: string;
  organizationId: string;
  caseId: string;
  artifactType: string;
  format: string;
  requestedBy: string;
  traceId: string;
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

const QUEUE_NAME = 'artifact-generation';

const jobRepo = new ArtifactJobRepository();
const artifactRepo = new ArtifactRepository();

/**
 * Load the case context needed by NarrativeAgent from Supabase.
 * Returns a LifecycleContext shaped for the narrative lifecycle stage.
 */
async function loadCaseContext(
  caseId: string,
  tenantId: string,
  organizationId: string,
  requestedBy: string,
  artifactType: string,
): Promise<LifecycleContext> {
  const supabase = createServerSupabaseClient();

  // Fetch the value case row.
  const { data: valueCase, error: caseError } = await supabase
    .from('value_cases')
    .select('id, name, company_name, description, lifecycle_stage, status, buyer_persona')
    .eq('id', caseId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (caseError) {
    throw new Error(`Failed to load value case: ${caseError.message}`);
  }
  if (!valueCase) {
    throw new Error(`Value case not found: ${caseId}`);
  }

  // Fetch the most recent integrity result.
  const { data: integrityRows } = await supabase
    .from('integrity_results')
    .select('claim_validations, scores, veto_decision, created_at')
    .eq('case_id', caseId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1);

  const integrityResult = integrityRows?.[0] ?? null;

  // Fetch the most recent financial model snapshot.
  const { data: financialRows } = await supabase
    .from('financial_model_snapshots')
    .select('summary, roi_percentage, payback_months, npv, created_at')
    .eq('case_id', caseId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1);

  const financialSnapshot = financialRows?.[0] ?? null;

  // Fetch KPI targets.
  const { data: kpiRows } = await supabase
    .from('kpi_targets')
    .select('metric_name, target_value, unit, timeframe')
    .eq('case_id', caseId)
    .eq('tenant_id', tenantId);

  const kpiTargets = kpiRows ?? [];

  // Assemble LifecycleContext for NarrativeAgent.
  const context: LifecycleContext = {
    workspace_id: caseId,
    organization_id: organizationId,
    user_id: requestedBy,
    lifecycle_stage: 'narrative',
    user_inputs: {
      value_case_id: caseId,
      value_case_title: valueCase.name ?? caseId,
      organization_name: valueCase.company_name ?? organizationId,
      format: artifactType,
      readiness_score: integrityResult?.scores?.overall ?? 0,
      readiness_blockers: [],
    },
    previous_stage_outputs: {
      integrity: integrityResult
        ? {
            claim_validations: integrityResult.claim_validations ?? [],
            scores: integrityResult.scores ?? { overall: 0 },
            veto_decision: integrityResult.veto_decision ?? { veto: false },
          }
        : undefined,
      modeling: financialSnapshot
        ? {
            summary: financialSnapshot.summary ?? 'No financial model available.',
            roi_percentage: financialSnapshot.roi_percentage,
            payback_months: financialSnapshot.payback_months,
            npv: financialSnapshot.npv,
          }
        : undefined,
      target: {
        kpi_targets: kpiTargets,
      },
    },
  };

  return context;
}

/**
 * Process a single artifact generation job.
 */
async function processJob(job: Job<ArtifactGenerationJobPayload>): Promise<void> {
  const { jobId, tenantId, organizationId, caseId, artifactType, format, requestedBy, traceId } =
    job.data;

  if (!tenantId) {
    throw new Error('ArtifactGenerationWorker: job payload missing tenantId');
  }

  logger.info('ArtifactGenerationWorker: starting job', {
    jobId,
    caseId,
    tenantId,
    artifactType,
    traceId,
  });

  // Mark running.
  await jobRepo.markRunning(jobId, tenantId);

  let context: LifecycleContext;
  try {
    context = await loadCaseContext(caseId, tenantId, organizationId, requestedBy, artifactType);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('ArtifactGenerationWorker: failed to load case context', {
      jobId,
      caseId,
      error: message,
    });
    await jobRepo.markFailed(jobId, tenantId, message);
    throw err;
  }

  // Instantiate NarrativeAgent.
  const llmGateway = new LLMGateway({ organizationId });
  const memorySystem = new MemorySystem({ organizationId });
  const circuitBreaker = new CircuitBreaker(`narrative-agent-${organizationId}`, {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60_000,
  });

  const agent = new NarrativeAgent(organizationId, memorySystem, llmGateway, circuitBreaker);

  let agentOutput: Awaited<ReturnType<typeof agent.execute>>;
  try {
    agentOutput = await agent.execute(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('ArtifactGenerationWorker: NarrativeAgent execution failed', {
      jobId,
      caseId,
      error: message,
    });
    await jobRepo.markFailed(jobId, tenantId, message);
    throw err;
  }

  if (agentOutput.status === 'failure') {
    const message =
      (agentOutput.data as Record<string, unknown>)?.error?.toString() ??
      'NarrativeAgent returned failure status';
    logger.error('ArtifactGenerationWorker: NarrativeAgent returned failure', {
      jobId,
      caseId,
      message,
    });
    await jobRepo.markFailed(jobId, tenantId, message);
    throw new Error(message);
  }

  // Persist the generated artifact.
  // ArtifactRepository.create expects the shape used by the existing generators.
  // We store the full agent output data as content.
  let artifactId: string;
  try {
    const artifact = await artifactRepo.create({
      tenantId,
      organizationId,
      caseId,
      artifactType,
      status: 'final',
      content: agentOutput.data,
      readinessScoreAtGeneration:
        (context.user_inputs?.readiness_score as number | undefined) ?? 0,
      generatedByAgent: 'narrative',
      metadata: {
        jobId,
        traceId,
        format,
        requestedBy,
        agentVersion: agentOutput.agent_version ?? 'unknown',
        promptVersion: agentOutput.prompt_version ?? 'unknown',
        generatedAt: new Date().toISOString(),
      },
    });
    artifactId = artifact.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('ArtifactGenerationWorker: failed to persist artifact', {
      jobId,
      caseId,
      error: message,
    });
    await jobRepo.markFailed(jobId, tenantId, message);
    throw err;
  }

  // Mark completed.
  await jobRepo.markCompleted(jobId, tenantId, artifactId);

  logger.info('ArtifactGenerationWorker: job completed', {
    jobId,
    caseId,
    artifactId,
    traceId,
  });
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

/**
 * Create and start the artifact generation worker.
 * Call once at server startup.
 */
export function createArtifactGenerationWorker(): Worker<ArtifactGenerationJobPayload> {
  const config = getAgentMessageQueueConfig();
  const redisUrl = config.redis.url ?? 'redis://localhost:6379';

  const worker = new Worker<ArtifactGenerationJobPayload>(
    QUEUE_NAME,
    async (job) => runJobWithTenantContext(
      {
        workerName: 'ArtifactGenerationWorker',
        tenantId: job.data.tenantId,
        organizationId: job.data.organizationId,
      },
      async () => {
        await processJob(job);
      },
    ),
    {
      connection: { url: redisUrl },
      concurrency: 3,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('ArtifactGenerationWorker: job failed', {
      jobId: job?.data?.jobId,
      caseId: job?.data?.caseId,
      error: err.message,
    });
  });

  worker.on('completed', (job) => {
    logger.info('ArtifactGenerationWorker: job completed', {
      jobId: job.data.jobId,
      caseId: job.data.caseId,
    });
  });

  attachQueueMetrics(worker, QUEUE_NAME, {
    workerClass: 'artifact-generation-worker',
    concurrency: 3,
  });

  logger.info('ArtifactGenerationWorker: started', { queue: QUEUE_NAME });

  return worker;
}

let _queue: Queue<ArtifactGenerationJobPayload> | null = null;

export function getArtifactGenerationQueue(): Queue<ArtifactGenerationJobPayload> {
  if (!_queue) {
    const config = getAgentMessageQueueConfig();
    const redisUrl = config.redis.url ?? 'redis://localhost:6379';
    _queue = new Queue<ArtifactGenerationJobPayload>(QUEUE_NAME, {
      connection: { url: redisUrl },
    });
  }

  return _queue;
}

export { QUEUE_NAME as ARTIFACT_GENERATION_QUEUE_NAME };
