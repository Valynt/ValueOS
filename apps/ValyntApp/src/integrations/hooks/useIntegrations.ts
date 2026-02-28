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

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getIntegrations();
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to fetch integrations");
      }

      const items = (response.data as any)?.integrations ?? [];
      const mapped = items
        .filter((item: any) => providerIds.has(item.provider))
        .map((item: any) => ({
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
    } catch (err) {
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

        const integration = (response.data as any)?.integration;
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
    } catch (err) {
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
    } catch (err) {
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

      const result = (response.data as any)?.result;
      if (result?.status) {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId ? { ...i, status: mapStatus(result.status) } : i
          )
        );
      }
    } catch (err) {
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
      const integration = (response.data as any)?.integration;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync");
    }
  }, []);

  return {
    integrations,
    providers: PROVIDERS,
    isLoading,
    error,
    fetchIntegrations,
    connect,
    disconnect,
    testConnection,
    sync,
  };
}
