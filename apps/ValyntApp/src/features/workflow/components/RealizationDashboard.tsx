import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/api/client/unified-api-client";

interface KPIVariance {
  name: string;
  committed_value: number;
  realized_value: number;
  unit: string;
  variance_percentage: number;
  direction: "over" | "under" | "on_target";
}

interface Milestone {
  title: string;
  status: string;
  due_date: string;
}

interface Risk {
  description: string;
  severity: string;
}

interface RealizationReport {
  kpis: KPIVariance[];
  milestones: Milestone[];
  risks: Risk[];
  overall_realization_rate: number | null;
  recommendations: string[];
  report_date: string;
}

function getKPIStatus(kpi: KPIVariance): { label: string; color: string } {
  if (kpi.direction === "on_target" || Math.abs(kpi.variance_percentage) < 5) {
    return { label: "On Track", color: "bg-green-100 text-green-700" };
  }
  if (kpi.direction === "over") {
    return { label: "Exceeding", color: "bg-blue-100 text-blue-700" };
  }
  return { label: "At Risk", color: "bg-red-100 text-red-700" };
}

function getMilestoneColor(status: string): string {
  switch (status) {
    case "completed": return "bg-green-100 text-green-700";
    case "in_progress": return "bg-blue-100 text-blue-700";
    case "at_risk": return "bg-red-100 text-red-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

function getRiskColor(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-100 text-red-700";
    case "high": return "bg-orange-100 text-orange-700";
    case "medium": return "bg-yellow-100 text-yellow-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

interface RealizationDashboardProps {
  caseId: string;
}

export const RealizationDashboard: React.FC<RealizationDashboardProps> = ({ caseId }) => {
  const [report, setReport] = useState<RealizationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;

    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<RealizationReport>(
          `/api/cases/${caseId}/realization`,
        );
        if (cancelled) return;
        if (!response.success || !response.data) {
          if ((response as { status?: number }).status === 404) {
            setReport(null);
          } else {
            setError(response.error ?? "Failed to load realization data");
          }
        } else {
          setReport(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load realization data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchReport();
    return () => { cancelled = true; };
  }, [caseId]);

  if (loading) {
    return (
      <Card className="p-6 mt-6">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full" />
          Loading realization data…
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 mt-6">
        <p className="text-sm text-red-500">Failed to load realization data: {error}</p>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="p-6 mt-6">
        <h3 className="text-lg font-semibold mb-2">Value Realization</h3>
        <p className="text-sm text-slate-500">
          No realization report available yet. Reports are generated after the value lifecycle
          completes and post-sale tracking begins.
        </p>
      </Card>
    );
  }

  const chartData = report.kpis.map((kpi) => ({
    name: kpi.name,
    committed: kpi.committed_value,
    realized: kpi.realized_value,
  }));

  return (
    <Card className="p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Value Realization &amp; Variance Analysis</h3>
        {report.overall_realization_rate !== null && (
          <span className="text-sm font-medium text-slate-600">
            Overall:{" "}
            <span
              className={
                report.overall_realization_rate >= 90
                  ? "text-green-600"
                  : report.overall_realization_rate >= 70
                    ? "text-yellow-600"
                    : "text-red-600"
              }
            >
              {report.overall_realization_rate.toFixed(1)}%
            </span>
          </span>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="h-[300px] w-full mb-8">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="committed" fill="#9AA6B2" name="Committed" />
              <Bar dataKey="realized" fill="#08A0A0" name="Realized" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {report.kpis.length > 0 && (
        <div className="space-y-4 mb-6">
          <Label>KPI Performance</Label>
          <div className="grid grid-cols-1 gap-2">
            {report.kpis.map((kpi, i) => {
              const status = getKPIStatus(kpi);
              return (
                <div
                  key={i}
                  className="flex justify-between items-center p-3 border rounded-lg bg-muted/20"
                >
                  <div>
                    <p className="font-medium">{kpi.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Realized: {kpi.realized_value.toLocaleString()} {kpi.unit} vs Committed:{" "}
                      {kpi.committed_value.toLocaleString()} {kpi.unit}
                      {" · "}
                      <span
                        className={
                          kpi.direction === "over"
                            ? "text-blue-600"
                            : kpi.direction === "under"
                              ? "text-red-600"
                              : "text-green-600"
                        }
                      >
                        {kpi.variance_percentage > 0 ? "+" : ""}
                        {kpi.variance_percentage.toFixed(1)}%
                      </span>
                    </p>
                  </div>
                  <Badge className={status.color}>{status.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {report.milestones.length > 0 && (
        <div className="space-y-2 mb-6">
          <Label>Milestones</Label>
          <div className="grid grid-cols-1 gap-2">
            {report.milestones.map((m, i) => (
              <div
                key={i}
                className="flex justify-between items-center p-3 border rounded-lg bg-muted/20"
              >
                <div>
                  <p className="font-medium text-sm">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Due: {new Date(m.due_date).toLocaleDateString()}
                  </p>
                </div>
                <Badge className={getMilestoneColor(m.status)}>{m.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.risks.length > 0 && (
        <div className="space-y-2 mb-6">
          <Label>Risks</Label>
          <div className="grid grid-cols-1 gap-2">
            {report.risks.map((r, i) => (
              <div
                key={i}
                className="flex justify-between items-center p-3 border rounded-lg bg-muted/20"
              >
                <p className="text-sm text-slate-700">{r.description}</p>
                <Badge className={getRiskColor(r.severity)}>{r.severity}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.recommendations.length > 0 && (
        <div className="space-y-2">
          <Label>Recommendations</Label>
          <ul className="space-y-1">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                <span className="text-primary mt-0.5">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4">
        Report generated: {new Date(report.report_date).toLocaleString()}
      </p>
    </Card>
  );
};
