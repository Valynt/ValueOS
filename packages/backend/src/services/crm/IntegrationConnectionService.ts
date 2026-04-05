/**
 * Integration Connection Service
 *
 * Manages CRM integration connections for a tenant.
 * Uses service-role Supabase client + TenantAwareService checks for defense-in-depth.
 */

import { Counter, metrics } from "@opentelemetry/api";
import { createLogger } from "@shared/lib/logger";
import { HubSpotAdapter, SalesforceAdapter, ServiceNowAdapter, SharePointAdapter, SlackAdapter } from "@valueos/integrations";

import { getSecretBrokerService } from "../secrets/SecretBrokerService.js";
import { TenantAwareService } from "../auth/TenantAwareService.js";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors.js";

const logger = createLogger({ component: "IntegrationConnectionService" });

export type IntegrationProvider = "hubspot" | "salesforce" | "dynamics" | "servicenow" | "sharepoint" | "slack";
export type IntegrationStatus = "active" | "expired" | "revoked" | "error";
export type IntegrationCapabilityKey =
  | "oauth"
  | "webhook_support"
  | "delta_sync"
  | "manual_sync"
  | "field_mapping"
  | "backfill"
  | "test_connection"
  | "credential_rotation";

export interface IntegrationCapability {
  supported: boolean;
  reason?: string;
}

export type IntegrationCapabilityMap = Record<IntegrationCapabilityKey, IntegrationCapability>;

export interface IntegrationProviderCapabilities {
  provider: IntegrationProvider;
  capabilities: IntegrationCapabilityMap;
}

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

export interface IntegrationAuditEvent {
  id: string;
  timestamp: string;
  source: "integration_usage_log" | "secret_access_audits";
  action: string;
  decision?: "allow" | "deny";
  reason?: string;
  userId?: string;
}

const SUPPORTED_PROVIDERS: IntegrationProvider[] = ["hubspot", "salesforce", "servicenow", "sharepoint", "slack"];

const DEFAULT_CAPABILITIES: IntegrationCapabilityMap = {
  oauth: { supported: false },
  webhook_support: { supported: false },
  delta_sync: { supported: false },
  manual_sync: { supported: false },
  field_mapping: { supported: false },
  backfill: { supported: false },
  test_connection: { supported: true },
  credential_rotation: { supported: true },
};

const PROVIDER_CAPABILITIES: Record<IntegrationProvider, IntegrationCapabilityMap> = {
  hubspot: {
    ...DEFAULT_CAPABILITIES,
    oauth: { supported: true },
    webhook_support: { supported: true },
    delta_sync: { supported: true },
    manual_sync: { supported: true },
    field_mapping: { supported: true },
    backfill: { supported: true },
  },
  salesforce: {
    ...DEFAULT_CAPABILITIES,
    oauth: { supported: true },
    webhook_support: { supported: true },
    delta_sync: { supported: true },
    manual_sync: { supported: true },
    field_mapping: { supported: true },
    backfill: { supported: true },
  },
  dynamics: {
    ...DEFAULT_CAPABILITIES,
    oauth: { supported: false, reason: "Dynamics OAuth is not enabled in this workspace." },
    manual_sync: { supported: true },
    webhook_support: { supported: false, reason: "Webhook subscriptions are not configured yet." },
    delta_sync: { supported: false, reason: "Delta sync is not configured yet." },
    field_mapping: { supported: false, reason: "Field mapping UI is not configured yet." },
    backfill: { supported: false, reason: "Backfill jobs are not configured yet." },
  },
  servicenow: {
    ...DEFAULT_CAPABILITIES,
    oauth: { supported: false, reason: "ServiceNow OAuth is not enabled in this workspace." },
    manual_sync: { supported: true },
    webhook_support: { supported: false, reason: "Webhook subscriptions are not configured yet." },
    delta_sync: { supported: false, reason: "Delta sync is not configured yet." },
    field_mapping: { supported: false, reason: "Field mapping UI is not configured yet." },
    backfill: { supported: false, reason: "Backfill jobs are not configured yet." },
  },
  sharepoint: {
    ...DEFAULT_CAPABILITIES,
    oauth: { supported: false, reason: "SharePoint OAuth is not enabled in this workspace." },
    manual_sync: { supported: true },
    webhook_support: { supported: false, reason: "Webhook subscriptions are not configured yet." },
    delta_sync: { supported: false, reason: "Delta sync is not configured yet." },
    field_mapping: { supported: false, reason: "Field mapping UI is not configured yet." },
    backfill: { supported: false, reason: "Backfill jobs are not configured yet." },
  },
  slack: {
    ...DEFAULT_CAPABILITIES,
    oauth: { supported: false, reason: "Slack OAuth is not enabled in this workspace." },
    manual_sync: { supported: false, reason: "Slack does not support manual data sync in this flow." },
    webhook_support: { supported: true },
    delta_sync: { supported: false, reason: "Slack delta sync is not supported." },
    field_mapping: { supported: false, reason: "Field mapping is not applicable for Slack." },
    backfill: { supported: false, reason: "Backfill is not supported for Slack in this flow." },
  },
};

/**
 * Allowlisted hostname patterns for Salesforce instance URLs.
 * Prevents SSRF by rejecting arbitrary URLs stored in tenant records.
 *
 * Matches production, sandbox, and scratch-org hostnames, e.g.:
 *   https://myorg.salesforce.com
 *   https://myorg.my.salesforce.com
 *   https://myorg--sandbox.sandbox.my.salesforce.com
 *   https://myorg.lightning.force.com
 *
 * The subdomain portion allows multiple dot-separated labels so that
 * multi-segment sandbox hostnames are accepted.
 */
const SALESFORCE_INSTANCE_URL_PATTERN =
  /^https:\/\/([a-zA-Z0-9-]+\.)+salesforce\.com(\/|$)|^https:\/\/([a-zA-Z0-9-]+\.)+force\.com(\/|$)/;

function assertSalesforceInstanceUrl(instanceUrl: string): void {
  if (!SALESFORCE_INSTANCE_URL_PATTERN.test(instanceUrl)) {
    throw new ValidationError(
      `Salesforce instance URL '${instanceUrl}' does not match an allowed Salesforce domain. ` +
      "Expected a URL under *.salesforce.com or *.force.com."
    );
  }
}

const PROVIDER_REQUIREMENTS: Record<IntegrationProvider, { requiresInstanceUrl: boolean }> = {
  hubspot: { requiresInstanceUrl: false },
  salesforce: { requiresInstanceUrl: true },
  dynamics: { requiresInstanceUrl: true },
  servicenow: { requiresInstanceUrl: true },
  sharepoint: { requiresInstanceUrl: false },
  slack: { requiresInstanceUrl: false },
};

const DEFAULT_TEST_TIMEOUT_MS = 8000;


interface TenantIntegrationRow {
  id: string;
  tenant_id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  access_token_secret_id?: string | null;
  refresh_token_secret_id?: string | null;
  token_expires_at?: string | null;
  instance_url?: string | null;
  scopes?: string[] | null;
  connected_at?: string | null;
  last_used_at?: string | null;
  last_refreshed_at?: string | null;
  error_message?: string | null;
}

export class IntegrationConnectionService extends TenantAwareService {
  private meter = metrics.getMeter("integration-connections");
  private readonly secretBroker = getSecretBrokerService();
  private adapterCounter: Counter = this.meter.createCounter("integration_adapter_test_total", {
    description: "Count of adapter-backed integration connection tests",
  });

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

  getProviderCapabilities(): IntegrationProviderCapabilities[] {
    return SUPPORTED_PROVIDERS.map((provider) => ({
      provider,
      capabilities: PROVIDER_CAPABILITIES[provider],
    }));
  }

  async connect(
    userId: string,
    tenantId: string,
    payload: IntegrationConnectPayload
  ): Promise<IntegrationConnection> {
    await this.validateTenantAccess(userId, tenantId);
    this.validatePayload(payload);

    const now = new Date().toISOString();
    const environment = this.getSecretEnvironment();

    const accessSecret = await this.secretBroker.upsertSecret({
      tenantId,
      integration: payload.provider,
      secretName: "access_token",
      plaintextValue: payload.accessToken,
      environment,
      allowedAgents: [userId],
      allowedTools: ["integration_connection_service"],
      allowedPurposes: ["integration.connection.validate", "integration.connection.sync"],
      actorId: userId,
    });

    const refreshSecret = payload.refreshToken
      ? await this.secretBroker.upsertSecret({
          tenantId,
          integration: payload.provider,
          secretName: "refresh_token",
          plaintextValue: payload.refreshToken,
          environment,
          allowedAgents: [userId],
          allowedTools: ["integration_connection_service"],
          allowedPurposes: ["integration.connection.validate", "integration.connection.sync"],
          actorId: userId,
        })
      : null;

    const upsertPayload = {
      tenant_id: tenantId,
      provider: payload.provider,
      access_token: null,
      refresh_token: null,
      access_token_secret_id: accessSecret.id,
      refresh_token_secret_id: refreshSecret?.id ?? null,
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
    if (integration.tenant_id !== tenantId) {
      throw new AuthorizationError("Integration does not belong to the active tenant");
    }
    await this.validateTenantAccess(userId, integration.tenant_id);

    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("tenant_integrations")
      .update({
        status: "revoked",
        access_token: null,
        refresh_token: null,
        access_token_secret_id: null,
        refresh_token_secret_id: null,
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
    if (integration.tenant_id !== tenantId) {
      throw new AuthorizationError("Integration does not belong to the active tenant");
    }
    await this.validateTenantAccess(userId, integration.tenant_id);
    if (integration.status === "revoked") {
      throw new ValidationError("Integration is disconnected");
    }

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

  async rotateCredentials(
    userId: string,
    tenantId: string,
    integrationId: string,
    payload: Pick<IntegrationConnectPayload, "accessToken" | "refreshToken" | "tokenExpiresAt">
  ): Promise<IntegrationConnection> {
    const integration = await this.fetchIntegrationById(integrationId);
    if (integration.tenant_id !== tenantId) {
      throw new AuthorizationError("Integration does not belong to the active tenant");
    }
    await this.validateTenantAccess(userId, integration.tenant_id);
    this.assertProvider(integration.provider);

    const environment = this.getSecretEnvironment();
    await this.secretBroker.rotateSecret({
      tenantId,
      integration: integration.provider,
      secretName: "access_token",
      environment,
      newPlaintextValue: payload.accessToken,
      actorId: userId,
    });

    if (payload.refreshToken) {
      await this.secretBroker.rotateSecret({
        tenantId,
        integration: integration.provider,
        secretName: "refresh_token",
        environment,
        newPlaintextValue: payload.refreshToken,
        actorId: userId,
      });
    }

    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("tenant_integrations")
      .update({
        status: "active",
        token_expires_at: payload.tokenExpiresAt ?? null,
        last_refreshed_at: now,
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
      logger.error("Failed to update integration after credential rotation", error, { integrationId, tenantId });
      throw error || new Error("Failed to rotate integration credentials");
    }

    await this.recordUsage(integrationId, userId, "rotate_credentials");
    return this.toConnection(data);
  }

  async testConnection(
    userId: string,
    tenantId: string,
    integrationId: string
  ): Promise<IntegrationTestResult> {
    const integration = await this.fetchIntegrationById(integrationId);
    if (integration.tenant_id !== tenantId) {
      throw new AuthorizationError("Integration does not belong to the active tenant");
    }
    await this.validateTenantAccess(userId, integration.tenant_id);
    if (integration.status === "revoked") {
      throw new ValidationError("Integration is disconnected");
    }

    const provider = integration.provider;
    this.assertProvider(provider);
    const credentials = await this.resolveRuntimeCredentials(tenantId, userId, provider);
    const accessToken = credentials.accessToken;

    let ok = false;
    let message = "Unknown error";

    try {
      const adapterBackedEnabled = process.env.ENABLE_INTEGRATION_ADAPTER_TESTS === "true";
      if (adapterBackedEnabled && provider !== "dynamics") {
        const adapter = this.createAdapter(provider, integration);
        await adapter.connect({
          accessToken,
          tenantId,
        });
        ok = await adapter.validate();
        await adapter.disconnect();
        message = ok ? `${provider} connection verified` : `${provider} authorization failed`;
        this.adapterCounter.add(1, { provider, outcome: ok ? "success" : "auth_failed" });
      } else {
        if (provider === "hubspot") {
          const response = await this.fetchWithTimeout(
            "https://api.hubapi.com/integrations/v1/me",
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
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

          // Validate against allowlist before making any outbound request to
          // prevent SSRF via a compromised or malicious tenant_integrations record.
          assertSalesforceInstanceUrl(integration.instance_url);

          const instanceUrl = integration.instance_url.replace(/\/+$/, "");
          const response = await this.fetchWithTimeout(`${instanceUrl}/services/data`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          });
          ok = response.ok;
          message = response.ok ? "Salesforce connection verified" : `Salesforce responded ${response.status}`;
        }
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

  private createAdapter(provider: Exclude<IntegrationProvider, "dynamics">, integration: TenantIntegrationRow) {
    switch (provider) {
      case "hubspot":
        return new HubSpotAdapter({ provider: "hubspot" });
      case "salesforce":
        return new SalesforceAdapter({ provider: "salesforce", baseUrl: integration.instance_url ?? undefined });
      case "servicenow":
        return new ServiceNowAdapter({ provider: "servicenow", baseUrl: integration.instance_url ?? undefined });
      case "sharepoint":
        return new SharePointAdapter({ provider: "sharepoint" });
      case "slack":
        return new SlackAdapter({ provider: "slack" });
    }
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
  ): Promise<TenantIntegrationRow> {
    const fields = [
      "id",
      "tenant_id",
      "provider",
      "status",
      "access_token_secret_id",
      "refresh_token_secret_id",
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

  private getSecretEnvironment(): "development" | "staging" | "production" {
    if (process.env.NODE_ENV === "production") return "production";
    if (process.env.NODE_ENV === "staging") return "staging";
    return "development";
  }

  private async resolveRuntimeCredentials(
    tenantId: string,
    userId: string,
    provider: IntegrationProvider
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    const environment = this.getSecretEnvironment();
    const accessDecision = await this.secretBroker.resolve({
      tenantId,
      agentId: userId,
      capability: `${provider}.access_token`,
      purpose: "integration.connection.validate",
      toolName: "integration_connection_service",
      environment,
    });

    if (accessDecision.decision === "deny") {
      throw new AuthorizationError(`Credential access denied: ${accessDecision.reason}`);
    }

    const refreshDecision = await this.secretBroker.resolve({
      tenantId,
      agentId: userId,
      capability: `${provider}.refresh_token`,
      purpose: "integration.connection.validate",
      toolName: "integration_connection_service",
      environment,
    });

    return {
      accessToken: accessDecision.grant.decryptedValue,
      refreshToken: refreshDecision.decision === "allow" ? refreshDecision.grant.decryptedValue : undefined,
    };
  }

  private toConnection(row: TenantIntegrationRow): IntegrationConnection {
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

  async getAuditHistory(
    userId: string,
    tenantId: string,
    integrationId: string,
    limit = 50
  ): Promise<IntegrationAuditEvent[]> {
    const integration = await this.fetchIntegrationById(integrationId);
    if (integration.tenant_id !== tenantId) {
      throw new AuthorizationError("Integration does not belong to the active tenant");
    }
    await this.validateTenantAccess(userId, integration.tenant_id);
    this.assertProvider(integration.provider);

    const { data: usageRows, error: usageError } = await this.supabase
      .from("integration_usage_log")
      .select("id, action, user_id, created_at")
      .eq("integration_id", integrationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (usageError) {
      logger.error("Failed to read integration usage audit history", usageError, { integrationId, tenantId });
      throw usageError;
    }

    const secretAudits = await this.secretBroker.getAuditLog(tenantId, { limit: limit * 2 });
    const providerPrefix = `${integration.provider}.`;

    const mappedUsage: IntegrationAuditEvent[] = (usageRows ?? []).map((row) => ({
      id: row.id as string,
      timestamp: row.created_at as string,
      source: "integration_usage_log",
      action: row.action as string,
      userId: row.user_id as string | undefined,
    }));

    const mappedSecretAudits: IntegrationAuditEvent[] = secretAudits
      .filter((audit) => audit.capability.startsWith(providerPrefix))
      .map((audit) => ({
        id: audit.id,
        timestamp: audit.created_at,
        source: "secret_access_audits",
        action: `secret_access:${audit.capability}`,
        decision: audit.decision,
        reason: audit.reason,
        userId: audit.agent_id,
      }));

    return [...mappedUsage, ...mappedSecretAudits]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
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
