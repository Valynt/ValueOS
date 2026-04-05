import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { createLogger } from '../../lib/logger.js';

import { getMcpProvider } from './McpProviderRegistry.js';
import {
  McpConfigurePayloadSchema,
  type McpConnectionState,
  type McpFailureReasonCode,
  type McpHealthStatus,
  type McpIntegrationProvider,
  type TenantMcpIntegrationRecord,
  TenantMcpIntegrationRecordSchema,
} from './types.js';

const logger = createLogger({ component: 'McpIntegrationService' });

type McpAuditAction =
  | 'configured'
  | 'validation_enqueued'
  | 'validation_completed'
  | 'sync_enqueued'
  | 'sync_completed'
  | 'reauthorized'
  | 'disabled'
  | 'disconnected';

export class McpIntegrationService {
  constructor(private readonly supabase: SupabaseClient) {}

  async configure(
    tenantId: string,
    userId: string,
    payload: unknown
  ): Promise<TenantMcpIntegrationRecord> {
    const parsed = McpConfigurePayloadSchema.parse(payload);
    const provider = getMcpProvider(parsed.provider);
    const now = new Date().toISOString();

    const upsertResponse = (await this.supabase
      .from('tenant_mcp_integrations')
      .upsert(
        {
          tenant_id: tenantId,
          provider: parsed.provider,
          auth_type: parsed.authType,
          connection_state: 'pending_validation',
          reason_code: null,
          reason_message: null,
          capabilities: provider.getCapabilities(),
          metadata: parsed.config,
          disabled_at: null,
          disconnected_at: null,
          updated_at: now,
        },
        { onConflict: 'tenant_id,provider' }
      )
      .eq('tenant_id', tenantId)
      .select('*')
      .single()) as { data: unknown; error: PostgrestError | null };

    const { data, error } = upsertResponse;

    if (error || !data) {
      logger.error('Failed to configure MCP integration', error ?? undefined, {
        tenantId,
        provider: parsed.provider,
      });
      throw error ?? new Error('Failed to configure MCP integration');
    }

    const integration = TenantMcpIntegrationRecordSchema.parse(data as unknown);

    await this.writeAudit(tenantId, integration.id, userId, 'configured', {
      provider: parsed.provider,
      authType: parsed.authType,
    });

    return integration;
  }

  async getStatus(tenantId: string, provider: McpIntegrationProvider): Promise<TenantMcpIntegrationRecord | null> {
    const statusResponse = (await this.supabase
      .from('tenant_mcp_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .maybeSingle()) as { data: unknown; error: PostgrestError | null };

    const { data, error } = statusResponse;

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return TenantMcpIntegrationRecordSchema.parse(data as unknown);
  }

  async testAccess(tenantId: string, provider: McpIntegrationProvider) {
    const integration = await this.requireIntegration(tenantId, provider);
    const providerClient = getMcpProvider(provider);

    const startedAt = Date.now();
    const result = await providerClient.testAccess({
      tenantId,
      providerConfig: integration.metadata,
    });
    result.latencyMs = Date.now() - startedAt;

    await this.applyHealth(
      integration.id,
      tenantId,
      result.ok ? 'connected' : 'failed',
      result.reasonCode,
      result.message
    );

    if (!result.ok) {
      await this.writeFailure(
        tenantId,
        integration.id,
        provider,
        result.reasonCode ?? 'validation_failed',
        result.message
      );
    }

    return result;
  }

  async getHealth(tenantId: string, provider: McpIntegrationProvider): Promise<McpHealthStatus> {
    const integration = await this.requireIntegration(tenantId, provider);
    const providerClient = getMcpProvider(provider);

    const health = await providerClient.healthCheck({
      tenantId,
      providerConfig: integration.metadata,
    });

    const targetState: McpConnectionState = health.ok ? integration.connection_state : 'degraded';

    await this.applyHealth(
      integration.id,
      tenantId,
      targetState,
      health.reasonCode,
      health.message
    );

    if (!health.ok) {
      await this.writeFailure(
        tenantId,
        integration.id,
        provider,
        health.reasonCode ?? 'provider_unavailable',
        health.message
      );
    }

    return {
      provider,
      state: targetState,
      reasonCode: health.reasonCode,
      statusMessage: health.message,
      checkedAt: new Date().toISOString(),
      queuedValidationJobId: integration.queued_validation_job_id ?? undefined,
      queuedSyncJobId: integration.queued_sync_job_id ?? undefined,
    };
  }

  async reauthorize(tenantId: string, userId: string, provider: McpIntegrationProvider): Promise<void> {
    const integration = await this.requireIntegration(tenantId, provider);

    await this.supabase
      .from('tenant_mcp_integrations')
      .update({
        tenant_id: tenantId,
        connection_state: 'pending_validation',
        reason_code: null,
        reason_message: null,
        disabled_at: null,
        disconnected_at: null,
      })
      .eq('id', integration.id)
      .eq('tenant_id', tenantId);

    await this.writeAudit(tenantId, integration.id, userId, 'reauthorized', { provider });
  }

  async disable(
    tenantId: string,
    userId: string,
    provider: McpIntegrationProvider,
    reasonCode: McpFailureReasonCode = 'disabled_by_admin'
  ): Promise<void> {
    const integration = await this.requireIntegration(tenantId, provider);

    await this.applyHealth(integration.id, tenantId, 'disabled', reasonCode, 'Integration disabled by administrator', true);
    await this.writeAudit(tenantId, integration.id, userId, 'disabled', { provider, reasonCode });
    await this.writeFailure(
      tenantId,
      integration.id,
      provider,
      reasonCode,
      'Integration disabled by administrator'
    );
  }

  async disconnect(tenantId: string, userId: string, provider: McpIntegrationProvider): Promise<void> {
    const integration = await this.requireIntegration(tenantId, provider);

    await this.applyHealth(integration.id, tenantId, 'disconnected', 'manual_disconnect', 'Integration disconnected', false, true);
    await this.writeAudit(tenantId, integration.id, userId, 'disconnected', { provider });
  }

  async listAuditHistory(tenantId: string, provider?: McpIntegrationProvider) {
    let query = this.supabase
      .from('tenant_mcp_integration_audit_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (provider) {
      query = query.eq('provider', provider);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async listFailureHistory(tenantId: string, provider?: McpIntegrationProvider) {
    let query = this.supabase
      .from('tenant_mcp_integration_failures')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (provider) {
      query = query.eq('provider', provider);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async updateQueuedJobs(
    tenantId: string,
    provider: McpIntegrationProvider,
    jobRefs: { validationJobId?: string; syncJobId?: string },
    userId: string
  ): Promise<void> {
    const integration = await this.requireIntegration(tenantId, provider);

    const updatePayload: Record<string, string | null> = {
      tenant_id: tenantId,
    };

    if (jobRefs.validationJobId) {
      updatePayload.queued_validation_job_id = jobRefs.validationJobId;
      await this.writeAudit(tenantId, integration.id, userId, 'validation_enqueued', {
        provider,
        validationJobId: jobRefs.validationJobId,
      });
    }

    if (jobRefs.syncJobId) {
      updatePayload.queued_sync_job_id = jobRefs.syncJobId;
      await this.writeAudit(tenantId, integration.id, userId, 'sync_enqueued', {
        provider,
        syncJobId: jobRefs.syncJobId,
      });
    }

    const { error } = await this.supabase
      .from('tenant_mcp_integrations')
      .update(updatePayload)
      .eq('id', integration.id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw error;
    }
  }

  private async requireIntegration(tenantId: string, provider: McpIntegrationProvider): Promise<TenantMcpIntegrationRecord> {
    const integration = await this.getStatus(tenantId, provider);
    if (!integration) {
      throw new Error(`MCP integration not found for provider: ${provider}`);
    }
    return integration;
  }

  private async applyHealth(
    integrationId: string,
    tenantId: string,
    state: McpConnectionState,
    reasonCode: McpFailureReasonCode | null,
    reasonMessage: string,
    markDisabled = false,
    markDisconnected = false
  ): Promise<void> {
    const now = new Date().toISOString();

    const { error } = await this.supabase
      .from('tenant_mcp_integrations')
      .update({
        tenant_id: tenantId,
        connection_state: state,
        reason_code: reasonCode,
        reason_message: reasonMessage,
        health_checked_at: now,
        validated_at: state === 'connected' ? now : null,
        disabled_at: markDisabled ? now : null,
        disconnected_at: markDisconnected ? now : null,
        updated_at: now,
      })
      .eq('id', integrationId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw error;
    }
  }

  private async writeAudit(
    tenantId: string,
    integrationId: string,
    userId: string,
    action: McpAuditAction,
    details: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.supabase.from('tenant_mcp_integration_audit_events').insert({
      tenant_id: tenantId,
      integration_id: integrationId,
      provider: details.provider,
      action,
      actor_user_id: userId,
      details,
    });

    if (error) {
      logger.warn('Failed to write MCP integration audit event', { tenantId, integrationId, action, error });
    }
  }

  private async writeFailure(
    tenantId: string,
    integrationId: string,
    provider: McpIntegrationProvider,
    reasonCode: McpFailureReasonCode,
    message: string
  ): Promise<void> {
    const { error } = await this.supabase.from('tenant_mcp_integration_failures').insert({
      tenant_id: tenantId,
      integration_id: integrationId,
      provider,
      reason_code: reasonCode,
      message,
    });

    if (error) {
      logger.warn('Failed to write MCP integration failure', {
        tenantId,
        integrationId,
        reasonCode,
        error,
      });
    }
  }
}
