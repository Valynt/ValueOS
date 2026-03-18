import { useCallback, useMemo, useRef, useState } from "react";

import type { CompanySize, ESOIndustry } from "../../../types/eso";
import {
  type CompositeHealthResult,
  type FeasibilityResult,
  type GroundTruthMetric,
  GroundTruthService,
  type ValidationResult,
} from "../services/GroundTruthService";

export interface UseGroundTruthResult {
  fetchMetricBenchmark: (
    metricId: string,
    industry?: ESOIndustry,
    companySize?: CompanySize,
  ) => Promise<GroundTruthMetric | null>;
  fetchMetricBenchmarks: (
    metricIds: string[],
    industry?: ESOIndustry,
    companySize?: CompanySize,
  ) => Promise<Map<string, GroundTruthMetric>>;
  validateClaim: (
    metricId: string,
    claimedValue: number,
  ) => Promise<ValidationResult | null>;
  assessFeasibility: (
    metricId: string,
    currentValue: number,
    targetValue: number,
  ) => Promise<FeasibilityResult | null>;
  scoreCompositeHealth: (
    metrics: Array<{ metricId: string; value: number }>,
  ) => Promise<CompositeHealthResult | null>;
  clearCache: () => void;
  isLoading: boolean;
  error: string | null;
}

export const useGroundTruth = (): UseGroundTruthResult => {
  const service = useMemo(() => GroundTruthService.getInstance(), []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequests = useRef(0);

  const withLoading = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      activeRequests.current += 1;
      setIsLoading(true);
      setError(null);
      try {
        return await fn();
      } catch {
        setError("Unable to complete request at this time.");
        throw undefined;
      } finally {
        activeRequests.current -= 1;
        if (activeRequests.current === 0) setIsLoading(false);
      }
    },
    [],
  );

  const fetchMetricBenchmark = useCallback(
    async (
      metricId: string,
      industry?: ESOIndustry,
      companySize?: CompanySize,
    ): Promise<GroundTruthMetric | null> => {
      try {
        const result = await withLoading(() =>
          service.getMetricBenchmark(metricId, industry, companySize),
        );
        if (result === null) {
          setError(`No benchmark found for metric: ${metricId}`);
        }
        return result;
      } catch {
        return null;
      }
    },
    [service, withLoading],
  );

  const fetchMetricBenchmarks = useCallback(
    async (
      metricIds: string[],
      industry?: ESOIndustry,
      companySize?: CompanySize,
    ): Promise<Map<string, GroundTruthMetric>> => {
      try {
        return await withLoading(() =>
          service.getMetricBenchmarks(metricIds, industry, companySize),
        );
      } catch {
        return new Map();
      }
    },
    [service, withLoading],
  );

  const validateClaim = useCallback(
    async (
      metricId: string,
      claimedValue: number,
    ): Promise<ValidationResult | null> => {
      try {
        return await withLoading(() =>
          service.validateClaim(metricId, claimedValue),
        );
      } catch {
        return null;
      }
    },
    [service, withLoading],
  );

  const assessFeasibility = useCallback(
    async (
      metricId: string,
      currentValue: number,
      targetValue: number,
    ): Promise<FeasibilityResult | null> => {
      try {
        return await withLoading(() =>
          service.assessFeasibility(metricId, currentValue, targetValue),
        );
      } catch {
        return null;
      }
    },
    [service, withLoading],
  );

  const scoreCompositeHealth = useCallback(
    async (
      metrics: Array<{ metricId: string; value: number }>,
    ): Promise<CompositeHealthResult | null> => {
      try {
        return await withLoading(() =>
          service.scoreCompositeHealth(metrics),
        );
      } catch {
        return null;
      }
    },
    [service, withLoading],
  );

  const clearCache = useCallback(() => {
    service.clearCache();
  }, [service]);

  return {
    fetchMetricBenchmark,
    fetchMetricBenchmarks,
    validateClaim,
    assessFeasibility,
    scoreCompositeHealth,
    clearCache,
    isLoading,
    error,
  };
};
