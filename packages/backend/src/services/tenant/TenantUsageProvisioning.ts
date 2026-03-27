import { logger } from '../../lib/logger.js';
// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from '../../lib/supabase.js';

import type { TenantConfig, TenantUsage } from './TenantProvisioningTypes.js';

export async function initializeUsageTracking(config: TenantConfig): Promise<void> {
  const currentPeriod = new Date().toISOString().substring(0, 7);

  const initialUsage: TenantUsage = {
    organizationId: config.organizationId,
    period: currentPeriod,
    users: 1,
    teams: 1,
    projects: 0,
    storage: 0,
    apiCalls: 0,
    agentCalls: 0,
    lastUpdated: new Date(),
  };

  const supabase = createServerSupabaseClient();
  const payload = {
    organization_id: initialUsage.organizationId,
    period: initialUsage.period,
    users: initialUsage.users,
    teams: initialUsage.teams,
    projects: initialUsage.projects,
    storage: initialUsage.storage,
    api_calls: initialUsage.apiCalls,
    agent_calls: initialUsage.agentCalls,
    last_updated: initialUsage.lastUpdated.toISOString(),
  };

  const { error } = await supabase.from('tenant_usage').insert(payload);

  if (error) {
    throw error;
  }

  logger.debug(`Usage tracking initialized for ${config.organizationId}`);
}
