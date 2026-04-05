import { useCallback, useState } from "react";

import type {
  IntegrationCapabilitySupport,
  IntegrationConnection,
  IntegrationCredentialsInput,
  IntegrationProvider,
  IntegrationProviderId,
  IntegrationProviderCapabilities,
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
}

interface RawCapabilitiesResponseData {
  providers?: Array<{
    provider: string;
    capabilities?: Partial<Record<keyof IntegrationProviderCapabilities, IntegrationCapabilitySupport>>;
  }>;
}

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [providers, setProviders] = useState<IntegrationProvider[]>(PROVIDERS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [integrationsResponse, capabilitiesResponse] = await Promise.all([
        api.getIntegrations(),
        api.getCrmProviderCapabilities(),
      ]);

      if (!integrationsResponse.success) {
        throw new Error(
          integrationsResponse.error?.message || "Failed to fetch integrations"
        );
      }

      const data = integrationsResponse.data as unknown;
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

      if (capabilitiesResponse.success) {
        const capabilitiesData = capabilitiesResponse.data as unknown;
        const rawCapabilities = capabilitiesData as RawCapabilitiesResponseData;
        const capabilitiesByProvider = new Map(
          (rawCapabilities.providers ?? []).map((item) => [item.provider, item.capabilities ?? {}])
        );

        setProviders(
          PROVIDERS.map((provider) => {
            const serverCapabilities = capabilitiesByProvider.get(provider.id);
            return {
              ...provider,
              capabilities: {
                ...provider.capabilities,
                ...serverCapabilities,
              },
            };
          })
        );
      } else {
        setProviders(PROVIDERS);
      }
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

  return {
    integrations,
    providers,
    isLoading,
    error,
    fetchIntegrations,
    connect,
    disconnect,
    testConnection,
    sync,
  };
}
