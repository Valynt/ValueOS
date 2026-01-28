import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MetricVariance {
  name: string;
  predicted: number;
  actual: number;
}

export const RealizationDashboard: React.FC = () => {
  const [data] = useState<MetricVariance[]>([
    { name: "Efficiency Gain", predicted: 20, actual: 18 },
    { name: "Cost Reduction", predicted: 50000, actual: 52000 },
    { name: "Cycle Time", predicted: 10, actual: 12 },
  ]);

  const getStatus = (v: MetricVariance) => {
    const diff = ((v.actual - v.predicted) / v.predicted) * 100;
    if (Math.abs(diff) < 5) return { label: "On Track", color: "bg-green-100 text-green-700" };
    if (diff > 0) return { label: "Exceeding", color: "bg-blue-100 text-blue-700" };
    return { label: "At Risk", color: "bg-red-100 text-red-700" };
  };

  return (
    <Card className="p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span role="img" aria-label="Target">
          🎯
        </span>{" "}
        Value Realization & Variance Analysis
      </h3>

      <div className="h-[300px] w-full mb-8">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="predicted" fill="#9AA6B2" name="Predicted" />
            <Bar dataKey="actual" fill="#08A0A0" name="Actual" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-4">
        <Label>Metric Performance</Label>
        <div className="grid grid-cols-1 gap-2">
          {data.map((v, i) => {
            const status = getStatus(v);
            return (
              <div
                key={i}
                className="flex justify-between items-center p-3 border rounded-lg bg-muted/20"
              >
                <div>
                  <p className="font-medium">{v.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Actual: {v.actual.toLocaleString()} vs Predicted: {v.predicted.toLocaleString()}
                  </p>
                </div>
                <Badge className={status.color}>{status.label}</Badge>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
