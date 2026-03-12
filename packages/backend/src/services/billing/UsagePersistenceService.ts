import { createLogger } from "@shared/lib/logger";

import { createServerSupabaseClient } from "../../lib/supabase.js";

export interface UsagePersistencePayload {
  organization_id: string;
  period: string;
  users: number;
  teams: number;
  projects: number;
  storage: number;
  api_calls: number;
  agent_calls: number;
  last_updated: string;
}

const logger = createLogger({ component: "UsagePersistenceService" });
const serviceRoleSupabase = createServerSupabaseClient();

export async function persistTenantUsage(payload: UsagePersistencePayload): Promise<void> {
  const { error } = await serviceRoleSupabase.from("tenant_usage").upsert(payload).select();

  if (error) {
    logger.error("Failed to persist tenant usage", error, {
      organizationId: payload.organization_id,
      period: payload.period,
    });
    throw error;
  }
}
