import React, { useState } from "react";

import type { ESOIndustry } from "../../../types/eso";
import { useGroundTruth } from "../hooks/useGroundTruth";
import type { GroundTruthMetric } from "../services/GroundTruthService";

import { ConfidenceBadge } from "./ConfidenceBadge";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export const GroundTruthExplorer: React.FC = () => {
  const { fetchMetricBenchmark, isLoading, error } = useGroundTruth();
  const [metricId, setMetricId] = useState("revenue_per_employee");
  const [industry, setIndustry] = useState<ESOIndustry>("Software");
  const [result, setResult] = useState<GroundTruthMetric | null>(null);

  const handleExplore = async () => {
    const data = await fetchMetricBenchmark(metricId, industry);
    setResult(data);
  };

  return (
    <Card className="p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span role="img" aria-label="Database">
          🔍
        </span>{" "}
        Ground Truth Explorer (ESO)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <Label htmlFor="metric-id">Metric ID</Label>
          <Input
            id="metric-id"
            value={metricId}
            onChange={(e) => setMetricId(e.target.value)}
            placeholder="e.g. revenue_per_employee"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value as ESOIndustry)}
            placeholder="e.g. Software"
          />
        </div>
      </div>

      <Button onClick={handleExplore} disabled={isLoading} className="w-full md:w-auto">
        {isLoading ? "Fetching Truth..." : "Fetch Benchmark"}
      </Button>

      {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

      {result && (
        <div className="mt-6 space-y-4 border-t pt-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium text-gray-900">{result.name}</h4>
              <p className="text-sm text-gray-500">Source: {result.source}</p>
            </div>
            <ConfidenceBadge confidence={result.confidence} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500 uppercase">25th Pctl</p>
              <p className="text-lg font-bold">
                {result.benchmarks.p25.toLocaleString()} {result.unit}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-center border border-blue-100">
              <p className="text-xs text-blue-600 uppercase font-semibold">Median (P50)</p>
              <p className="text-lg font-bold text-blue-700">
                {result.benchmarks.p50.toLocaleString()} {result.unit}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500 uppercase">75th Pctl</p>
              <p className="text-lg font-bold">
                {result.benchmarks.p75.toLocaleString()} {result.unit}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
