import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../../lib/logger.js';
import type { TenantExecutionState } from '../../types/billing.js';

export interface PauseStateActor {
  actorId: string;
  actorType: 'system' | 'admin';
}

export class TenantExecutionStateService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getActiveState(organizationId: string): Promise<TenantExecutionState | null> {
    const { data, error } = await this.supabase
      .from('tenant_execution_state')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_paused', true)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch execution state: ${error.message}`);
    }

    return (data ?? null) as TenantExecutionState | null;
  }

  async pauseTenantExecution(
    organizationId: string,
    reason: string,
    actor: PauseStateActor,
    metadata: Record<string, unknown> = {},
  ): Promise<TenantExecutionState> {
    const pausedAt = new Date().toISOString();
    const payload = {
      organization_id: organizationId,
      is_paused: true,
      reason,
      paused_at: pausedAt,
      paused_by: actor.actorId,
      actor_type: actor.actorType,
      metadata,
      updated_at: pausedAt,
    };

    const { data, error } = await this.supabase
      .from('tenant_execution_state')
      .upsert(payload, { onConflict: 'organization_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to pause tenant execution: ${error.message}`);
    }

    await this.appendAuditTrail(organizationId, 'paused', actor, reason, metadata);

    return data as TenantExecutionState;
  }

  async clearPauseState(
    organizationId: string,
    actor: PauseStateActor,
    reason: string,
    metadata: Record<string, unknown> = {},
  ): Promise<TenantExecutionState> {
    const updatedAt = new Date().toISOString();
    const payload = {
      organization_id: organizationId,
      is_paused: false,
      reason: null,
      paused_at: null,
      paused_by: null,
      actor_type: actor.actorType,
      metadata,
      updated_at: updatedAt,
    };

    const { data, error } = await this.supabase
      .from('tenant_execution_state')
      .upsert(payload, { onConflict: 'organization_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to clear pause state: ${error.message}`);
    }

    await this.appendAuditTrail(organizationId, 'resumed', actor, reason, metadata);
    return data as TenantExecutionState;
  }

  private async appendAuditTrail(
    organizationId: string,
    action: 'paused' | 'resumed',
    actor: PauseStateActor,
    reason: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('tenant_execution_state_audit')
      .insert({
        organization_id: organizationId,
        action,
        actor_id: actor.actorId,
        actor_type: actor.actorType,
        reason,
        metadata,
        created_at: new Date().toISOString(),
      });

    if (error) {
      logger.error('Failed to persist tenant execution state audit trail', error);
      throw new Error(`Failed to persist tenant execution state audit trail: ${error.message}`);
    }
  }
}
