import { useState, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import type { Integration, IntegrationProvider } from "../types";
import { PROVIDERS } from "../types";

export function useIntegrations() {
  const { session } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!session?.access_token) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/integrations", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch integrations");
      }

      const data = await response.json();
      setIntegrations(data.integrations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch integrations");
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  const connect = useCallback(async (providerId: string) => {
    try {
      // TODO: Implement OAuth flow or API key setup
      const provider = PROVIDERS.find((p) => p.id === providerId);
      if (!provider) throw new Error("Unknown provider");

      // Redirect to OAuth or show config modal
      console.log("Connect to", providerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, []);

  const disconnect = useCallback(async (integrationId: string) => {
    try {
      // TODO: Implement actual API call
      setIntegrations((prev) => prev.filter((i) => i.id !== integrationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }, []);

  const sync = useCallback(async (integrationId: string) => {
    try {
      // TODO: Implement actual sync
      console.log("Sync", integrationId);
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
    sync,
  };
}
