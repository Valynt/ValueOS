import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  DollarSign,
  Edit3,
  Loader2,
  Minus,
  Plus,
  TrendingUp,
  X,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { useModelSnapshot, useRunFinancialModelingAgent } from "@/hooks/useModelSnapshot";
import type { ModelSnapshot } from "@/hooks/useModelSnapshot";
import { useRunTargetAgent, useUpsertValueTreeNode, useValueTree } from "@/hooks/useValueTree";
import type { ValueTreeNode } from "@/hooks/useValueTree";
import { cn } from "@/lib/utils";
import { EditableField } from '@/components/ui/EditableField';

// Inline-editable number
function EditableNumber({
  value,
  onSave,
  prefix = "",
  suffix = "",
}: {
  value: string;
  onSave: (v: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        {prefix && <span className="text-[12px] text-zinc-400">{prefix}</span>}
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onSave(draft); setEditing(false); }
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          className="w-24 bg-white border border-zinc-300 rounded-lg px-2 py-1 text-[13px] font-bold outline-none focus:border-violet-500"
        />
        {suffix && <span className="text-[12px] text-zinc-400">{suffix}</span>}
        <button onClick={() => { onSave(draft); setEditing(false); }} className="p-0.5 rounded hover:bg-zinc-100">
          <Check className="w-3 h-3 text-emerald-600" />
        </button>
        <button onClick={() => { setDraft(value); setEditing(false); }} className="p-0.5 rounded hover:bg-zinc-100">
          <X className="w-3 h-3 text-zinc-400" />
        </button>
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:bg-violet-50 rounded px-1 -mx-1 transition-colors group/edit inline-flex items-center gap-1"
    >
      {prefix}{value}{suffix}
      <Edit3 className="w-3 h-3 text-zinc-300 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
    </span>
  );
}

export function ModelStage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { data: nodes = [], isLoading, isError } = useValueTree(caseId);
  const { data: snapshot } = useModelSnapshot(caseId);
  const upsertNode = useUpsertValueTreeNode(caseId);
  const runTarget = useRunTargetAgent(caseId);
  const runFinancial = useRunFinancialModelingAgent(caseId);

  // Partition nodes by type for display
  const driverNodes = nodes.filter((n) => n.node_type === "driver" || n.node_type === "root");
  const assumptionNodes = nodes.filter((n) => n.node_type === "assumption");

  // Compute total value from root/driver nodes
  const totalValue = driverNodes.reduce((sum, n) => sum + (n.value ?? 0), 0);
  const totalValueDisplay = totalValue > 0
    ? `$${(totalValue / 1_000_000).toFixed(1)}M`
    : "—";

  const handleSaveNodeValue = (node: ValueTreeNode, rawValue: string) => {
    const parsed = parseFloat(rawValue.replace(/[^0-9.-]/g, ""));
    if (isNaN(parsed)) return;
    upsertNode.mutate({ id: node.id, value: parsed });
  };

  const handleSaveNodeLabel = (node: ValueTreeNode, label: string) => {
    upsertNode.mutate({ id: node.id, label });
  };

  const formatNodeValue = (node: ValueTreeNode): string => {
    if (node.value === null) return "—";
    const unit = node.unit ?? "";
    if (unit === "usd" || unit === "$" || !unit) {
      return node.value >= 1_000_000
        ? `$${(node.value / 1_000_000).toFixed(1)}M`
        : node.value >= 1_000
        ? `$${(node.value / 1_000).toFixed(0)}K`
        : `$${node.value}`;
    }
    return `${node.value}${unit}`;
  };

  const confidenceFromMeta = (node: ValueTreeNode): number => {
    const c = node.metadata?.confidence;
    return typeof c === "number" ? c : 75;
  };

  return (
    <div className="space-y-5">
      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-[13px]">Loading value tree…</span>
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-[13px] text-red-700">
          Failed to load value tree data.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && nodes.length === 0 && (
        <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-2xl p-8 text-center">
          <BarChart3 className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-zinc-600">No value tree yet</p>
          <p className="text-[12px] text-zinc-400 mt-1 mb-4">
            Run the Target agent to generate KPI targets and the value driver tree.
          </p>
          <button
            onClick={() => runTarget.mutate({})}
            disabled={runTarget.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-[13px] font-medium rounded-xl transition-colors"
          >
            {runTarget.isPending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</>
              : <><Plus className="w-3.5 h-3.5" /> Run Target Agent</>
            }
          </button>
          {runTarget.isError && (
            <p className="text-[12px] text-red-600 mt-2">{runTarget.error?.message}</p>
          )}
        </div>
      )}

      {/* Value tree */}
      {driverNodes.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-600" />
              <h4 className="text-[13px] font-semibold text-zinc-900">Value Architecture</h4>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => runTarget.mutate({})}
                disabled={runTarget.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-60 text-zinc-700 text-[12px] font-medium rounded-lg transition-colors"
              >
                {runTarget.isPending
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Running…</>
                  : <><Minus className="w-3 h-3" /> Re-run Target</>
                }
              </button>
              <span className="text-[11px] text-zinc-400">Total Projected Value</span>
              <span className="text-xl font-black text-zinc-950 tracking-tight">{totalValueDisplay}</span>
            </div>
          </div>

          <div className="space-y-3">
            {driverNodes.map((node) => {
              const confidence = confidenceFromMeta(node);
              const children = nodes.filter((n) => n.parent_id === node.id);

              return (
                <div key={node.id} className="p-4 border border-zinc-100 rounded-xl hover:border-zinc-200 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <EditableField focusColor="focus:border-violet-500"
                        value={node.label}
                        onSave={(v) => handleSaveNodeLabel(node, v)}
                        className="text-[13px] font-medium text-zinc-900"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              confidence >= 80 ? "bg-emerald-500" : confidence >= 60 ? "bg-amber-500" : "bg-red-400"
                            )}
                            style={{ width: `${confidence}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500">{confidence}%</span>
                      </div>
                      <span className="text-[14px] font-black text-zinc-950 tracking-tight">
                        <EditableNumber
                          value={formatNodeValue(node)}
                          onSave={(v) => handleSaveNodeValue(node, v)}
                        />
                      </span>
                    </div>
                  </div>

                  {/* Child nodes */}
                  {children.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {children.map((ch) => (
                        <div key={ch.id} className="p-2.5 bg-zinc-50 rounded-lg">
                          <p className="text-[11px] text-zinc-500 mb-0.5">{ch.label}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-zinc-800">
                              <EditableNumber
                                value={formatNodeValue(ch)}
                                onSave={(v) => handleSaveNodeValue(ch, v)}
                              />
                            </span>
                            <span className={cn(
                              "text-[10px] font-medium",
                              confidenceFromMeta(ch) >= 80 ? "text-emerald-600"
                                : confidenceFromMeta(ch) >= 60 ? "text-amber-600"
                                : "text-red-500"
                            )}>
                              {confidenceFromMeta(ch)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Financial model snapshot */}
      {snapshot ? (
        <FinancialPanel
          snapshot={snapshot}
          onRerun={() => runFinancial.mutate({})}
          isRunning={runFinancial.isPending}
        />
      ) : !isLoading && nodes.length > 0 && (
        <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-2xl p-6 text-center">
          <DollarSign className="w-7 h-7 text-zinc-300 mx-auto mb-2" />
          <p className="text-[13px] font-medium text-zinc-600 mb-1">No financial model yet</p>
          <p className="text-[12px] text-zinc-400 mb-4">Run the Financial Modeling agent to compute ROI, NPV, and payback.</p>
          <button
            onClick={() => runFinancial.mutate({})}
            disabled={runFinancial.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-[13px] font-medium rounded-xl transition-colors"
          >
            {runFinancial.isPending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</>
              : <><Plus className="w-3.5 h-3.5" /> Run Financial Model</>
            }
          </button>
          {runFinancial.isError && (
            <p className="text-[12px] text-red-600 mt-2">{runFinancial.error?.message}</p>
          )}
        </div>
      )}

      {/* Assumptions */}
      {assumptionNodes.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-violet-600" />
            <h4 className="text-[13px] font-semibold text-zinc-900">Key Assumptions</h4>
            <span className="text-[11px] text-zinc-400 ml-auto">Click values to edit</span>
          </div>
          <div className="space-y-2">
            {assumptionNodes.map((node) => {
              const flagged = node.metadata?.flagged === true;
              const baseline = node.metadata?.baseline as string | undefined;
              const confidence = confidenceFromMeta(node);

              return (
                <div
                  key={node.id}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-xl transition-colors",
                    flagged ? "bg-amber-50/50 border border-amber-200" : "bg-zinc-50 hover:bg-zinc-100"
                  )}
                >
                  {flagged && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                  <span className="text-[13px] text-zinc-700 flex-1">{node.label}</span>
                  {baseline && (
                    <>
                      <span className="text-[12px] text-zinc-400 line-through">{baseline}</span>
                      <ChevronRight className="w-3 h-3 text-zinc-300" />
                    </>
                  )}
                  <span className="text-[12px] font-semibold text-violet-700">
                    <EditableNumber
                      value={formatNodeValue(node)}
                      onSave={(v) => handleSaveNodeValue(node, v)}
                    />
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          confidence >= 80 ? "bg-emerald-500" : confidence >= 60 ? "bg-amber-500" : "bg-red-400"
                        )}
                        style={{ width: `${confidence}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500">{confidence}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FinancialPanel — shows ROI/NPV/payback from the latest model snapshot
// ---------------------------------------------------------------------------

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(decimals)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(decimals)}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function FinancialPanel({
  snapshot,
  onRerun,
  isRunning,
}: {
  snapshot: ModelSnapshot;
  onRerun: () => void;
  isRunning: boolean;
}) {
  const models = snapshot.outputs_json?.models ?? [];
  const summary = snapshot.outputs_json?.portfolio_summary;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-violet-600" />
        <h4 className="text-[13px] font-semibold text-zinc-900">Financial Model</h4>
        <span className="text-[11px] text-zinc-400 ml-auto">v{snapshot.snapshot_version}</span>
        <button
          onClick={onRerun}
          disabled={isRunning}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-60 text-zinc-700 text-[12px] font-medium rounded-lg transition-colors"
        >
          {isRunning
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Running…</>
            : <><Minus className="w-3 h-3" /> Re-run</>
          }
        </button>
      </div>

      {/* Top-line metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 bg-zinc-50 rounded-xl text-center">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">ROI</p>
          <p className="text-[18px] font-black text-zinc-950 tracking-tight">
            {fmtPct(snapshot.roi)}
          </p>
        </div>
        <div className="p-3 bg-zinc-50 rounded-xl text-center">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">NPV</p>
          <p className={cn(
            "text-[18px] font-black tracking-tight",
            (snapshot.npv ?? 0) >= 0 ? "text-emerald-700" : "text-red-600"
          )}>
            {fmt(snapshot.npv)}
          </p>
        </div>
        <div className="p-3 bg-zinc-50 rounded-xl text-center">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">Payback</p>
          <p className="text-[18px] font-black text-zinc-950 tracking-tight">
            {snapshot.payback_period_months != null
              ? `${snapshot.payback_period_months}mo`
              : "—"}
          </p>
        </div>
      </div>

      {/* Per-model breakdown */}
      {models.length > 0 && (
        <div className="space-y-2">
          {models.map((m) => (
            <div key={m.hypothesis_id} className="flex items-center gap-3 p-2.5 bg-zinc-50 rounded-xl">
              <span className="text-[11px] text-zinc-500 flex-1 truncate capitalize">
                {m.category.replace(/_/g, " ")}
              </span>
              <span className={cn(
                "text-[12px] font-bold",
                m.npv >= 0 ? "text-emerald-700" : "text-red-600"
              )}>
                {fmt(m.npv)}
              </span>
              <span className="text-[11px] text-zinc-400 w-10 text-right">
                {Math.round(m.confidence * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Portfolio summary */}
      {summary && (
        <p className="text-[12px] text-zinc-500 mt-3 leading-relaxed">{summary}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditableField (label editing)
// ---------------------------------------------------------------------------

