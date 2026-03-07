import {
  AlertTriangle,
  ArrowRight,
  Check,
  Edit3,
  FileSearch,
  Layers,
  Lightbulb,
  Loader2,
  Minus,
  Package,
  Play,
  Plus,
  Sparkles,
  Swords,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { useCompanyValueContext } from "@/contexts/CompanyContextProvider";
import { useHardenAllKPIs, useHardenKPI, useMergedContext } from "@/hooks/useDomainPacks";
import { useHypothesisOutput, useRunHypothesisAgent } from "@/hooks/useHypothesis";
import type { ValueHypothesis } from "@/hooks/useHypothesis";
import { cn } from "@/lib/utils";

// Inline-editable text field
function EditableField({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onSave(draft); setEditing(false); }
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          className={cn("bg-white border border-zinc-300 rounded-lg px-2 py-1 text-[13px] outline-none focus:border-zinc-500", className)}
        />
        <button onClick={() => { onSave(draft); setEditing(false); }} className="p-1 rounded hover:bg-zinc-100">
          <Check className="w-3 h-3 text-emerald-600" />
        </button>
        <button onClick={() => { setDraft(value); setEditing(false); }} className="p-1 rounded hover:bg-zinc-100">
          <X className="w-3 h-3 text-zinc-400" />
        </button>
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={cn("cursor-pointer hover:bg-zinc-100 rounded px-1 -mx-1 transition-colors group/edit inline-flex items-center gap-1", className)}
    >
      {value}
      <Edit3 className="w-3 h-3 text-zinc-300 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
    </span>
  );
}

// Confidence badge
function ConfidenceBadge({ value, source }: { value: number; source: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-10 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            value >= 90 ? "bg-emerald-500" : value >= 75 ? "bg-blue-500" : value >= 50 ? "bg-amber-500" : "bg-red-400"
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-zinc-500">{value}%</span>
      <span className="text-[10px] text-zinc-300">·</span>
      <span className="text-[10px] text-zinc-400">{source}</span>
    </div>
  );
}

// Direction icon for KPI
function DirectionIcon({ direction }: { direction: "up" | "down" | "neutral" }) {
  if (direction === "up") return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (direction === "down") return <TrendingDown className="w-3 h-3 text-blue-500" />;
  return <Minus className="w-3 h-3 text-zinc-400" />;
}

// Ghost KPI card — suggested by domain pack, not yet in the case
function GhostKPICard({
  kpi,
  onAccept,
  isAccepting,
}: {
  kpi: MergedKPI;
  onAccept: () => void;
  isAccepting: boolean;
}) {
  return (
    <div className={cn(
      "bg-white border rounded-xl p-4 transition-all",
      kpi.hardened
        ? "border-zinc-200"
        : "border-dashed border-zinc-300 bg-zinc-50/50 hover:border-zinc-400"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DirectionIcon direction={kpi.direction} />
          <span className="text-[13px] font-semibold text-zinc-900">{kpi.name}</span>
          {kpi.unit && (
            <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-500">{kpi.unit}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {kpi.category && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">
              {kpi.category}
            </span>
          )}
          {kpi.hardened ? (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
              <Check className="w-2.5 h-2.5" />
              Added
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">
              Suggested
            </span>
          )}
        </div>
      </div>

      {kpi.description && (
        <p className="text-[12px] text-zinc-500 mb-2">{kpi.description}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {kpi.baseline_hint && (
            <span className="text-[11px] text-zinc-400 italic">{kpi.baseline_hint}</span>
          )}
          {kpi.target_hint && !kpi.baseline_hint && (
            <span className="text-[11px] text-zinc-400 italic">{kpi.target_hint}</span>
          )}
        </div>

        {!kpi.hardened && (
          <button
            onClick={onAccept}
            disabled={isAccepting}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            Accept
          </button>
        )}
      </div>
    </div>
  );
}

// Domain Pack KPIs section
function DomainPackKPIs() {
  const { caseId } = useParams();
  const { data: merged, isLoading } = useMergedContext(caseId);
  const hardenKPI = useHardenKPI();
  const hardenAll = useHardenAllKPIs();

  if (!caseId || isLoading || !merged?.pack) return null;
  if (merged.kpis.length === 0) return null;

  const ghostCount = merged.kpis.filter(k => !k.hardened).length;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-violet-600" />
          <h4 className="text-[13px] font-semibold text-zinc-900">
            {merged.pack.name} KPIs
          </h4>
          <span className="text-[11px] text-zinc-400">
            {merged.kpis.length} metrics · {ghostCount} suggested
          </span>
        </div>
        {ghostCount > 0 && (
          <button
            onClick={() => hardenAll.mutate({ caseId })}
            disabled={hardenAll.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 text-white rounded-lg text-[11px] font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <ArrowRight className="w-3 h-3" />
            {hardenAll.isPending ? "Adding..." : `Add all ${ghostCount} KPIs`}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {merged.kpis.map((kpi) => (
          <GhostKPICard
            key={kpi.kpi_key}
            kpi={kpi}
            onAccept={() => hardenKPI.mutate({ caseId, kpiKey: kpi.kpi_key })}
            isAccepting={hardenKPI.isPending}
          />
        ))}
      </div>
    </div>
  );
}

// Domain Pack Assumptions section — shows financial defaults with origin labels
function DomainPackAssumptions() {
  const { caseId } = useParams();
  const { data: merged, isLoading } = useMergedContext(caseId);

  if (!caseId || isLoading || !merged?.pack) return null;
  if (merged.assumptions.length === 0) return null;

  const originLabel = (origin: string) => {
    if (origin === "domain_pack") return { text: "Domain Default", color: "bg-violet-50 text-violet-700" };
    if (origin === "manual") return { text: "User Override", color: "bg-emerald-50 text-emerald-700" };
    return { text: "System Default", color: "bg-zinc-100 text-zinc-500" };
  };

  const formatValue = (a: typeof merged.assumptions[0]) => {
    if (a.value_type === "bool") return a.value ? "Yes" : "No";
    if (a.value_type === "number" && a.unit) return `${a.value}${a.unit}`;
    return String(a.value ?? "—");
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-amber-600" />
        <h4 className="text-[13px] font-semibold text-zinc-900">Financial Assumptions</h4>
        <span className="text-[11px] text-zinc-400">{merged.assumptions.length} parameters</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {merged.assumptions.map((a) => {
          const origin = originLabel(a.origin);
          return (
            <div
              key={a.assumption_key}
              className={cn(
                "p-3 rounded-xl border transition-colors",
                a.hardened ? "bg-white border-zinc-200" : "bg-zinc-50/50 border-dashed border-zinc-300"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-zinc-400">{a.display_name}</span>
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-semibold", origin.color)}>
                  {origin.text}
                </span>
              </div>
              <p className="text-lg font-black text-zinc-950 tracking-tight">{formatValue(a)}</p>
              {a.description && (
                <p className="text-[10px] text-zinc-400 mt-0.5">{a.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface HypothesisStageProps {
  /** Called with the jobId when an agent run is started. */
  onRunStarted?: (runId: string) => void;
}

export function HypothesisStage({ onRunStarted }: HypothesisStageProps) {
  const { caseId } = useParams<{ caseId: string }>();
  const { companyContext } = useCompanyValueContext();

  const { data: hypothesisOutput, isLoading, isError } = useHypothesisOutput(caseId);
  const runAgent = useRunHypothesisAgent(caseId);

  const hypotheses: ValueHypothesis[] = hypothesisOutput?.hypotheses ?? [];

  const confidenceToPercent = (c: number) => Math.round(c * 100);

  const handleRunStage = () => {
    const companyName = companyContext?.context.company_name;
    runAgent.mutate(
      { companyName, query: companyName ? `Analyze value opportunities for ${companyName}` : undefined },
      {
        onSuccess: (data) => {
          if (data.runId) onRunStarted?.(data.runId);
        },
      },
    );
  };

  return (
    <div className="space-y-5">
      {/* Hypothesis header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-blue-600" />
          <h4 className="text-[13px] font-semibold text-zinc-900">Hypotheses</h4>
          {!isLoading && (
            <span className="text-[11px] text-zinc-400">{hypotheses.length} claims</span>
          )}
        </div>
        <button
          onClick={handleRunStage}
          disabled={runAgent.isPending || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 text-white rounded-xl text-[12px] font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {runAgent.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          {runAgent.isPending ? "Running…" : hypotheses.length > 0 ? "Re-run Stage" : "Run Stage"}
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-[13px]">Loading hypothesis data…</span>
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-[13px] text-red-700">
          Failed to load hypothesis data. Try running the stage again.
        </div>
      )}

      {/* Agent running state */}
      {runAgent.isPending && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-blue-900">Opportunity Agent running…</p>
            <p className="text-[11px] text-blue-600 mt-0.5">Fetching financial data and generating hypotheses</p>
          </div>
        </div>
      )}

      {/* Agent error */}
      {runAgent.isError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-[13px] text-red-700">
          Agent run failed: {runAgent.error?.message ?? "Unknown error"}
        </div>
      )}

      {/* Empty state — no run yet */}
      {!isLoading && !runAgent.isPending && hypotheses.length === 0 && (
        <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-2xl p-8 text-center">
          <Lightbulb className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-zinc-600">No hypotheses yet</p>
          <p className="text-[12px] text-zinc-400 mt-1">Click "Run Stage" to have the Opportunity Agent generate value hypotheses.</p>
        </div>
      )}

      {/* Hypothesis cards — live data */}
      {hypotheses.length > 0 && (
        <div className="space-y-3">
          {hypotheses.map((h, i) => {
            const confidencePct = confidenceToPercent(h.confidence);
            const status = confidencePct >= 75 ? "verified" : confidencePct >= 50 ? "needs-evidence" : "draft";
            const statusConfig = {
              verified: { label: "Verified", color: "text-emerald-700", bg: "bg-emerald-50", icon: Check },
              "needs-evidence": { label: "Needs Evidence", color: "text-amber-700", bg: "bg-amber-50", icon: AlertTriangle },
              draft: { label: "Draft", color: "text-zinc-500", bg: "bg-zinc-100", icon: Edit3 },
            };
            const st = statusConfig[status];
            const StIcon = st.icon;

            return (
              <div key={`${h.title}-${i}`} className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 transition-colors">
                {/* Status + confidence row */}
                <div className="flex items-center justify-between mb-3">
                  <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", st.color, st.bg)}>
                    <StIcon className="w-3 h-3" />
                    <span>{st.label}</span>
                  </div>
                  <ConfidenceBadge value={confidencePct} source={h.category} />
                </div>

                {/* Title + description */}
                <p className="text-[14px] font-semibold text-zinc-900 mb-1">{h.title}</p>
                <p className="text-[13px] text-zinc-600 leading-relaxed mb-3">{h.description}</p>

                {/* Impact range */}
                {h.estimated_impact && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Impact:</span>
                    <span className="text-[12px] font-medium text-zinc-700">
                      {h.estimated_impact.low}–{h.estimated_impact.high} {h.estimated_impact.unit}
                      {" "}over {h.estimated_impact.timeframe_months}mo
                    </span>
                  </div>
                )}

                {/* Evidence chain */}
                {h.evidence.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Evidence:</span>
                    {h.evidence.map((e) => (
                      <span key={e} className="flex items-center gap-1 px-2 py-0.5 bg-zinc-50 border border-zinc-100 rounded-md text-[10px] text-zinc-600">
                        <FileSearch className="w-2.5 h-2.5" />
                        {e}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Metadata footer when output exists */}
      {hypothesisOutput && (
        <div className="text-[11px] text-zinc-400 text-right">
          Last run: {new Date(hypothesisOutput.created_at).toLocaleString()} · confidence: {hypothesisOutput.confidence ?? "—"}
        </div>
      )}

      {/* Domain Pack KPIs — ghost suggestions from the selected pack */}
      <DomainPackKPIs />

      {/* Domain Pack Assumptions — financial defaults from the selected pack */}
      <DomainPackAssumptions />

      {/* Company intelligence — from CompanyValueContext when available */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-zinc-500" />
          <h4 className="text-[13px] font-semibold text-zinc-900">Company Intelligence</h4>
          <span className={cn(
            "ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold",
            isReady ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
          )}>
            {isReady ? "From onboarding" : "Auto-populated"}
          </span>
        </div>

        {isReady && companyContext ? (
          <>
            {/* Real data from company context */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-zinc-50 rounded-xl">
                <p className="text-[11px] text-zinc-400">Company</p>
                <p className="text-lg font-black text-zinc-950 tracking-tight">{companyContext.context.company_name}</p>
                <p className="text-[11px] font-medium text-zinc-500 capitalize">
                  {companyContext.context.industry || "—"} · {companyContext.context.company_size?.replace("_", " ") || "—"}
                </p>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl">
                <p className="text-[11px] text-zinc-400">Sales Motion</p>
                <p className="text-lg font-black text-zinc-950 tracking-tight capitalize">
                  {companyContext.context.sales_motion?.replace("_", " ") || "—"}
                </p>
                <p className="text-[11px] font-medium text-zinc-500">
                  {companyContext.context.annual_revenue || "Revenue not set"}
                </p>
              </div>
            </div>

            {/* Products from context */}
            {companyContext.products.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Package className="w-3 h-3 text-zinc-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Products</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {companyContext.products.map((p) => (
                    <span key={p.id} className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-[11px] font-medium text-blue-700">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Personas from context */}
            {companyContext.personas.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3 h-3 text-zinc-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Target Personas</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {companyContext.personas.map((p) => (
                    <span key={p.id} className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-[11px] font-medium text-emerald-700">
                      {p.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Competitors from context */}
            {companyContext.competitors.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Swords className="w-3 h-3 text-zinc-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Competitive Landscape</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {companyContext.competitors.map((c) => (
                    <span key={c.id} className="px-3 py-1.5 bg-violet-50 border border-violet-100 rounded-lg text-[11px] font-medium text-violet-700">
                      {c.name}
                      <span className="text-violet-400 ml-1 capitalize">· {c.relationship}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Fallback: mock data when no context */
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Annual Revenue", value: "$2.4B", sub: "+8.2% YoY", conf: 98, subColor: "text-emerald-600" },
              { label: "Employees", value: "12,400", sub: "Manufacturing", conf: 95, subColor: "text-zinc-500" },
              { label: "IT Spend (est.)", value: "$180M", sub: "7.5% of revenue", conf: 82, subColor: "text-zinc-500" },
              { label: "Pain Score", value: "8.4/10", sub: "Legacy migration urgency", conf: 76, subColor: "text-red-500" },
            ].map((m) => (
              <div key={m.label} className="p-3 bg-zinc-50 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] text-zinc-400">{m.label}</p>
                  <ConfidenceBadge value={m.conf} source="" />
                </div>
                <p className="text-lg font-black text-zinc-950 tracking-tight">{m.value}</p>
                <p className={cn("text-[11px] font-medium", m.subColor)}>{m.sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discovery stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Personas Mapped",
            value: isReady ? String(companyContext?.personas.length ?? 0) : "14",
            sub: isReady ? "from onboarding" : "4 decision makers",
          },
          {
            label: "Competitors Identified",
            value: isReady ? String(companyContext?.competitors.length ?? 0) : "6",
            sub: isReady ? "from onboarding" : "2 incumbent",
          },
          {
            label: "Products",
            value: isReady ? String(companyContext?.products.length ?? 0) : "8",
            sub: isReady ? "from onboarding" : "3 high priority",
          },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-zinc-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-zinc-950 tracking-tight">{s.value}</p>
            <p className="text-[11px] font-medium text-zinc-700 mt-1">{s.label}</p>
            <p className="text-[10px] text-zinc-400">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
