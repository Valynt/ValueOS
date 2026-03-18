import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetMetricBenchmark, mockGetInstance } = vi.hoisted(() => ({
  mockGetMetricBenchmark: vi.fn(),
  mockGetInstance: vi.fn(),
}));

vi.mock("../services/GroundTruthService", () => ({
  GroundTruthService: {
    getInstance: mockGetInstance,
  },
}));

import { useGroundTruth } from "./useGroundTruth";

describe("useGroundTruth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInstance.mockReturnValue({
      getMetricBenchmark: mockGetMetricBenchmark,
    });
  });

  it("exposes the expected contract for GroundTruthExplorer callers", () => {
    const { result } = renderHook(() => useGroundTruth());

    expect(result.current).toEqual({
      fetchMetricBenchmark: expect.any(Function),
      fetchMetricBenchmarks: expect.any(Function),
      validateClaim: expect.any(Function),
      assessFeasibility: expect.any(Function),
      scoreCompositeHealth: expect.any(Function),
      clearCache: expect.any(Function),
      isLoading: false,
      error: null,
    });
  });

  it("fetches benchmarks and clears loading state", async () => {
    const mockMetric = {
      metricId: "revenue_per_employee",
      name: "Revenue per Employee",
      value: 300000,
      unit: "USD",
      confidence: 0.9,
      source: "ESO",
      benchmarks: {
        p25: 120000,
        p50: 200000,
        p75: 300000,
      },
    };

    mockGetMetricBenchmark.mockResolvedValue(mockMetric);

    const { result } = renderHook(() => useGroundTruth());

    let response: Awaited<ReturnType<typeof result.current.fetchMetricBenchmark>> | null = null;
    await act(async () => {
      response = await result.current.fetchMetricBenchmark("revenue_per_employee", "Software");
    });

    expect(response).toEqual(mockMetric);
    expect(mockGetMetricBenchmark).toHaveBeenCalledWith("revenue_per_employee", "Software", undefined);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBeNull();
  });

  it("returns null and sets an error when service has no benchmark", async () => {
    mockGetMetricBenchmark.mockResolvedValue(null);

    const { result } = renderHook(() => useGroundTruth());

    let response: Awaited<ReturnType<typeof result.current.fetchMetricBenchmark>> | null = null;
    await act(async () => {
      response = await result.current.fetchMetricBenchmark("missing_metric", "Software");
    });

    expect(response).toBeNull();
    expect(result.current.error).toBe("No benchmark found for metric: missing_metric");
    expect(result.current.isLoading).toBe(false);
  });
});
