/**
 * SDUI Component: ValueSummaryCard
 *
 * Displays ROI metrics with CFO-defensible evidence links.
 *
 * SDUI Contract (TransformedArtifact):
 * - props: Value metrics with evidence-backed numeric values
 * - _lineage: trace_id, source_agent, grounding_score for audit trail
 * - _indicator: visual state from artifact transformation
 *
 * Pattern 4 Compliance:
 * - All numeric outputs require EvidenceLink
 * - Missing evidence triggers CFO warning
 * - Trace panel shows reasoning lineage
 */

import { BarChart3, Info, TrendingUp, Users } from "lucide-react";
import React, { useState } from "react";

import type { EvidenceLink } from "@shared/types/evidence";

// SDUI lineage metadata passed by JourneyOrchestrator
interface TransformationLineage {
  source_agent: string;
  trace_id: string | null;
  produced_at: string;
  grounding_score: number | null;
  source_ids: string[];
}

export interface ValueSummaryCardProps {
  /** Primary display title */
  title?: string;
  /** Current workflow status (from saga state) */
  status?: string;
  /** Projected ROI percentage - MUST have evidence link */
  roi?: number;
  /** Annual value in USD - MUST have evidence link */
  annualValue?: number;
  /** Number of stakeholders - MUST have evidence link */
  stakeholders?: number;
  /** Evidence links for all numeric values (required for CFO-defensibility) */
  evidenceLinks?: EvidenceLink[];
  /** Placeholder state when values not yet validated */
  validationState?: "validated" | "pending" | "awaiting_evidence" | "placeholder";
  /** Lineage metadata injected by JourneyOrchestrator */
  _lineage?: TransformationLineage;
  /** Visual indicator state from artifact transformation */
  _indicator?: "idle" | "progress" | "success" | "warning" | "error";
  /** Callback when user requests evidence drilldown */
  onEvidenceClick?: (link: EvidenceLink) => void;
}

interface MetricItem {
  key: "roi" | "annualValue" | "stakeholders";
  value: number | undefined;
  evidence?: EvidenceLink;
}

export const ValueSummaryCard: React.FC<ValueSummaryCardProps> = (props) => {
  const {
    title = "Value Summary",
    status = "In Progress",
    roi,
    annualValue,
    stakeholders,
    evidenceLinks = [],
    validationState = roi === undefined || annualValue === undefined ? "awaiting_evidence" : "validated",
    _lineage,
    _indicator = "idle",
    onEvidenceClick,
  } = props;

  const [showTrace, setShowTrace] = useState(false);

  // Build metric items with evidence lookup
  const metrics: MetricItem[] = [
    { key: "roi", value: roi, evidence: findEvidenceForPath(evidenceLinks, "roi") },
    { key: "annualValue", value: annualValue, evidence: findEvidenceForPath(evidenceLinks, "annualValue") },
    { key: "stakeholders", value: stakeholders, evidence: findEvidenceForPath(evidenceLinks, "stakeholders") },
  ];

  // CFO-defensibility: Check if any numeric value lacks evidence
  const missingEvidence = metrics.filter(m => m.value !== undefined && !m.evidence);
  const hasMissingEvidence = missingEvidence.length > 0;

  const formatCurrency = (value: number | undefined): string => {
    if (value === undefined || value === null) return "—";
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  // Render placeholder state when awaiting evidence
  const renderPlaceholder = () => (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <Info className="mb-2 h-8 w-8 opacity-50" />
      <p className="text-sm">{getPlaceholderMessage(validationState)}</p>
      {_lineage?.trace_id && (
        <p className="mt-1 text-xs opacity-60">Trace: {_lineage.trace_id.slice(0, 8)}…</p>
      )}
    </div>
  );

  // Indicator color based on artifact state
  const indicatorClass = _indicator === "error" || hasMissingEvidence
    ? "border-l-4 border-l-amber-500"
    : _indicator === "success"
      ? "border-l-4 border-l-emerald-500"
      : "";

  return (
    <div className={`rounded-xl border border-border bg-card p-6 shadow-sm ${indicatorClass}`}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{title}</h2>
          {_lineage?.trace_id && (
            <button
              onClick={() => setShowTrace(!showTrace)}
              className="rounded p-1 hover:bg-muted"
              title={`Trace: ${_lineage.trace_id} | Agent: ${_lineage.source_agent}`}
              aria-label="View reasoning trace"
            >
              <Info className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {status}
        </span>
      </div>

      {/* Trace Panel (collapsible) */}
      {showTrace && _lineage && (
        <div className="mb-4 rounded-lg bg-muted p-3 text-xs">
          <p><strong>Source Agent:</strong> {_lineage.source_agent}</p>
          <p><strong>Trace ID:</strong> {_lineage.trace_id}</p>
          <p><strong>Grounding Score:</strong> {_lineage.grounding_score ?? "N/A"}</p>
          <p><strong>Produced:</strong> {new Date(_lineage.produced_at).toLocaleString()}</p>
        </div>
      )}

      {/* Missing Evidence Warning */}
      {hasMissingEvidence && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <strong>CFO Warning:</strong> {missingEvidence.length} numeric value(s) lack evidence links:
          {missingEvidence.map(m => ` ${m.key}`).join(", ")}
        </div>
      )}

      {/* Metrics Grid */}
      {validationState === "awaiting_evidence" || validationState === "placeholder" ? (
        renderPlaceholder()
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Projected ROI"
            value={roi !== undefined ? `${roi}%` : "—"}
            evidence={metrics[0]?.evidence}
            highlight
            onEvidenceClick={onEvidenceClick}
          />
          <MetricCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Annual Value"
            value={formatCurrency(annualValue)}
            evidence={metrics[1]?.evidence}
            onEvidenceClick={onEvidenceClick}
          />
          <MetricCard
            icon={<Users className="h-4 w-4" />}
            label="Stakeholders"
            value={stakeholders !== undefined ? String(stakeholders) : "—"}
            evidence={metrics[2]?.evidence}
            onEvidenceClick={onEvidenceClick}
          />
        </div>
      )}
    </div>
  );
};

ValueSummaryCard.displayName = "ValueSummaryCard";

/** Find evidence link for a given JSON path */
function findEvidenceForPath(links: EvidenceLink[], path: string): EvidenceLink | undefined {
  return links.find(l => l.path === path || l.path.endsWith(`.${path}`));
}

/** Get appropriate placeholder message based on validation state */
function getPlaceholderMessage(state: ValueSummaryCardProps["validationState"]): string {
  switch (state) {
    case "awaiting_evidence":
      return "Awaiting evidence-backed validation";
    case "pending":
      return "Validation in progress";
    case "placeholder":
      return "Not yet calculated";
    default:
      return "No data available";
  }
}

// ============================================================================
// Metric Card Sub-component with Evidence Link Support
// ============================================================================

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  evidence?: EvidenceLink;
  onEvidenceClick?: (link: EvidenceLink) => void;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, highlight, evidence, onEvidenceClick }) => {
  const hasEvidence = !!evidence;

  return (
    <div
      className={`rounded-lg bg-slate-100 p-4 dark:bg-slate-800 ${hasEvidence ? "ring-1 ring-primary/20" : ""}`}
      role="group"
      aria-label={label}
    >
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        {icon}
        <span className="text-sm">{label}</span>
        {hasEvidence && (
          <button
            onClick={() => onEvidenceClick?.(evidence!)}
            className="ml-auto rounded p-0.5 hover:bg-primary/10"
            title={`Evidence: ${evidence.evidence_reference}`}
            aria-label={`View evidence for ${label}`}
          >
            <Info className="h-3.5 w-3.5 text-primary" />
          </button>
        )}
      </div>
      <div
        className={`mt-2 text-2xl font-bold ${highlight ? "text-primary" : ""}`}
        aria-label={`${label}: ${value}`}
      >
        {value}
      </div>
      {hasEvidence && (
        <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={evidence.evidence_reference}>
          {evidence.evidence_reference}
        </div>
      )}
    </div>
  );
};

MetricCard.displayName = "MetricCard";

export default ValueSummaryCard;
