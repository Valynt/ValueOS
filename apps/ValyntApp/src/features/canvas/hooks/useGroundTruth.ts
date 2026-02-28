import { useCallback, useState } from "react";
import { type GroundTruthMetric, GroundTruthService } from "../services/GroundTruthService";
import type { ESOIndustry } from "../../../types/eso";

export function useGroundTruth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetricBenchmark = useCallback(
    async (
      metricId: string,
      industry?: ESOIndustry,
      companySize?: "smb" | "mid_market" | "enterprise"
    ): Promise<GroundTruthMetric | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = GroundTruthService.getInstance();
        const metric = await service.getMetricBenchmark(metricId, industry, companySize);
        return metric;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch ground truth";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    fetchMetricBenchmark,
    isLoading,
    error,
  };
}
