/**
 * Integration Connection Service
 *
 * Manages CRM integration connections for a tenant.
 * Uses service-role Supabase client + TenantAwareService checks for defense-in-depth.
 */

import { TenantAwareService } from "./TenantAwareService.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { createLogger } from "@shared/lib/logger";

const logger = createLogger({ component: "IntegrationConnectionService" });

export type IntegrationProvider = "hubspot" | "salesforce";
export type IntegrationStatus = "active" | "expired" | "revoked" | "error";

export interface IntegrationConnection {
  id: string;
  tenantId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  connectedAt?: string | null;
  lastUsedAt?: string | null;
  lastRefreshedAt?: string | null;
  tokenExpiresAt?: string | null;
  instanceUrl?: string | null;
  scopes?: string[] | null;
  errorMessage?: string | null;
}

export interface IntegrationConnectPayload {
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  instanceUrl?: string;
  scopes?: string[];
}

export interface IntegrationTestResult {
  ok: boolean;
  status: IntegrationStatus;
  message: string;
}

const SUPPORTED_PROVIDERS: IntegrationProvider[] = ["hubspot", "salesforce"];

const PROVIDER_REQUIREMENTS: Record<IntegrationProvider, { requiresInstanceUrl: boolean }> = {
  hubspot: { requiresInstanceUrl: false },
  salesforce: { requiresInstanceUrl: true },
};

const DEFAULT_TEST_TIMEOUT_MS = 8000;

export class IntegrationConnectionService extends TenantAwareService {
  constructor() {
    super("IntegrationConnectionService");
  }

  async listConnections(userId: string, tenantId: string): Promise<IntegrationConnection[]> {
    await this.validateTenantAccess(userId, tenantId);

    const { data, error } = await this.supabase
      .from("tenant_integrations")
      .select(
        [
          "id",
          "tenant_id",
          "provider",
          "status",
          "connected_at",
          "last_used_at",
          "last_refreshed_at",
          "token_expires_at",
          "instance_url",
          "scopes",
          "error_message",
        ].join(",")
      )
      .eq("tenant_id", tenantId);

    if (error) {
      logger.error("Failed to list integrations", error, { tenantId });
      throw error;
    }

    return (data || []).map(this.toConnection);
  }

  async connect(
    userId: string,
    tenantId: string,
    payload: IntegrationConnectPayload
  ): Promise<IntegrationConnection> {
    await this.validateTenantAccess(userId, tenantId);
    this.validatePayload(payload);

    const now = new Date().toISOString();
    const upsertPayload = {
      tenant_id: tenantId,
      provider: payload.provider,
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken ?? null,
      token_expires_at: payload.tokenExpiresAt ?? null,
      instance_url: payload.instanceUrl ?? null,
      scopes: payload.scopes ?? [],
      status: "active",
      error_message: null,
      connected_by: userId,
      connected_at: now,
      last_used_at: now,
      last_refreshed_at: payload.refreshToken ? now : null,
      updated_at: now,
    };

    const { data, error } = await this.supabase
      .from("tenant_integrations")
      .upsert(upsertPayload, { onConflict: "tenant_id,provider" })
      .select(
        [
          "id",
          "tenant_id",
          "provider",
          "status",
          "connected_at",
          "last_used_at",
          "last_refreshed_at",
          "token_expires_at",
          "instance_url",
          "scopes",
          "error_message",
        ].join(",")
      )
      .single();

    if (error || !data) {
      logger.error("Failed to upsert integration", error, { tenantId, provider: payload.provider });
      throw error || new Error("Failed to create integration");
    }

    return this.toConnection(data);
  }

  async disconnect(userId: string, tenantId: string, integrationId: string): Promise<IntegrationConnection> {
    const integration = await this.fetchIntegrationById(integrationId);
    await this.validateTenantAccess(userId, integration.tenant_id);

    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("tenant_integrations")
      .update({
        status: "revoked",
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        instance_url: null,
        error_message: null,
        last_used_at: now,
        updated_at: now,
      })
      .eq("id", integrationId)
      .select(
        [
          "id",
          "tenant_id",
          "provider",
          "status",
          "connected_at",
          "last_used_at",
          "last_refreshed_at",
          "token_expires_at",
          "instance_url",
          "scopes",
          "error_message",
        ].join(",")
      )
      .single();

    if (error || !data) {
      logger.error("Failed to disconnect integration", error, { integrationId, tenantId });
      throw error || new Error("Failed to disconnect integration");
    }

    return this.toConnection(data);
  }

  async sync(userId: string, tenantId: string, integrationId: string): Promise<IntegrationConnection> {
    const integration = await this.fetchIntegrationById(integrationId);
    await this.validateTenantAccess(userId, integration.tenant_id);

    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("tenant_integrations")
      .update({
        last_used_at: now,
        updated_at: now,
      })
      .eq("id", integrationId)
      .select(
        [
          "id",
          "tenant_id",
          "provider",
          "status",
          "connected_at",
          "last_used_at",
          "last_refreshed_at",
          "token_expires_at",
          "instance_url",
          "scopes",
          "error_message",
        ].join(",")
      )
      .single();

    if (error || !data) {
      logger.error("Failed to mark integration sync", error, { integrationId, tenantId });
      throw error || new Error("Failed to sync integration");
    }

    await this.recordUsage(integrationId, userId, "sync_requested");

    return this.toConnection(data);
  }

  async testConnection(
    userId: string,
    tenantId: string,
    integrationId: string
  ): Promise<IntegrationTestResult> {
    const integration = await this.fetchIntegrationById(integrationId, true);
    await this.validateTenantAccess(userId, integration.tenant_id);

    const provider = integration.provider as IntegrationProvider;
    this.assertProvider(provider);

    let ok = false;
    let message = "Unknown error";

    try {
      if (provider === "hubspot") {
        const response = await this.fetchWithTimeout(
          "https://api.hubapi.com/integrations/v1/me",
          {
            headers: {
              Authorization: `Bearer ${integration.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
        ok = response.ok;
        message = response.ok ? "HubSpot connection verified" : `HubSpot responded ${response.status}`;
      }

      if (provider === "salesforce") {
        if (!integration.instance_url) {
          throw new ValidationError("Salesforce instance URL is required");
        }

        const instanceUrl = integration.instance_url.replace(/\/+$/, "");
        const response = await this.fetchWithTimeout(`${instanceUrl}/services/data`, {
          headers: {
            Authorization: `Bearer ${integration.access_token}`,
            "Content-Type": "application/json",
          },
        });
        ok = response.ok;
        message = response.ok ? "Salesforce connection verified" : `Salesforce responded ${response.status}`;
      }
    } catch (error) {
      ok = false;
      message = error instanceof Error ? error.message : "Connection test failed";
    }

    const now = new Date().toISOString();
    const status: IntegrationStatus = ok ? "active" : "error";
    const errorMessage = ok ? null : message;

    await this.supabase
      .from("tenant_integrations")
      .update({
        status,
        error_message: errorMessage,
        last_used_at: now,
        updated_at: now,
      })
      .eq("id", integrationId);

    await this.recordUsage(integrationId, userId, "test_connection");

    return {
      ok,
      status,
      message,
    };
  }

  private assertProvider(provider: string): asserts provider is IntegrationProvider {
    if (!SUPPORTED_PROVIDERS.includes(provider as IntegrationProvider)) {
      throw new ValidationError(`Unsupported provider: ${provider}`);
    }
  }

  private validatePayload(payload: IntegrationConnectPayload): void {
    this.assertProvider(payload.provider);

    if (!payload.accessToken || payload.accessToken.trim().length < 10) {
      throw new ValidationError("Access token is required");
    }

    const requirements = PROVIDER_REQUIREMENTS[payload.provider];
    if (requirements.requiresInstanceUrl) {
      if (!payload.instanceUrl) {
        throw new ValidationError("Instance URL is required for Salesforce");
      }
      try {
        const parsed = new URL(payload.instanceUrl);
        if (parsed.protocol !== "https:") {
          throw new ValidationError("Instance URL must use https");
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        throw new ValidationError("Instance URL is invalid");
      }
    }
  }

  private async fetchIntegrationById(
    integrationId: string,
    includeSecrets = false
  ): Promise<any> {
    const fields = includeSecrets
      ? [
          "id",
          "tenant_id",
          "provider",
          "status",
          "access_token",
          "refresh_token",
          "token_expires_at",
          "instance_url",
          "scopes",
          "connected_at",
          "last_used_at",
          "last_refreshed_at",
          "error_message",
        ]
      : [
          "id",
          "tenant_id",
          "provider",
          "status",
          "token_expires_at",
          "instance_url",
          "scopes",
          "connected_at",
          "last_used_at",
          "last_refreshed_at",
          "error_message",
        ];

    const { data, error } = await this.supabase
      .from("tenant_integrations")
      .select(fields.join(","))
      .eq("id", integrationId)
      .single();

    if (error || !data) {
      logger.warn("Integration not found", { integrationId });
      throw new NotFoundError("Integration");
    }

    return data;
  }

  private toConnection(row: any): IntegrationConnection {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      provider: row.provider,
      status: row.status,
      connectedAt: row.connected_at,
      lastUsedAt: row.last_used_at,
      lastRefreshedAt: row.last_refreshed_at,
      tokenExpiresAt: row.token_expires_at,
      instanceUrl: row.instance_url,
      scopes: row.scopes,
      errorMessage: row.error_message,
    };
  }

  private async recordUsage(
    integrationId: string,
    userId: string,
    action: string
  ): Promise<void> {
    const { error } = await this.supabase.from("integration_usage_log").insert({
      integration_id: integrationId,
      user_id: userId,
      action,
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.warn("Failed to record integration usage", { integrationId, action, error });
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = DEFAULT_TEST_TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const integrationConnectionService = new IntegrationConnectionService();
