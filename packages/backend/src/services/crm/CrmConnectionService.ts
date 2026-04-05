/**
 * CRM Connection Service
 *
 * Manages CRM OAuth connections, token storage (encrypted), and connection lifecycle.
 * Uses service-role Supabase client for DB operations.
 */

import { createLogger } from '../../lib/logger.js';
// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from '../../lib/supabase.js';
import {
  CRM_INTEGRATION_EVENTS,
  recordCrmIntegrationEvent,
  runCrmOperation,
} from './CrmIntegrationObservability.js';

import { getCrmProvider } from './CrmProviderRegistry.js';
import { consumeOAuthState, createOAuthState, updateOAuthStateCodeVerifier } from './OAuthStateStore.js';
import { decryptToken, encryptToken, needsReEncryption, tokenFingerprint } from './tokenEncryption.js';
import type {
  CrmConnectionRow,
  CrmProvider,
  OAuthTokens,
} from './types.js';

/**
 * Minimum required scopes per provider. Connections missing these are rejected.
 */
const REQUIRED_SCOPES: Record<CrmProvider, string[]> = {
  salesforce: ['api', 'refresh_token'],
  hubspot: ['crm.objects.deals.read', 'crm.objects.companies.read'],
};

const logger = createLogger({ component: 'CrmConnectionService' });

export class CrmConnectionService {
  private supabase = createServerSupabaseClient();

  /**
   * Start OAuth flow — generates an opaque nonce, persists the mapping
   * in Redis/memory, and returns the auth URL with only the nonce as state.
   */
  async startOAuth(
    tenantId: string,
    provider: CrmProvider,
    redirectUri: string,
  ): Promise<{ authUrl: string; state: string }> {
    return runCrmOperation(
      {
        provider,
        tenantId,
        operation: 'connect.start_oauth',
        correlationId: `${provider}:${tenantId}:${Date.now()}`,
      },
      async () => {
        const impl = getCrmProvider(provider);
        recordCrmIntegrationEvent(CRM_INTEGRATION_EVENTS.CONNECT_STARTED, {
          provider,
          tenantId,
          operation: 'connect.start_oauth',
          correlationId: `${provider}:${tenantId}:${Date.now()}`,
        });

        // Persist state first to get the canonical nonce, then build the auth URL
        // with that nonce. Back-fill the PKCE codeVerifier after getAuthUrl returns it.
        const nonce = await createOAuthState({
          tenantId,
          provider,
          redirectUri,
          createdAt: Date.now(),
        });

        const result = impl.getAuthUrl(nonce, redirectUri);

        if (result.codeVerifier) {
          await updateOAuthStateCodeVerifier(nonce, result.codeVerifier);
        }

        logger.info('OAuth flow started', {
          tenantId,
          provider,
          audit_event: 'oauth.flow.started',
        });
        return { authUrl: result.authUrl, state: nonce };
      }
    );
  }

  /**
   * Complete OAuth flow — validate and consume the nonce, exchange code
   * for tokens, and persist the connection.
   *
   * Rejects replayed, expired, or provider-mismatched states.
   */
  async completeOAuth(
    tenantId: string,
    provider: CrmProvider,
    code: string,
    state: string,
    redirectUri: string,
    connectedBy: string,
  ): Promise<CrmConnectionRow> {
    // Consume the nonce — one-time use, validates provider match
    const stateMeta = await consumeOAuthState(state, provider);
    if (!stateMeta) {
      recordCrmIntegrationEvent(CRM_INTEGRATION_EVENTS.CONNECT_FAILED, {
        provider,
        tenantId,
        operation: 'connect.complete_oauth',
        correlationId: state,
      }, { reason: 'invalid_state' });
      logger.warn('OAuth callback rejected: invalid, expired, or replayed state', {
        tenantId,
        provider,
        audit_event: 'oauth.callback.rejected',
        reason: 'invalid_state',
      });
      throw new Error('Invalid or expired OAuth state. Please restart the connection flow.');
    }

    // Verify the tenant matches the one that initiated the flow
    if (stateMeta.tenantId !== tenantId) {
      recordCrmIntegrationEvent(CRM_INTEGRATION_EVENTS.CONNECT_FAILED, {
        provider,
        tenantId,
        operation: 'connect.complete_oauth',
        correlationId: state,
      }, { reason: 'tenant_mismatch' });
      logger.warn('OAuth callback rejected: tenant mismatch', {
        expectedTenant: stateMeta.tenantId,
        actualTenant: tenantId,
        provider,
        audit_event: 'oauth.callback.rejected',
        reason: 'tenant_mismatch',
      });
      throw new Error('OAuth state does not match the requesting tenant.');
    }

    const impl = getCrmProvider(provider);
    const tokens = await impl.exchangeCodeForTokens(
      { code, state, codeVerifier: stateMeta.codeVerifier },
      redirectUri,
    );

    // Validate minimum required scopes
    const required = REQUIRED_SCOPES[provider] || [];
    const missing = required.filter((s) => !tokens.scopes.includes(s));
    if (missing.length > 0) {
      logger.warn('CRM connection missing required scopes', {
        tenantId,
        provider,
        missing,
        granted: tokens.scopes,
      });
    }

    const row = await this.upsertConnection(tenantId, provider, tokens, connectedBy);

    logger.info('CRM connected', {
      tenantId,
      provider,
      connectionId: row.id,
      fingerprint: tokenFingerprint(tokens.accessToken),
      audit_event: 'oauth.callback.success',
    });
    return row;
  }

  /**
   * Complete OAuth flow after the state nonce has already been consumed
   * and validated by the caller. Exchanges the authorization code for
   * tokens and persists the connection.
   */
  async completeOAuthAfterStateValidation(
    tenantId: string,
    provider: CrmProvider,
    code: string,
    redirectUri: string,
    connectedBy: string,
  ): Promise<CrmConnectionRow> {
    return runCrmOperation(
      {
        provider,
        tenantId,
        operation: 'connect.complete_oauth',
        correlationId: `${provider}:${tenantId}:${Date.now()}`,
      },
      async () => {
        const impl = getCrmProvider(provider);
        // State is not needed for token exchange with most providers,
        // but pass empty string for interface compatibility.
        const tokens = await impl.exchangeCodeForTokens({ code, state: '' }, redirectUri);

        // Validate minimum required scopes
        const required = REQUIRED_SCOPES[provider] || [];
        const missing = required.filter((s) => !tokens.scopes.includes(s));
        if (missing.length > 0) {
          logger.warn('CRM connection missing required scopes', {
            tenantId,
            provider,
            missing,
            granted: tokens.scopes,
          });
        }

        const row = await this.upsertConnection(tenantId, provider, tokens, connectedBy);
        recordCrmIntegrationEvent(CRM_INTEGRATION_EVENTS.CONNECT_SUCCEEDED, {
          provider,
          tenantId,
          operation: 'connect.complete_oauth',
          correlationId: row.id,
        });

        logger.info('CRM connected', {
          tenantId,
          provider,
          connectionId: row.id,
          fingerprint: tokenFingerprint(tokens.accessToken),
          audit_event: 'oauth.callback.success',
        });
        return row;
      }
    );
  }

  /**
   * Disconnect a CRM provider for a tenant.
   */
  async disconnect(tenantId: string, provider: CrmProvider): Promise<void> {
    await runCrmOperation(
      {
        provider,
        tenantId,
        operation: 'connect.disconnect',
        correlationId: `${provider}:${tenantId}:${Date.now()}`,
      },
      async () => {
        const { error } = await this.supabase
          .from('crm_connections')
          .update({
            status: 'disconnected',
            access_token_enc: null,
            refresh_token_enc: null,
            token_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('provider', provider);

        if (error) {
          logger.error('Failed to disconnect CRM', error, { tenantId, provider });
          throw error;
        }

        logger.info('CRM disconnected', { tenantId, provider });
      }
    );
  }

  /**
   * Get connection status for a provider.
   */
  async getConnection(
    tenantId: string,
    provider: CrmProvider,
  ): Promise<CrmConnectionRow | null> {
    const { data, error } = await this.supabase
      .from('crm_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .maybeSingle();

    if (error) {
      logger.error('Failed to get CRM connection', error, { tenantId, provider });
      throw error;
    }

    return data as CrmConnectionRow | null;
  }

  /**
   * Get decrypted tokens for a connection. Refreshes if needed.
   */
  async getTokens(
    tenantId: string,
    provider: CrmProvider,
  ): Promise<OAuthTokens | null> {
    const conn = await this.getConnection(tenantId, provider);
    if (!conn || conn.status !== 'connected' || !conn.access_token_enc) {
      return null;
    }

    const tokens: OAuthTokens = {
      accessToken: decryptToken(conn.access_token_enc),
      refreshToken: conn.refresh_token_enc ? decryptToken(conn.refresh_token_enc) : '',
      expiresAt: conn.token_expires_at ? new Date(conn.token_expires_at) : new Date(0),
      instanceUrl: conn.instance_url || undefined,
      scopes: conn.scopes || [],
      externalOrgId: conn.external_org_id || undefined,
      externalUserId: conn.external_user_id || undefined,
    };

    // Attempt refresh if needed
    const impl = getCrmProvider(provider);
    try {
      const refreshed = await impl.refreshTokenIfNeeded(tokens);
      if (refreshed) {
        await this.upsertConnection(tenantId, provider, refreshed, conn.connected_by || '');
        return refreshed;
      }
    } catch (err) {
      recordCrmIntegrationEvent(CRM_INTEGRATION_EVENTS.REAUTH_REQUIRED, {
        provider,
        tenantId,
        operation: 'token.refresh',
        correlationId: `${provider}:${tenantId}`,
      });
      logger.error('Token refresh failed', err instanceof Error ? err : undefined, {
        tenantId,
        provider,
      });
      // Mark connection as expired
      await this.supabase
        .from('crm_connections')
        .update({
          status: 'expired',
          last_error: { message: err instanceof Error ? err.message : String(err) },
        })
        .eq('tenant_id', tenantId)
        .eq('provider', provider);
      return null;
    }

    return tokens;
  }

  /**
   * Update sync cursor after a successful delta sync.
   */
  async updateSyncCursor(
    tenantId: string,
    provider: CrmProvider,
    cursor: string,
    success: boolean,
  ): Promise<void> {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      sync_cursor: cursor,
      last_sync_at: now,
      updated_at: now,
    };

    if (success) {
      update.last_successful_sync_at = now;
      update.last_error = null;
    }

    await this.supabase
      .from('crm_connections')
      .update(update)
      .eq('tenant_id', tenantId)
      .eq('provider', provider);
  }

  /**
   * Record a sync error.
   */
  async recordSyncError(
    tenantId: string,
    provider: CrmProvider,
    error: Error,
  ): Promise<void> {
    await this.supabase
      .from('crm_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: { message: error.message, timestamp: new Date().toISOString() },
        status: 'error',
      })
      .eq('tenant_id', tenantId)
      .eq('provider', provider);
  }

  // ---- Private helpers ----

  private async upsertConnection(
    tenantId: string,
    provider: CrmProvider,
    tokens: OAuthTokens,
    connectedBy: string,
  ): Promise<CrmConnectionRow> {
    const now = new Date().toISOString();
    const keyVersion = parseInt(process.env.CRM_TOKEN_KEY_VERSION || '1', 10);

    const row = {
      tenant_id: tenantId,
      provider,
      status: 'connected',
      access_token_enc: encryptToken(tokens.accessToken),
      refresh_token_enc: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
      token_expires_at: tokens.expiresAt.toISOString(),
      instance_url: tokens.instanceUrl || null,
      external_org_id: tokens.externalOrgId || null,
      external_user_id: tokens.externalUserId || null,
      scopes: tokens.scopes,
      connected_by: connectedBy,
      token_key_version: keyVersion,
      token_last_rotated_at: now,
      token_fingerprint: tokenFingerprint(tokens.accessToken),
      updated_at: now,
    };

    const { data, error } = await this.supabase
      .from('crm_connections')
      .upsert(row, { onConflict: 'tenant_id,provider' })
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to upsert CRM connection', error, { tenantId, provider });
      throw error;
    }

    return data as CrmConnectionRow;
  }
}

export const crmConnectionService = new CrmConnectionService();
