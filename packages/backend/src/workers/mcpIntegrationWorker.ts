import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

import { createLogger } from '../lib/logger.js';
import { createCronSupabaseClient } from '../lib/supabase/privileged/index.js';
import { getMcpProvider } from '../services/mcp-integration/McpProviderRegistry.js';
import type {
  McpConnectionState,
  McpFailureReasonCode,
  McpIntegrationProvider,
} from '../services/mcp-integration/types.js';

const logger = createLogger({ component: 'McpIntegrationWorker' });

export const MCP_VALIDATION_QUEUE = 'mcp-integration-validation';
export const MCP_SYNC_QUEUE = 'mcp-integration-sync';

const defaultJobOptions = {
  attempts: 4,
  backoff: { type: 'exponential' as const, delay: 3_000 },
  removeOnComplete: { age: 86_400 },
  removeOnFail: { age: 7 * 86_400 },
};

let redis: Redis | null = null;
let validationQueue: Queue | null = null;
let syncQueue: Queue | null = null;
let validationWorker: Worker | null = null;
let syncWorker: Worker | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return redis;
}

export function getMcpValidationQueue(): Queue {
  if (!validationQueue) {
    validationQueue = new Queue(MCP_VALIDATION_QUEUE, {
      connection: getRedis(),
      defaultJobOptions,
    });
  }
  return validationQueue;
}

export function getMcpSyncQueue(): Queue {
  if (!syncQueue) {
    syncQueue = new Queue(MCP_SYNC_QUEUE, {
      connection: getRedis(),
      defaultJobOptions,
    });
  }
  return syncQueue;
}

interface McpQueuePayload {
  tenantId: string;
  provider: McpIntegrationProvider;
  integrationId: string;
}

async function updateIntegrationState(params: {
  tenantId: string;
  integrationId: string;
  provider: McpIntegrationProvider;
  state: McpConnectionState;
  reasonCode: McpFailureReasonCode | null;
  reasonMessage: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const supabase = createCronSupabaseClient({
    justification: 'service-role:justified mcp integration worker state transitions',
  });

  const { error } = await supabase
    .from('tenant_mcp_integrations')
    .update({
      tenant_id: params.tenantId,
      connection_state: params.state,
      reason_code: params.reasonCode,
      reason_message: params.reasonMessage,
      health_checked_at: now,
      validated_at: params.state === 'connected' ? now : null,
      updated_at: now,
    })
    .eq('id', params.integrationId)
    .eq('tenant_id', params.tenantId);

  if (error) {
    throw error;
  }

  if (params.reasonCode) {
    await supabase.from('tenant_mcp_integration_failures').insert({
      tenant_id: params.tenantId,
      integration_id: params.integrationId,
      provider: params.provider,
      reason_code: params.reasonCode,
      message: params.reasonMessage,
    });
  }
}

async function loadIntegrationMetadata(tenantId: string, integrationId: string): Promise<Record<string, unknown>> {
  const supabase = createCronSupabaseClient({
    justification: 'service-role:justified mcp integration worker metadata fetch',
  });

  const { data, error } = await supabase
    .from('tenant_mcp_integrations')
    .select('metadata')
    .eq('id', integrationId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    throw error ?? new Error('MCP integration metadata not found');
  }

  return (data.metadata as Record<string, unknown>) ?? {};
}

export function initMcpIntegrationWorkers(): { validationWorker: Worker; syncWorker: Worker } {
  if (validationWorker && syncWorker) {
    return { validationWorker, syncWorker };
  }

  validationWorker = new Worker(
    MCP_VALIDATION_QUEUE,
    async (job: Job<McpQueuePayload>) => {
      const { tenantId, provider, integrationId } = job.data;
      if (!tenantId || !provider || !integrationId) {
        throw new Error('mcp validation payload missing tenantId/provider/integrationId');
      }

      const providerClient = getMcpProvider(provider);
      const metadata = await loadIntegrationMetadata(tenantId, integrationId);
      const result = await providerClient.testAccess({ tenantId, providerConfig: metadata });

      await updateIntegrationState({
        tenantId,
        integrationId,
        provider,
        state: result.ok ? 'connected' : 'failed',
        reasonCode: result.reasonCode,
        reasonMessage: result.message,
      });

      logger.info('MCP validation job completed', {
        tenantId,
        provider,
        integrationId,
        ok: result.ok,
      });
    },
    { connection: getRedis(), concurrency: 5 }
  );

  syncWorker = new Worker(
    MCP_SYNC_QUEUE,
    async (job: Job<McpQueuePayload>) => {
      const { tenantId, provider, integrationId } = job.data;
      if (!tenantId || !provider || !integrationId) {
        throw new Error('mcp sync payload missing tenantId/provider/integrationId');
      }

      const providerClient = getMcpProvider(provider);
      const metadata = await loadIntegrationMetadata(tenantId, integrationId);
      const sync = await providerClient.sync({ tenantId, providerConfig: metadata });

      await updateIntegrationState({
        tenantId,
        integrationId,
        provider,
        state: sync.ok ? (sync.degraded ? 'degraded' : 'connected') : 'failed',
        reasonCode: sync.reasonCode,
        reasonMessage: sync.message,
      });

      logger.info('MCP sync job completed', {
        tenantId,
        provider,
        integrationId,
        syncedRecords: sync.syncedRecords,
        ok: sync.ok,
      });
    },
    { connection: getRedis(), concurrency: 3 }
  );

  return { validationWorker, syncWorker };
}
