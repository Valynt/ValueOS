import React, { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Local type — mirrors ReasoningTrace from @valueos/shared.
// Defined inline to avoid adding a cross-package dependency.
// ---------------------------------------------------------------------------

export interface ReasoningTrace {
  id: string;
  organization_id: string;
  session_id: string;
  value_case_id: string;
  opportunity_id: string | null;
  agent_name: string;
  agent_version: string;
  trace_id: string;
  inputs: Record<string, unknown>;
  transformations: string[];
  assumptions: string[];
  confidence_breakdown: Record<string, number>;
  evidence_links: string[];
  grounding_score: number | null;
  latency_ms: number | null;
  token_usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  } | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReasoningTracePanelProps {
  /** ID of the reasoning trace to fetch. Used when `trace` is not pre-loaded. */
  trace_id?: string;
  /** Pre-loaded trace — skips the fetch when provided. */
  trace?: ReasoningTrace;
  /**
   * Optional fetch override for environments that use Bearer token auth.
   * Receives the trace_id and an AbortSignal; must resolve to a ReasoningTrace.
   * When omitted, falls back to a bare fetch with credentials: 'include'
   * (suitable for cookie-based auth in browser contexts).
   */
  fetchTrace?: (traceId: string, signal: AbortSignal) => Promise<ReasoningTrace>;
  /** Called when the panel's close button is clicked. */
  onClose?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Confidence bar helpers
// ---------------------------------------------------------------------------

function confidenceColor(score: number): string {
  if (score > 0.8) return "bg-green-500";
  if (score >= 0.5) return "bg-yellow-400";
  return "bg-red-500";
}

function confidenceLabel(score: number): string {
  if (score > 0.8) return "High";
  if (score >= 0.5) return "Moderate";
  return "Low";
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function Section({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <span className="text-sm font-medium">
          {title}
          {count !== undefined && (
            <span className="ml-1.5 text-xs text-muted-foreground">({count})</span>
          )}
        </span>
        <span className="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence tier badge
// ---------------------------------------------------------------------------

const TIER_BADGE: Record<string, string> = {
  silver: "bg-zinc-100 text-zinc-700 border-zinc-200",
  gold: "bg-yellow-50 text-yellow-700 border-yellow-200",
  platinum: "bg-blue-50 text-blue-700 border-blue-200",
};

function EvidenceTierBadge({ tier }: { tier: string }) {
  const cls = TIER_BADGE[tier] ?? "bg-zinc-100 text-zinc-600 border-zinc-200";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {tier}
    </span>
  );
}

function extractTierFromUrl(url: string): string | null {
  // Heuristic: URLs may encode tier as a query param ?tier=gold or path segment /gold/
  const match = url.match(/[?&/]tier[=/](silver|gold|platinum)/i);
  // match[1] is guaranteed by the capture group when match is non-null
  return match ? (match[1] as string).toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ReasoningTracePanel
 *
 * Displays the 5 reasoning trace sections for an agent invocation:
 * Inputs, Transformations, Assumptions, Confidence Breakdown, Evidence Links.
 *
 * Accepts either a pre-loaded `trace` or a `trace_id` to fetch from the API.
 * Sprint 52.
 */
export function ReasoningTracePanel({
  trace_id,
  trace: traceProp,
  fetchTrace,
  onClose,
  className = "",
}: ReasoningTracePanelProps) {
  const [trace, setTrace] = useState<ReasoningTrace | null>(traceProp ?? null);
  const [loading, setLoading] = useState(!traceProp && !!trace_id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (traceProp) {
      setTrace(traceProp);
      setLoading(false);
      return;
    }
    if (!trace_id) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const doFetch = fetchTrace
      ? fetchTrace(trace_id, controller.signal)
      : fetch(`/api/v1/reasoning-traces/${trace_id}`, {
          credentials: "include",
          signal: controller.signal,
        })
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json() as Promise<{ data: ReasoningTrace }>;
          })
          .then(({ data }) => data);

    doFetch
      .then((data) => {
        if (!controller.signal.aborted) {
          setTrace(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        // AbortError is expected on unmount — do not surface as an error.
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load trace");
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [trace_id, traceProp, fetchTrace]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 text-sm text-muted-foreground ${className}`}>
        Loading reasoning trace…
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div className={`flex items-center justify-center py-8 text-sm text-red-500 ${className}`}>
        {error ?? "Reasoning trace not available"}
      </div>
    );
  }

  const inputEntries: [string, unknown][] = Object.entries(trace.inputs);
  const confidenceEntries: [string, number][] = Object.entries(trace.confidence_breakdown);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold">{trace.agent_name}</p>
          <p className="text-xs text-muted-foreground">v{trace.agent_version}</p>
        </div>
        <div className="flex items-center gap-2">
          {trace.grounding_score != null && (
            <span className="text-xs text-muted-foreground">
              Grounding: {(trace.grounding_score * 100).toFixed(0)}%
            </span>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded hover:bg-muted transition-colors"
              aria-label="Close reasoning panel"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 1. Inputs */}
      <Section title="Inputs" count={inputEntries.length}>
        {inputEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No inputs recorded</p>
        ) : (
          <dl className="space-y-1">
            {inputEntries.map(([key, value]) => (
              <div key={key} className="flex gap-2 text-xs">
                <dt className="font-medium text-muted-foreground min-w-[120px] shrink-0">{key}</dt>
                <dd className="text-foreground break-all">
                  {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      {/* 2. Transformations */}
      <Section title="Transformations" count={trace.transformations.length}>
        {trace.transformations.length === 0 ? (
          <p className="text-xs text-muted-foreground">No transformations recorded</p>
        ) : (
          <ol className="space-y-1 list-decimal list-inside">
            {trace.transformations.map((t: string, i: number) => (
              <li key={i} className="text-xs text-foreground">
                {t}
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* 3. Assumptions */}
      <Section title="Assumptions" count={trace.assumptions.length}>
        {trace.assumptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No assumptions recorded</p>
        ) : (
          <ul className="space-y-1">
            {trace.assumptions.map((a: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
                {a}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 4. Confidence Breakdown */}
      <Section title="Confidence Breakdown" count={confidenceEntries.length}>
        {confidenceEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No confidence breakdown recorded</p>
        ) : (
          <div className="space-y-2">
            {confidenceEntries.map(([label, score]) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {(score * 100).toFixed(0)}% — {confidenceLabel(score)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${confidenceColor(score)}`}
                    style={{ width: `${Math.round(score * 100)}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(score * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={label}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 5. Evidence Links */}
      <Section title="Evidence Links" count={trace.evidence_links.length}>
        {trace.evidence_links.length === 0 ? (
          <p className="text-xs text-muted-foreground">No evidence links recorded</p>
        ) : (
          <ul className="space-y-1.5">
            {trace.evidence_links.map((url: string, i: number) => {
              const tier = extractTierFromUrl(url);
              return (
                <li key={i} className="flex items-center gap-2 text-xs">
                  {tier && <EvidenceTierBadge tier={tier} />}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {url}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
