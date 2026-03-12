import { useCallback, useMemo, useState } from "react";

import type { ESOIndustry } from "../../../types/eso";
import {
  GroundTruthService,
  type GroundTruthMetric,
} from "../services/GroundTruthService";

export interface UseGroundTruthResult {
  fetchMetricBenchmark: (
    metricId: string,
    industry?: ESOIndustry,
    companySize?: "smb" | "mid_market" | "enterprise"
  ) => Promise<GroundTruthMetric | null>;
  isLoading: boolean;
  error: string | null;
}

export const useGroundTruth = (): UseGroundTruthResult => {
  const service = useMemo(() => GroundTruthService.getInstance(), []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetricBenchmark: UseGroundTruthResult["fetchMetricBenchmark"] = useCallback(
    async (metricId, industry, companySize) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await service.getMetricBenchmark(metricId, industry, companySize);

        if (!result) {
          const errorMessage = `No benchmark found for metric: ${metricId}`;
          setError(errorMessage);
          return null;
        }

        return result;
      } catch {
        setError("Unable to fetch benchmark at this time.");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [service]
  );

  return {
    fetchMetricBenchmark,
    isLoading,
    error,
  };
};
