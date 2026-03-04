/**
 * DataSourcesPanel — Expandable detail panel showing raw API responses
 * and latency metrics for each enrichment data source.
 *
 * Designed to slot into the NewCaseWizard's enrichment "complete" state.
 */
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Copy,
  Check,
  Zap,
} from "lucide-react";

// ── Types (mirror backend SourceDetail) ─────────────────────────────
export interface SourceDetail {
  name: string;
  status: "success" | "partial" | "failed";
  fieldsFound: number;
  latencyMs: number;
  endpoint: string;
  httpStatus: number | null;
  rawResponse: Record<string, unknown> | null;
  error: string | null;
}

interface DataSourcesPanelProps {
  sourceDetails: SourceDetail[];
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function statusIcon(status: SourceDetail["status"]) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    case "partial":
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    case "failed":
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
  }
}

function statusBadge(status: SourceDetail["status"]) {
  const map = {
    success: { label: "Success", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    partial: { label: "Partial", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    failed: { label: "Failed", cls: "bg-red-50 text-red-700 border-red-200" },
  };
  const m = map[status];
  return (
    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 font-semibold", m.cls)}>
      {m.label}
    </Badge>
  );
}

function latencyColor(ms: number) {
  if (ms < 500) return "text-emerald-600";
  if (ms < 1500) return "text-amber-600";
  return "text-red-500";
}

function latencyBarWidth(ms: number, maxMs: number) {
  return `${Math.min((ms / maxMs) * 100, 100)}%`;
}

// ── JSON Viewer ─────────────────────────────────────────────────────

function JsonViewer({ data }: { data: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false);
  const jsonStr = useMemo(() => JSON.stringify(data, null, 2), [data]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  return (
    <div className="relative group">
      <Button
        variant="outline"
        size="sm"
        className="absolute top-2 right-2 h-6 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={handleCopy}
      >
        {copied ? (
          <><Check className="w-3 h-3 mr-1" /> Copied</>
        ) : (
          <><Copy className="w-3 h-3 mr-1" /> Copy</>
        )}
      </Button>
      <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-3 text-[11px] leading-relaxed overflow-x-auto max-h-[280px] overflow-y-auto font-mono">
        {jsonStr}
      </pre>
    </div>
  );
}

// ── Source Card ──────────────────────────────────────────────────────

function SourceCard({
  detail,
  maxLatency,
}: {
  detail: SourceDetail;
  maxLatency: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      expanded ? "border-foreground/15 shadow-sm" : "border-border hover:border-foreground/10",
      detail.status === "failed" && "border-red-200/60"
    )}>
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
      >
        {/* Expand chevron */}
        <div className="flex-shrink-0">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>

        {/* Status icon */}
        {statusIcon(detail.status)}

        {/* Source name */}
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-semibold">{detail.name}</span>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Fields found */}
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {detail.fieldsFound} field{detail.fieldsFound !== 1 ? "s" : ""}
          </span>

          {/* Latency */}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className={cn("text-[10px] font-semibold tabular-nums", latencyColor(detail.latencyMs))}>
              {detail.latencyMs < 1000
                ? `${detail.latencyMs}ms`
                : `${(detail.latencyMs / 1000).toFixed(1)}s`}
            </span>
          </div>

          {/* HTTP status */}
          {detail.httpStatus !== null && (
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0 h-4 font-mono tabular-nums",
                detail.httpStatus >= 200 && detail.httpStatus < 300
                  ? "text-emerald-600 border-emerald-200"
                  : "text-red-500 border-red-200"
              )}
            >
              {detail.httpStatus}
            </Badge>
          )}

          {statusBadge(detail.status)}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-3.5 py-3 space-y-3">
          {/* Latency bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground font-medium">Latency</span>
              <span className={cn("font-semibold tabular-nums", latencyColor(detail.latencyMs))}>
                {detail.latencyMs}ms
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  detail.latencyMs < 500 ? "bg-emerald-500" : detail.latencyMs < 1500 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: latencyBarWidth(detail.latencyMs, maxLatency) }}
              />
            </div>
          </div>

          {/* Endpoint */}
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground font-medium">Endpoint</span>
            <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-2.5 py-1.5">
              <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <code className="text-[10px] font-mono text-foreground break-all">{detail.endpoint}</code>
            </div>
          </div>

          {/* Error message (if any) */}
          {detail.error && (
            <div className="flex items-start gap-2 bg-red-50 rounded-lg px-2.5 py-2 border border-red-100">
              <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-[11px] text-red-700">{detail.error}</span>
            </div>
          )}

          {/* Raw response */}
          {detail.rawResponse && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Code2 className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">Raw API Response</span>
              </div>
              <JsonViewer data={detail.rawResponse} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────

export function DataSourcesPanel({ sourceDetails, className }: DataSourcesPanelProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  const maxLatency = useMemo(
    () => Math.max(...sourceDetails.map((s) => s.latencyMs), 1),
    [sourceDetails]
  );

  const totalLatency = useMemo(
    () => sourceDetails.reduce((sum, s) => sum + s.latencyMs, 0),
    [sourceDetails]
  );

  const successCount = sourceDetails.filter((s) => s.status === "success").length;
  const partialCount = sourceDetails.filter((s) => s.status === "partial").length;
  const failedCount = sourceDetails.filter((s) => s.status === "failed").length;

  return (
    <div className={cn("rounded-xl border border-border overflow-hidden", className)}>
      {/* Toggle header */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <Activity className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-semibold">Data Sources Detail</span>
          <span className="text-[10px] text-muted-foreground ml-2">
            {sourceDetails.length} sources · {successCount} OK
            {partialCount > 0 && ` · ${partialCount} partial`}
            {failedCount > 0 && ` · ${failedCount} failed`}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Zap className="w-3 h-3" />
            <span className="tabular-nums font-medium">
              {totalLatency < 1000
                ? `${totalLatency}ms total`
                : `${(totalLatency / 1000).toFixed(1)}s total`}
            </span>
          </div>
          {panelOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {panelOpen && (
        <div className="px-4 py-3 space-y-2 border-t border-border">
          {/* Waterfall summary */}
          <div className="flex items-center gap-4 mb-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" /> Success: {successCount}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" /> Partial: {partialCount}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" /> Failed: {failedCount}
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Slowest: {maxLatency < 1000 ? `${maxLatency}ms` : `${(maxLatency / 1000).toFixed(1)}s`}
            </span>
          </div>

          {/* Source cards */}
          {sourceDetails.map((detail) => (
            <SourceCard key={detail.name} detail={detail} maxLatency={maxLatency} />
          ))}
        </div>
      )}
    </div>
  );
}
