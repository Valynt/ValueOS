/**
 * EvidenceFreshnessOverlay Component
 *
 * Displays evidence staleness indicators on the graph canvas.
 * Shows which nodes have stale evidence and when it was last updated.
 *
 * Phase 5.4: Value Graph Polish
 */

import React, { useMemo } from "react";
import { Clock, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { Graph, ValueNode, Evidence } from "@/features/living-value-graph/types/graph.types";

interface EvidenceFreshnessOverlayProps {
  graph: Graph;
  className?: string;
}

interface NodeFreshness {
  nodeId: string;
  nodeName: string;
  freshness: "fresh" | "stale" | "aging" | "none";
  daysSinceUpdate: number | null;
  evidenceCount: number;
  latestEvidence: Evidence | null;
}

/**
 * Calculate days between two dates.
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Determine freshness status based on days since update.
 */
function getFreshnessStatus(days: number | null): NodeFreshness["freshness"] {
  if (days === null) return "none";
  if (days <= 30) return "fresh";
  if (days <= 90) return "aging";
  return "stale";
}

/**
 * Get color class based on freshness status.
 */
function getFreshnessColor(status: NodeFreshness["freshness"]): string {
  switch (status) {
    case "fresh":
      return "bg-green-500";
    case "aging":
      return "bg-amber-500";
    case "stale":
      return "bg-red-500";
    case "none":
      return "bg-gray-300";
  }
}

/**
 * Get icon based on freshness status.
 */
function getFreshnessIcon(status: NodeFreshness["freshness"]) {
  switch (status) {
    case "fresh":
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "aging":
      return <Clock className="w-4 h-4 text-amber-600" />;
    case "stale":
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    case "none":
      return <HelpCircle className="w-4 h-4 text-gray-400" />;
  }
}

/**
 * Calculate freshness for all nodes in the graph.
 */
function calculateFreshness(graph: Graph): NodeFreshness[] {
  const now = new Date().toISOString();

  return Object.values(graph.nodes).map((node) => {
    const evidence = node.evidence ?? [];

    if (evidence.length === 0) {
      return {
        nodeId: node.id,
        nodeName: node.label,
        freshness: "none",
        daysSinceUpdate: null,
        evidenceCount: 0,
        latestEvidence: null,
      };
    }

    // Sort evidence by date (newest first)
    const sortedEvidence = [...evidence].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const latest = sortedEvidence[0];
    const daysSinceUpdate = daysBetween(latest.date, now);
    const freshness = getFreshnessStatus(daysSinceUpdate);

    return {
      nodeId: node.id,
      nodeName: node.label,
      freshness,
      daysSinceUpdate,
      evidenceCount: evidence.length,
      latestEvidence: latest,
    };
  });
}

/**
 * FreshnessIndicator Component
 * Displays a small indicator badge for a single node's freshness.
 */
function FreshnessIndicator({ freshness }: { freshness: NodeFreshness }) {
  const icon = getFreshnessIcon(freshness.freshness);
  const colorClass = getFreshnessColor(freshness.freshness);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-white shadow-sm cursor-pointer",
            colorClass
          )}
        >
          <span className="sr-only">
            Evidence {freshness.freshness}
            {freshness.daysSinceUpdate !== null && ` - ${freshness.daysSinceUpdate} days old`}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium">{freshness.nodeName}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {freshness.freshness === "none" ? (
              <span>No evidence attached</span>
            ) : (
              <>
                <div>Last updated: {freshness.daysSinceUpdate} days ago</div>
                <div>Evidence items: {freshness.evidenceCount}</div>
                {freshness.latestEvidence && (
                  <div className="mt-1 text-xs">
                    Source: {freshness.latestEvidence.source}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * EvidenceFreshnessSummary Component
 * Shows aggregate statistics about evidence freshness.
 */
function FreshnessSummary({ freshnessData }: { freshnessData: NodeFreshness[] }) {
  const stats = useMemo(() => {
    const total = freshnessData.length;
    const withEvidence = freshnessData.filter((f) => f.freshness !== "none").length;
    const fresh = freshnessData.filter((f) => f.freshness === "fresh").length;
    const aging = freshnessData.filter((f) => f.freshness === "aging").length;
    const stale = freshnessData.filter((f) => f.freshness === "stale").length;
    const noEvidence = freshnessData.filter((f) => f.freshness === "none").length;

    return { total, withEvidence, fresh, aging, stale, noEvidence };
  }, [freshnessData]);

  return (
    <div className="p-4 border rounded-lg bg-card">
      <h4 className="font-medium mb-3">Evidence Freshness</h4>
      <div className="grid grid-cols-5 gap-2 text-center">
        <div className="p-2 rounded bg-green-50">
          <div className="text-lg font-semibold text-green-700">{stats.fresh}</div>
          <div className="text-xs text-green-600">Fresh</div>
          <div className="text-xs text-muted-foreground">≤30 days</div>
        </div>
        <div className="p-2 rounded bg-amber-50">
          <div className="text-lg font-semibold text-amber-700">{stats.aging}</div>
          <div className="text-xs text-amber-600">Aging</div>
          <div className="text-xs text-muted-foreground">31-90 days</div>
        </div>
        <div className="p-2 rounded bg-red-50">
          <div className="text-lg font-semibold text-red-700">{stats.stale}</div>
          <div className="text-xs text-red-600">Stale</div>
          <div className="text-xs text-muted-foreground">&gt;90 days</div>
        </div>
        <div className="p-2 rounded bg-gray-50">
          <div className="text-lg font-semibold text-gray-700">{stats.noEvidence}</div>
          <div className="text-xs text-gray-600">No Data</div>
          <div className="text-xs text-muted-foreground">Missing</div>
        </div>
        <div className="p-2 rounded bg-blue-50">
          <div className="text-lg font-semibold text-blue-700">
            {stats.withEvidence > 0
              ? Math.round((stats.fresh / stats.withEvidence) * 100)
              : 0}
            %
          </div>
          <div className="text-xs text-blue-600">Coverage</div>
          <div className="text-xs text-muted-foreground">Fresh rate</div>
        </div>
      </div>
    </div>
  );
}

/**
 * StaleEvidenceList Component
 * Shows a list of nodes with stale evidence that need attention.
 */
function StaleEvidenceList({ freshnessData }: { freshnessData: NodeFreshness[] }) {
  const staleNodes = freshnessData.filter((f) => f.freshness === "stale");

  if (staleNodes.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-green-50 text-center">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-600" />
        <p className="text-sm text-green-800">All evidence is up to date!</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <h4 className="font-medium">Stale Evidence ({staleNodes.length} nodes)</h4>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {staleNodes.map((node) => (
          <div
            key={node.nodeId}
            className="flex items-center justify-between p-2 rounded bg-red-50 text-sm"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="font-medium">{node.nodeName}</span>
            </div>
            <Badge variant="destructive" className="text-xs">
              {node.daysSinceUpdate} days old
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EvidenceFreshnessOverlay({ graph, className }: EvidenceFreshnessOverlayProps) {
  const freshnessData = useMemo(() => calculateFreshness(graph), [graph]);

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        <FreshnessSummary freshnessData={freshnessData} />
        <StaleEvidenceList freshnessData={freshnessData} />
      </div>
    </TooltipProvider>
  );
}

export { FreshnessIndicator, calculateFreshness };
export type { NodeFreshness };
