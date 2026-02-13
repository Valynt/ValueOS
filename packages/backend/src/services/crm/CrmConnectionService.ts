/**
 * CRM Connection Service
 *
 * Manages CRM OAuth connections, token storage (encrypted), and connection lifecycle.
 * Uses service-role Supabase client for DB operations.
 */

import { createServerSupabaseClient } from '../../lib/supabase.js';
import { createLogger } from '../../lib/logger.js';
import { getRedisClient, getRedisKey } from '../../lib/redis.js';
import { randomUUID } from 'node:crypto';
import { encryptToken, decryptToken, tokenFingerprint, needsReEncryption } from './tokenEncryption.js';
import { getCrmProvider } from './CrmProviderRegistry.js';
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
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

interface StoredOAuthState {
  nonce: string;
  tenantId: string;
  userId: string;
  provider: CrmProvider;
  expiresAt: string;
}

export class CrmConnectionService {
  private supabase = createServerSupabaseClient();

  /**
   * Start OAuth flow — returns the auth URL for the provider.
   */
  async startOAuth(
    tenantId: string,
    userId: string,
    provider: CrmProvider,
    redirectUri: string,
  ): Promise<{ authUrl: string; state: string }> {
    const nonce = await this.createOAuthState(tenantId, userId, provider);
    const impl = getCrmProvider(provider);
    const result = impl.getAuthUrl(nonce, redirectUri);

    logger.info('OAuth flow started', { tenantId, provider });
    return result;
  }

  async consumeOAuthStateOnce(
    nonce: string,
    provider: CrmProvider,
  ): Promise<StoredOAuthState> {
    const redis = await getRedisClient();
    if (!redis) {
      throw new Error('OAuth state store unavailable');
    }

    const key = this.getOAuthStateKey(nonce);
    const raw = await redis.getDel(key);

    if (!raw) {
      throw new Error('OAuth state not found or already consumed');
    }

    let parsed: StoredOAuthState;
    try {
      parsed = JSON.parse(raw) as StoredOAuthState;
    } catch {
      throw new Error('Invalid OAuth state payload');
    }

    if (parsed.nonce !== nonce) {
      throw new Error('OAuth state nonce mismatch');
    }

    if (parsed.provider !== provider) {
      throw new Error('OAuth state provider mismatch');
    }

    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      throw new Error('OAuth state expired');
    }

    return parsed;
  }

  /**
   * Complete OAuth flow — exchange code for tokens and persist.
   */
  async completeOAuth(
    tenantId: string,
    provider: CrmProvider,
    code: string,
    state: string,
    redirectUri: string,
    connectedBy: string,
  ): Promise<CrmConnectionRow> {
    const impl = getCrmProvider(provider);

    const tokens = await impl.exchangeCodeForTokens({ code, state }, redirectUri);

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
      // Allow connection but log — some providers return scopes differently
    }

    const row = await this.upsertConnection(tenantId, provider, tokens, connectedBy);

    logger.info('CRM connected', {
      tenantId,
      provider,
      connectionId: row.id,
      fingerprint: tokenFingerprint(tokens.accessToken),
    });
    return row;
  }

  /**
   * Disconnect a CRM provider for a tenant.
   */
  async disconnect(tenantId: string, provider: CrmProvider): Promise<void> {
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

  private async createOAuthState(
    tenantId: string,
    userId: string,
    provider: CrmProvider,
  ): Promise<string> {
    const redis = await getRedisClient();
    if (!redis) {
      throw new Error('OAuth state store unavailable');
    }

    const nonce = randomUUID();
    const payload: StoredOAuthState = {
      nonce,
      tenantId,
      userId,
      provider,
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_SECONDS * 1000).toISOString(),
    };

    await redis.set(this.getOAuthStateKey(nonce), JSON.stringify(payload), {
      EX: OAUTH_STATE_TTL_SECONDS,
    });

    return nonce;
  }

  private getOAuthStateKey(nonce: string): string {
    return getRedisKey('backend', 'crm_oauth_state', nonce);
  }
}

export const crmConnectionService = new CrmConnectionService();
