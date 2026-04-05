import { useCallback, useState } from "react";

import type {
  IntegrationConnection,
  IntegrationCredentialsInput,
  IntegrationProviderId,
  IntegrationStatus,
} from "../types";
import { PROVIDERS } from "../types";

import { api } from "@/api/client/unified-api-client";

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

interface RawResponseData {
  integrations?: RawIntegration[];
  integration?: RawIntegration;
  result?: { status?: string };
  operations?: {
    connectionEvents?: IntegrationOperationEvent[];
    webhookFailures?: IntegrationWebhookFailure[];
    syncFailures?: IntegrationOperationEvent[];
    lifecycleHistory?: IntegrationOperationEvent[];
  };
}

export interface IntegrationOperationEvent {
  id: string;
  category: "connection" | "webhook_failure" | "sync_failure" | "lifecycle";
  action: string;
  provider: IntegrationProviderId;
  status: string;
  timestamp: string;
  correlationId: string | null;
  resourceId: string;
  details?: Record<string, unknown>;
}

export interface IntegrationWebhookFailure {
  id: string;
  provider: IntegrationProviderId;
  eventType: string;
  processStatus: string;
  timestamp: string;
  lastError: Record<string, unknown> | null;
  correlationId: string | null;
}

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operations, setOperations] = useState<{
    connectionEvents: IntegrationOperationEvent[];
    webhookFailures: IntegrationWebhookFailure[];
    syncFailures: IntegrationOperationEvent[];
    lifecycleHistory: IntegrationOperationEvent[];
  }>({
    connectionEvents: [],
    webhookFailures: [],
    syncFailures: [],
    lifecycleHistory: [],
  });

  const fetchIntegrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getIntegrations();
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to fetch integrations");
      }

      const data = response.data as unknown;
      const rawData = data as RawResponseData;
      const items = rawData.integrations ?? [];
      const mapped = items
        .filter((item) => providerIds.has(item.provider))
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

  const connect = useCallback(
    async (providerId: IntegrationProviderId, credentials: IntegrationCredentialsInput) => {
      try {
        setError(null);
        const response = await api.createIntegration({
          provider: providerId,
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          instanceUrl: credentials.instanceUrl,
        });

        if (!response.success) {
          throw new Error(response.error?.message || "Failed to connect integration");
        }

        const data = response.data as unknown;
        const rawData = data as RawResponseData;
        const integration = rawData.integration;
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
            return prev.map((item, index) => (index === existingIndex ? updated : item));
          }
          return [...prev, updated];
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to connect");
      }
    },
    []
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

      const data = response.data as unknown;
      const rawData = data as RawResponseData;
      const result = rawData.result;
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
      const data = response.data as unknown;
      const rawData = data as RawResponseData;
      const integration = rawData.integration;
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

  const fetchOperations = useCallback(async (provider?: IntegrationProviderId) => {
    setOperationsLoading(true);
    setError(null);
    try {
      const response = await api.getIntegrationOperations(provider);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to load integration operations");
      }

      const data = response.data as unknown;
      const rawData = data as RawResponseData;
      const nextOperations = rawData.operations;

      setOperations({
        connectionEvents: nextOperations?.connectionEvents ?? [],
        webhookFailures: nextOperations?.webhookFailures ?? [],
        syncFailures: nextOperations?.syncFailures ?? [],
        lifecycleHistory: nextOperations?.lifecycleHistory ?? [],
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load operations");
    } finally {
      setOperationsLoading(false);
    }
  }, []);

  const retrySyncFailure = useCallback(async (provider: IntegrationProviderId) => {
    setError(null);
    const response = await api.retryIntegrationSync(provider);
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to retry sync");
    }
    await fetchOperations(provider);
  }, [fetchOperations]);

  const replayWebhookFailure = useCallback(async (provider: IntegrationProviderId, eventId: string) => {
    setError(null);
    const response = await api.replayIntegrationWebhook(provider, eventId);
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to replay webhook");
    }
    await fetchOperations(provider);
  }, [fetchOperations]);

  return {
    integrations,
    providers: PROVIDERS,
    isLoading,
    operationsLoading,
    error,
    operations,
    fetchIntegrations,
    fetchOperations,
    connect,
    disconnect,
    testConnection,
    sync,
    retrySyncFailure,
    replayWebhookFailure,
  };
}
