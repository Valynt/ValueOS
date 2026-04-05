import { useCallback, useEffect, useState } from "react";

import type {
  CrmIntegrationProviderId,
  IntegrationActionKey,
  IntegrationCapabilities,
  IntegrationConnection,
  IntegrationCredentialsInput,
  IntegrationOperationsResponse,
  IntegrationProvider,
  IntegrationProviderId,
  IntegrationStatus,
} from "../types";
import { PROVIDERS } from "../types";

import { api, apiClient } from "@/api/client/unified-api-client";

const mapStatus = (status?: string): IntegrationStatus => {
  switch (status) {
    case "active":
      return "connected";
    case "revoked":
      return "disconnected";
    case "expired":
      return "error";
    case "error":
      return "error";
    default:
      return "pending";
  }
};

const providerIds = new Set(PROVIDERS.map((provider) => provider.id));

interface RawIntegration {
  id: string;
  provider: string;
  status?: string;
  connectedAt?: string;
  connected_at?: string;
  lastUsedAt?: string;
  last_used_at?: string;
  errorMessage?: string;
  error_message?: string;
  instanceUrl?: string;
  instance_url?: string;
  scopes?: string[];
}

interface RawProviderCapabilityResponse {
  providers?: Array<{
    provider: string;
    displayName?: string;
    category?: "crm" | "communication";
    description?: string;
    authType?: "oauth" | "apikey" | "basic";
    requiresInstanceUrl?: boolean;
    capabilities?: Partial<IntegrationCapabilities>;
    unsupportedReasons?: Partial<Record<keyof IntegrationCapabilities, string>>;
  }>;
}

interface RawResponseData {
  integrations?: RawIntegration[];
  integration?: RawIntegration;
  result?: { status?: string };
  authUrl?: string;
}

interface CrmStatusResponse {
  connected?: boolean;
  status?: string;
  lastSyncAt?: string;
  last_sync_at?: string;
  lastError?: string;
  last_error?: string;
}

interface CrmHealthResponse {
  status?: string;
  lastSyncAt?: string;
  last_sync_at?: string;
  error?: string;
  lastError?: string;
  last_error?: string;
}

const defaultCapabilities: IntegrationCapabilities = {
  oauth: false,
  webhook_support: false,
  delta_sync: false,
  manual_sync: true,
  field_mapping: false,
  backfill: false,
  credential_rotation: true,
  connection_test: true,
};

const emptyOperations: IntegrationOperationsResponse = {
  tenantId: "",
  generatedAt: "",
  provider: "all",
  connectionEvents: [],
  webhookFailures: [],
  syncFailures: [],
  lifecycleHistory: [],
};

const isCrmProvider = (providerId: IntegrationProviderId): providerId is CrmIntegrationProviderId =>
  providerId === "hubspot" || providerId === "salesforce";

const getUnsupportedActionReasons = (
  capabilities: IntegrationCapabilities,
  rawReasons?: Partial<Record<keyof IntegrationCapabilities, string>>
): Partial<Record<IntegrationActionKey, string>> => {
  const reasons: Partial<Record<IntegrationActionKey, string>> = {};
  if (!capabilities.oauth && !capabilities.manual_sync) {
    reasons.connect = rawReasons?.oauth || "Connection is not yet supported for this provider.";
  }
  if (!capabilities.oauth) {
    reasons.reconnect = rawReasons?.oauth || "Reauthorization is not available for this provider.";
  }
  if (!capabilities.manual_sync) {
    reasons.sync = rawReasons?.manual_sync || "Manual sync is not available for this provider.";
  }
  if (!capabilities.connection_test) {
    reasons.test = rawReasons?.connection_test || "Connection testing is not available for this provider.";
  }
  return reasons;
};

const mapProviderFromRegistry = (
  provider: RawProviderCapabilityResponse["providers"][number]
): IntegrationProvider | null => {
  if (!providerIds.has(provider.provider as IntegrationProviderId)) {
    return null;
  }

  const providerId = provider.provider as IntegrationProviderId;
  const fallbackProvider = PROVIDERS.find((item) => item.id === providerId);
  if (!fallbackProvider) {
    return null;
  }

  const capabilities: IntegrationCapabilities = {
    ...defaultCapabilities,
    ...(provider.capabilities ?? {}),
  };

  return {
    ...fallbackProvider,
    name: provider.displayName ?? fallbackProvider.name,
    description: provider.description ?? fallbackProvider.description,
    type: provider.category ?? fallbackProvider.type,
    authType: provider.authType ?? fallbackProvider.authType,
    requiresInstanceUrl: provider.requiresInstanceUrl ?? fallbackProvider.requiresInstanceUrl,
    capabilities,
    unsupportedActionReasons: getUnsupportedActionReasons(capabilities, provider.unsupportedReasons),
  };
};

const isCrmOAuthProvider = (provider: IntegrationProvider): boolean =>
  provider.type === "crm" && provider.authType === "oauth" && provider.capabilities.oauth;

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [providers, setProviders] = useState<IntegrationProvider[]>(PROVIDERS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthInProgressProvider, setOauthInProgressProvider] =
    useState<IntegrationProviderId | null>(null);
  const [operations, setOperations] = useState<IntegrationOperationsResponse>(emptyOperations);

  const fetchProviders = useCallback(async () => {
    try {
      const response = await api.getIntegrationProviderCapabilities();
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to fetch provider capabilities");
      }

      const raw = (response.data ?? {}) as RawProviderCapabilityResponse;
      const mapped = (raw.providers ?? [])
        .map(mapProviderFromRegistry)
        .filter((provider): provider is IntegrationProvider => provider !== null);

      if (mapped.length > 0) {
        setProviders(mapped);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch provider capabilities");
    }
  }, []);

  const fetchIntegrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getIntegrations();
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to fetch integrations");
      }

      const data = response.data as RawResponseData;
      const items = data.integrations ?? [];
      const mapped = items
        .filter((item) => providerIds.has(item.provider as IntegrationProviderId))
        .map((item) => ({
          id: item.id,
          provider: item.provider as IntegrationProviderId,
          status: mapStatus(item.status),
          connectedAt: item.connectedAt ?? item.connected_at,
          lastSyncAt: item.lastUsedAt ?? item.last_used_at,
          errorMessage: item.errorMessage ?? item.error_message ?? undefined,
          instanceUrl: item.instanceUrl ?? item.instance_url,
          scopes: item.scopes ?? [],
        }));

      setIntegrations(mapped);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch integrations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshCrmConnectionState = useCallback(async (providerId: CrmIntegrationProviderId) => {
    const [statusResponse, healthResponse] = await Promise.all([
      apiClient.get(`/api/crm/${providerId}/status`),
      apiClient.get(`/api/crm/${providerId}/health`),
    ]);

    if (!statusResponse.success) {
      throw new Error(statusResponse.error?.message || "Failed to fetch CRM status");
    }
    if (!healthResponse.success) {
      throw new Error(healthResponse.error?.message || "Failed to fetch CRM health");
    }

    const statusData = (statusResponse.data ?? {}) as CrmStatusResponse;
    const healthData = (healthResponse.data ?? {}) as CrmHealthResponse;

    setIntegrations((prev) => {
      const existing = prev.find((item) => item.provider === providerId);
      const mergedStatus = mapStatus(healthData.status ?? statusData.status);
      const updatedConnection: IntegrationConnection = {
        id: existing?.id ?? providerId,
        provider: providerId,
        status: statusData.connected === false ? "disconnected" : mergedStatus,
        connectedAt: existing?.connectedAt,
        lastSyncAt:
          statusData.lastSyncAt ??
          statusData.last_sync_at ??
          healthData.lastSyncAt ??
          healthData.last_sync_at ??
          existing?.lastSyncAt,
        errorMessage:
          statusData.lastError ??
          statusData.last_error ??
          healthData.error ??
          healthData.lastError ??
          healthData.last_error ??
          undefined,
        instanceUrl: existing?.instanceUrl,
        scopes: existing?.scopes ?? [],
      };

      if (updatedConnection.status === "disconnected") {
        return prev.filter((item) => item.provider !== providerId);
      }

      if (!existing) {
        return [...prev, updatedConnection];
      }

      return prev.map((item) =>
        item.provider === providerId ? { ...item, ...updatedConnection } : item
      );
    });
  }, []);

  const connect = useCallback(
    async (providerId: IntegrationProviderId, credentials?: IntegrationCredentialsInput) => {
      try {
        setError(null);
        const provider = providers.find((item) => item.id === providerId);
        if (!provider) {
          throw new Error("Unsupported integration provider");
        }

        if (isCrmOAuthProvider(provider)) {
          const response = await apiClient.post(`/api/crm/${providerId}/connect/start`);
          if (!response.success) {
            throw new Error(response.error?.message || "Failed to start OAuth flow");
          }

          const data = response.data as RawResponseData;
          if (!data.authUrl) {
            throw new Error("OAuth start response is missing authUrl");
          }

          const popup = window.open(
            data.authUrl,
            `crm-oauth-${providerId}`,
            "popup=yes,width=600,height=720"
          );
          if (!popup) {
            throw new Error("Popup blocked. Please allow popups and try again.");
          }
          setOauthInProgressProvider(providerId);
          return;
        }

        if (!provider.capabilities.manual_sync) {
          throw new Error(
            provider.unsupportedActionReasons?.connect ||
              "This provider does not support manual connection in this release."
          );
        }

        if (!credentials) {
          throw new Error("Credentials are required for manual integrations");
        }

        const response = await api.createIntegration({
          provider: providerId,
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          instanceUrl: credentials.instanceUrl,
        });

        if (!response.success) {
          throw new Error(response.error?.message || "Failed to connect integration");
        }

        const data = response.data as RawResponseData;
        const integration = data.integration;
        if (!integration) {
          throw new Error("Integration response missing");
        }

        setIntegrations((prev) => {
          const existingIndex = prev.findIndex((i) => i.provider === providerId);
          const updated: IntegrationConnection = {
            id: integration.id,
            provider: integration.provider as IntegrationProviderId,
            status: mapStatus(integration.status),
            connectedAt: integration.connectedAt ?? integration.connected_at,
            lastSyncAt: integration.lastUsedAt ?? integration.last_used_at,
            errorMessage: integration.errorMessage ?? integration.error_message ?? undefined,
            instanceUrl: integration.instanceUrl ?? integration.instance_url,
            scopes: integration.scopes ?? [],
          };

          if (existingIndex >= 0) {
            const clone = [...prev];
            clone[existingIndex] = updated;
            return clone;
          }
          return [...prev, updated];
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to connect");
      }
    },
    [providers]
  );

  const disconnect = useCallback(async (integrationId: string) => {
    try {
      setError(null);
      const response = await api.deleteIntegration(integrationId);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to disconnect");
      }
      setIntegrations((prev) => prev.filter((i) => i.id !== integrationId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }, []);

  const testConnection = useCallback(async (integrationId: string) => {
    try {
      setError(null);
      const response = await api.testIntegration(integrationId);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to test connection");
      }

      const data = response.data as RawResponseData;
      const result = data.result;
      if (result?.status) {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId ? { ...i, status: mapStatus(result.status) } : i
          )
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to test connection");
    }
  }, []);

  const sync = useCallback(async (integrationId: string) => {
    try {
      setError(null);
      const response = await api.syncIntegration(integrationId);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to sync integration");
      }
      const data = response.data as RawResponseData;
      const integration = data.integration;
      if (integration) {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? {
                  ...i,
                  status: mapStatus(integration.status),
                  lastSyncAt: integration.lastUsedAt ?? integration.last_used_at ?? i.lastSyncAt,
                }
              : i
          )
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sync");
    }
  }, []);

  const fetchOperations = useCallback(async (provider?: CrmIntegrationProviderId) => {
    try {
      const response = await api.getIntegrationOperations({ provider, limit: 25 });
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to load integration operations");
      }

      const data = (response.data ?? {}) as Partial<IntegrationOperationsResponse>;
      setOperations({
        tenantId: data.tenantId ?? "",
        generatedAt: data.generatedAt ?? "",
        provider: data.provider ?? (provider ?? "all"),
        connectionEvents: data.connectionEvents ?? [],
        webhookFailures: data.webhookFailures ?? [],
        syncFailures: data.syncFailures ?? [],
        lifecycleHistory: data.lifecycleHistory ?? [],
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load integration operations");
    }
  }, []);

  const replayWebhookFailure = useCallback(async (eventId: string) => {
    try {
      const response = await api.replayWebhookFailure(eventId);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to replay webhook event");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to replay webhook event");
      throw err;
    }
  }, []);

  const retrySyncFailure = useCallback(async (provider: CrmIntegrationProviderId) => {
    try {
      const response = await api.retryIntegrationSync(provider);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to retry sync");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to retry sync");
      throw err;
    }
  }, []);

  useEffect(() => {
    const onOAuthMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; provider?: string; error?: string };
      if (!data || typeof data !== "object") {
        return;
      }

      if (data.type === "crm-oauth-error") {
        setOauthInProgressProvider(null);
        setError(data.error || "OAuth connection failed");
        return;
      }

      if (data.type !== "crm-oauth-complete" || !data.provider || !providerIds.has(data.provider as IntegrationProviderId)) {
        return;
      }

      const providerId = data.provider as IntegrationProviderId;
      setOauthInProgressProvider(null);
      setError(null);

      if (!isCrmProvider(providerId)) {
        void fetchIntegrations();
        return;
      }

      void Promise.all([fetchIntegrations(), refreshCrmConnectionState(providerId)]).catch(
        (err: unknown) => {
          setError(
            err instanceof Error
              ? err.message
              : "Connected, but failed to refresh connection status"
          );
        }
      );
    };

    window.addEventListener("message", onOAuthMessage);
    return () => {
      window.removeEventListener("message", onOAuthMessage);
    };
  }, [fetchIntegrations, refreshCrmConnectionState]);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  return {
    integrations,
    providers,
    isLoading,
    error,
    oauthInProgressProvider,
    fetchIntegrations,
    connect,
    disconnect,
    testConnection,
    sync,
    operations,
    fetchOperations,
    replayWebhookFailure,
    retrySyncFailure,
  };
}
