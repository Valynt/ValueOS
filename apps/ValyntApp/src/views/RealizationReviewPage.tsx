/**
 * RealizationReviewPage
 *
 * Executive review surface for post-sale realization tracking.
 * Provides trust signals, confidence breakdowns, and actuals review workflow.
 * Route: /review/:caseId/actuals
 *
 * Phase 5.3: Realization Tracker (Full Implementation)
 */

import { AlertCircle, ArrowLeft, BarChart3, CheckCircle2, Clock, Download, FileText, RefreshCw, TrendingUp } from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useBaseline, useCheckpoints, useRealizationReport } from "@/hooks/useRealization";
import { useActualsTimeline, calculateVarianceStats } from "@/hooks/queries/useActualsTimeline";
import { useExpansionSignals } from "@/hooks/queries/useExpansionSignals";
import { useRealizationFeedback } from "@/hooks/useRealizationFeedback";
import { deriveWarmth } from "@shared/domain/Warmth";

import type { CheckpointStatus } from "@/types/checkpoint";

// Chart component for timeline visualization
function TimelineChart({ data }: { data: Array<{ date: string; projected: number; actual: number | null; confidenceLower: number; confidenceUpper: number }> }) {
  const maxValue = Math.max(...data.map((d) => Math.max(d.projected, d.actual ?? 0, d.confidenceUpper)));
  const minValue = Math.min(...data.map((d) => Math.min(d.projected, d.actual ?? d.projected, d.confidenceLower)));
  const range = maxValue - minValue || 1;

  return (
    <div className="h-64 relative border rounded-lg p-4 bg-muted/30">
      <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
        {/* Confidence band */}
        <path
          d={`M0,${50 - ((data[0]?.confidenceLower ?? 0) - minValue) / range * 50} ` +
            data.map((d, i) => `L${(i / (data.length - 1)) * 100},${50 - (d.confidenceLower - minValue) / range * 50}`).join(" ") +
            ` L100,${50 - ((data[data.length - 1]?.confidenceUpper ?? 0) - minValue) / range * 50} ` +
            data.reverse().map((d, i) => `L${100 - (i / (data.length - 1)) * 100},${50 - (d.confidenceUpper - minValue) / range * 50}`).join(" ") +
            " Z"
          }
          fill="rgba(59, 130, 246, 0.1)"
          stroke="none"
        />

        {/* Projected line */}
        <polyline
          points={data.map((d, i) => `${(i / (data.length - 1)) * 100},${50 - (d.projected - minValue) / range * 50}`).join(" ")}
          fill="none"
          stroke="#6b7280"
          strokeWidth="0.5"
          strokeDasharray="2 2"
        />

        {/* Actuals line (only for completed points) */}
        <polyline
          points={data.filter((d) => d.actual !== null).map((d, i) => `${(data.indexOf(d) / (data.length - 1)) * 100},${50 - ((d.actual ?? d.projected) - minValue) / range * 50}`).join(" ")}
          fill="none"
          stroke="#10b981"
          strokeWidth="1"
        />

        {/* Data points */}
        {data.filter((d) => d.actual !== null).map((d, i) => (
          <circle
            key={i}
            cx={(data.indexOf(d) / (data.length - 1)) * 100}
            cy={50 - ((d.actual ?? d.projected) - minValue) / range * 50}
            r="1"
            fill="#10b981"
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="absolute top-2 right-2 flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-green-500" />
          <span>Actual</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-gray-400" style={{ borderTop: "1px dashed" }} />
          <span>Projected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500/10" />
          <span>Confidence</span>
        </div>
      </div>
    </div>
  );
}

// KPI Progress Card
function KpiProgressCard({
  name,
  target,
  actual,
  unit,
  checkpointCount,
  completedCount,
}: {
  name: string;
  target: number;
  actual: number | null;
  unit: string;
  checkpointCount: number;
  completedCount: number;
}) {
  const progress = target > 0 ? ((actual ?? 0) / target) * 100 : 0;
  const isOnTrack = progress >= 90;
  const isAtRisk = progress < 75;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium">{name}</CardTitle>
          <Badge variant={isOnTrack ? "default" : isAtRisk ? "destructive" : "secondary"}>
            {isOnTrack ? "On Track" : isAtRisk ? "At Risk" : "Monitoring"}
          </Badge>
        </div>
        <CardDescription>
          {completedCount} of {checkpointCount} checkpoints completed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress.toFixed(1)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-sm pt-2">
            <span className="text-muted-foreground">Target</span>
            <span className="font-medium">{target.toLocaleString()} {unit}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Actual</span>
            <span className={`font-medium ${actual === null ? "text-muted-foreground" : isOnTrack ? "text-green-600" : isAtRisk ? "text-red-600" : "text-amber-600"}`}>
              {actual !== null ? `${actual.toLocaleString()} ${unit}` : "No data"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Expansion Signal Card
function ExpansionSignalCard({
  signal,
}: {
  signal: {
    triggerType: "kpi_exceeded" | "timeline_ahead" | "scope_increase";
    kpis: Array<{ name: string; targetValue: number; actualValue: number; exceedancePercent: number }>;
    suggestedAction: string;
    confidence: "high" | "medium" | "low";
  };
}) {
  return (
    <Card className="border-green-200 bg-green-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Expansion Opportunity
          </CardTitle>
          <Badge variant={signal.confidence === "high" ? "default" : "secondary"}>
            {signal.confidence} confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{signal.suggestedAction}</p>
        <div className="space-y-2">
          {signal.kpis.map((kpi, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>{kpi.name}</span>
              <span className="text-green-600 font-medium">+{kpi.exceedancePercent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Warmth Badge Component
function WarmthBadge({ state, confidence }: { state: string; confidence: number }) {
  const colors: Record<string, string> = {
    verified: "bg-green-100 text-green-800 border-green-300",
    firm: "bg-amber-100 text-amber-800 border-amber-300",
    forming: "bg-blue-100 text-blue-800 border-blue-300",
    at_risk: "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <Badge variant="outline" className={colors[state] ?? colors.forming}>
      <CheckCircle2 className="w-3 h-3 mr-1" />
      {state.charAt(0).toUpperCase() + state.slice(1)} ({(confidence * 100).toFixed(0)}%)
    </Badge>
  );
}

export function RealizationReviewPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState("overview");

  // Data fetching
  const { data: baseline, isLoading: baselineLoading, error: baselineError } = useBaseline(caseId);
  const { data: checkpoints, isLoading: checkpointsLoading } = useCheckpoints(caseId);
  const { data: report, isLoading: reportLoading } = useRealizationReport(caseId);
  const { data: timelineData, isLoading: timelineLoading } = useActualsTimeline(caseId);
  const { data: expansionSignals, isLoading: signalsLoading } = useExpansionSignals(caseId);
  const { applyFeedback, feedbackStats } = useRealizationFeedback(caseId);

  const isLoading = baselineLoading || checkpointsLoading || reportLoading || timelineLoading;
  const error = baselineError;

  // Memoized calculations
  const varianceStats = useMemo(() => {
    if (!timelineData) return null;
    return calculateVarianceStats(timelineData);
  }, [timelineData]);

  const warmthState = useMemo(() => {
    if (!report) return null;
    return deriveWarmth("TRACKING", report.overallConfidence ?? 0.5);
  }, [report]);

  const completedCheckpoints = useMemo(() => {
    return checkpoints?.filter((c: { status: CheckpointStatus }) => c.status === "completed").length ?? 0;
  }, [checkpoints]);

  const handleBack = useCallback(() => {
    navigate(`/workspace/${caseId}/realization`);
  }, [navigate, caseId]);

  const handleExport = useCallback(() => {
    // TODO: Implement CSV export of review data
    console.log("Export review data for case", caseId);
  }, [caseId]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">Review Actuals</h1>
        </div>
        <Alert variant="destructive" className="m-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load review data</AlertTitle>
          <AlertDescription>{error.message || "Unknown error occurred"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!baseline) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">Review Actuals</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>No Baseline Found</CardTitle>
              <CardDescription>
                This case does not have an approved baseline yet. Please approve the case first before reviewing actuals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleBack}>Return to Realization Tracker</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div ref={containerRef} className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Review Actuals</h1>
              <p className="text-sm text-muted-foreground">
                Case: {caseId} • Baseline: {baseline.scenarioName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {warmthState && (
              <WarmthBadge state={warmthState.state} confidence={warmthState.confidence} />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export review data as CSV</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 py-2 border-b bg-card shrink-0">
            <TabsList>
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="expansion" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Expansion
              </TabsTrigger>
              <TabsTrigger value="feedback" className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Feedback
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Overview Tab */}
            <TabsContent value="overview" className="m-0 h-full">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Trust Signals Header */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Overall Confidence</CardDescription>
                      <CardTitle className="text-2xl">
                        {((report?.overallConfidence ?? 0.5) * 100).toFixed(0)}%
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Checkpoints</CardDescription>
                      <CardTitle className="text-2xl">
                        {completedCheckpoints} / {checkpoints?.length ?? 0}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Average Variance</CardDescription>
                      <CardTitle className={`text-2xl ${(varianceStats?.averageVariance ?? 0) > 10 ? "text-amber-600" : "text-green-600"}`}>
                        {varianceStats?.averageVariance.toFixed(1) ?? "--"}%
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Last Updated</CardDescription>
                      <CardTitle className="text-lg">
                        {report?.generatedAt ? new Date(report.generatedAt).toLocaleDateString() : "--"}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {/* KPI Progress */}
                <div>
                  <h2 className="text-lg font-semibold mb-4">KPI Progress</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {baseline.kpiTargets?.map((kpi: { name: string; target: number; unit: string }, index: number) => {
                      const checkpoint = checkpoints?.filter((c: { kpiName: string; status: CheckpointStatus }) => c.kpiName === kpi.name);
                      const latest = checkpoint?.slice(-1)[0];
                      return (
                        <KpiProgressCard
                          key={index}
                          name={kpi.name}
                          target={kpi.target}
                          actual={latest?.actualValue ?? null}
                          unit={kpi.unit}
                          checkpointCount={checkpoint?.length ?? 0}
                          completedCount={checkpoint?.filter((c: { status: CheckpointStatus }) => c.status === "completed").length ?? 0}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Risk Summary */}
                {report?.risks && report.risks.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-4">Active Risks</h2>
                    <div className="space-y-2">
                      {report.risks.map((risk: { id: string; description: string; severity: string }, index: number) => (
                        <Alert key={risk.id} variant={risk.severity === "high" ? "destructive" : "default"}>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>{risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1)} Risk</AlertTitle>
                          <AlertDescription>{risk.description}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="m-0 h-full">
              <div className="max-w-6xl mx-auto space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Actuals vs Projections</CardTitle>
                    <CardDescription>
                      Compare actual measurements against projected values over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {timelineData && timelineData.length > 0 ? (
                      <TimelineChart data={timelineData} />
                    ) : (
                      <div className="h-64 flex items-center justify-center text-muted-foreground">
                        No timeline data available
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Checkpoint Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Checkpoint History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium">Date</th>
                            <th className="text-left py-2 font-medium">KPI</th>
                            <th className="text-right py-2 font-medium">Projected</th>
                            <th className="text-right py-2 font-medium">Actual</th>
                            <th className="text-right py-2 font-medium">Variance</th>
                            <th className="text-center py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {checkpoints?.map((checkpoint: { id: string; date: string; kpiName: string; targetValue: number; actualValue: number | null; status: CheckpointStatus }, index: number) => {
                            const variance = checkpoint.actualValue !== null
                              ? ((checkpoint.actualValue - checkpoint.targetValue) / checkpoint.targetValue) * 100
                              : null;
                            return (
                              <tr key={checkpoint.id} className="border-b last:border-0">
                                <td className="py-2">{new Date(checkpoint.date).toLocaleDateString()}</td>
                                <td className="py-2">{checkpoint.kpiName}</td>
                                <td className="py-2 text-right">{checkpoint.targetValue.toLocaleString()}</td>
                                <td className="py-2 text-right">
                                  {checkpoint.actualValue?.toLocaleString() ?? "--"}
                                </td>
                                <td className={`py-2 text-right ${variance !== null ? (variance > 0 ? "text-green-600" : variance < -10 ? "text-red-600" : "text-amber-600") : ""}`}>
                                  {variance !== null ? `${variance > 0 ? "+" : ""}${variance.toFixed(1)}%` : "--"}
                                </td>
                                <td className="py-2 text-center">
                                  <Badge variant={checkpoint.status === "completed" ? "default" : checkpoint.status === "at_risk" ? "destructive" : "secondary"}>
                                    {checkpoint.status}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Expansion Tab */}
            <TabsContent value="expansion" className="m-0 h-full">
              <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Expansion Opportunities</h2>
                    <p className="text-sm text-muted-foreground">
                      Signals detected when KPIs consistently exceed targets
                    </p>
                  </div>
                </div>

                {signalsLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : expansionSignals && expansionSignals.length > 0 ? (
                  <div className="space-y-4">
                    {expansionSignals.map((signal, index) => (
                      <ExpansionSignalCard key={index} signal={signal} />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted" />
                      <p>No expansion signals detected yet.</p>
                      <p className="text-sm mt-2">
                        Signals appear when at least 2 KPIs exceed their targets for 2+ consecutive checkpoints.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Feedback Tab */}
            <TabsContent value="feedback" className="m-0 h-full">
              <div className="max-w-6xl mx-auto space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Realization Feedback Loop</CardTitle>
                    <CardDescription>
                      Apply actuals data back to the value model to update confidence scores
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {feedbackStats ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 border rounded-lg">
                            <p className="text-sm text-muted-foreground">Nodes Analyzed</p>
                            <p className="text-2xl font-semibold">{feedbackStats.totalNodes}</p>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <p className="text-sm text-muted-foreground">With Actuals</p>
                            <p className="text-2xl font-semibold">{feedbackStats.nodesWithActuals}</p>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <p className="text-sm text-muted-foreground">Average Accuracy</p>
                            <p className="text-2xl font-semibold">{(feedbackStats.averageAccuracy * 100).toFixed(1)}%</p>
                          </div>
                        </div>
                        <Alert>
                          <FileText className="h-4 w-4" />
                          <AlertTitle>Feedback Applied</AlertTitle>
                          <AlertDescription>
                            Node confidence scores have been updated based on actuals accuracy.
                            High accuracy (&gt;95%) increases confidence, low accuracy (&lt;70%) decreases it.
                          </AlertDescription>
                        </Alert>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <RefreshCw className="w-12 h-12 mx-auto mb-4" />
                        <p>No feedback data available yet.</p>
                        <p className="text-sm mt-2">
                          Checkpoint measurements will automatically feed back into model confidence.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

export default RealizationReviewPage;
