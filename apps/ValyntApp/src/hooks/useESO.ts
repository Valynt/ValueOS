/**
 * ESO (Economic Statistics Organizations) Hook
 *
 * React hook for accessing real-time economic data from SEC, BLS, and Census.
 * Provides integration with ValueOS deterministic B2B value orchestration.
 */

import { useCallback, useEffect } from "react";

import { useESOStore } from "../stores/esoStore";

export interface ESOConfig {
  sec: {
    baseUrl: string;
    rateLimit?: number;
    enableCache?: boolean;
    cacheTTL?: number;
  };
  bls: {
    baseUrl: string;
    apiKey?: string;
    rateLimit?: number;
    enableCache?: boolean;
    cacheTTL?: number;
  };
  census: {
    baseUrl: string;
    apiKey?: string;
    rateLimit?: number;
    enableCache?: boolean;
    cacheTTL?: number;
  };
  enableRealtime: boolean;
  websocketUrl?: string;
}

export const useESO = (config?: ESOConfig) => {
  const {
    data,
    isConnected,
    isStreaming,
    error,
    lastUpdate,
    initializeESO,
    startStreaming,
    stopStreaming,
    fetchData,
    clearData,
    setError,
  } = useESOStore();

  // Initialize ESO service when config is provided
  useEffect(() => {
    if (config && !isConnected) {
      initializeESO(config);
    }
  }, [config, isConnected, initializeESO]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isStreaming) {
        stopStreaming();
      }
    };
  }, [isStreaming, stopStreaming]);

  const fetchSECData = useCallback(
    (params?: { cik?: string; type?: string }) => {
      return fetchData("SEC", params);
    },
    [fetchData]
  );

  const fetchBLSData = useCallback(
    (params: { seriesId: string; startYear?: string; endYear?: string }) => {
      return fetchData("BLS", params);
    },
    [fetchData]
  );

  const fetchCensusData = useCallback(
    (params: { dataset: string; variables: string[]; geography?: string }) => {
      return fetchData("Census", params);
    },
    [fetchData]
  );

  const getDataBySource = useCallback(
    (source: "SEC" | "BLS" | "Census") => {
      return data[source] || null;
    },
    [data]
  );

  const getLatestData = useCallback(() => {
    return Object.entries(data).map(([source, sourceData]) => ({
      source: source as "SEC" | "BLS" | "Census",
      ...sourceData,
    }));
  }, [data]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    // State
    data,
    isConnected,
    isStreaming,
    error,
    lastUpdate,

    // Actions
    startStreaming,
    stopStreaming,
    fetchSECData,
    fetchBLSData,
    fetchCensusData,
    clearData,
    clearError,

    // Computed
    getDataBySource,
    getLatestData,
    hasData: Object.keys(data).length > 0,
    isStale: lastUpdate > 0 && Date.now() - lastUpdate > 300000, // 5 minutes
  };
};
