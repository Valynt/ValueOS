import React, { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Label } from "../components/ui/label";

type AnalyticsPoint = { date: string; models: number; accuracy: number };

type AnalyticsPayload = {
  stats: AnalyticsPoint[];
  totals: { modelsBuilt: number; averageAccuracy: number; auditCompliance: number };
  logs: Array<{ id: string; title: string; hash: string }>;
};

export const VEAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/mcp-dashboard/pages/ve-analytics", {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Failed to load VE analytics: ${response.status}`);
        }
        const payload = (await response.json()) as AnalyticsPayload;
        setData(payload);
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load VE analytics data");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">VE Performance & Audit Dashboard</h1>

      {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-4">
          <Label className="text-xs text-muted-foreground uppercase">Total Models Built</Label>
          <p className="text-3xl font-bold">{isLoading ? "..." : data?.totals.modelsBuilt ?? 0}</p>
          <Badge className="mt-2 bg-green-100 text-green-700">Measured from production model events</Badge>
        </Card>
        <Card className="p-4">
          <Label className="text-xs text-muted-foreground uppercase">Avg. Model Accuracy</Label>
          <p className="text-3xl font-bold">{isLoading ? "..." : `${(data?.totals.averageAccuracy ?? 0).toFixed(1)}%`}</p>
          <Badge className="mt-2 bg-blue-100 text-blue-700">Quality benchmark</Badge>
        </Card>
        <Card className="p-4">
          <Label className="text-xs text-muted-foreground uppercase">VMRT Audit Compliance</Label>
          <p className="text-3xl font-bold">{isLoading ? "..." : `${data?.totals.auditCompliance ?? 0}%`}</p>
          <Badge className="mt-2 bg-green-100 text-green-700">Verified</Badge>
        </Card>
      </div>

      <Card className="p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Modeling Velocity & Accuracy</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.stats ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="models" stroke="#08A0A0" strokeWidth={2} name="Models" />
              <Line type="monotone" dataKey="accuracy" stroke="#0FBF9B" strokeWidth={2} name="Accuracy (%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent VMRT Audit Logs</h3>
        <div className="space-y-2">
          {(data?.logs ?? []).map((log) => (
            <div key={log.id} className="flex justify-between items-center p-3 border rounded bg-muted/10 text-sm">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{log.id}</p>
                <p className="font-medium">{log.title}</p>
              </div>
              <Badge variant="outline">Verified Hash: {log.hash}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
