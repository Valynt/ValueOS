import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  Edit3,
  Loader2,
  Minus,
  Plus,
  TrendingUp,
  X,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { useUpsertValueTreeNode, useValueTree } from "@/hooks/useValueTree";
import type { ValueTreeNode } from "@/hooks/useValueTree";
import { cn } from "@/lib/utils";

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
  const upsertNode = useUpsertValueTreeNode(caseId);

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
          <p className="text-[12px] text-zinc-400 mt-1">
            Run the Hypothesis stage first — the agent will populate the value tree.
          </p>
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
                      <EditableField
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
// EditableField (label editing)
// ---------------------------------------------------------------------------

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
          className={cn("bg-white border border-zinc-300 rounded-lg px-2 py-1 text-[13px] outline-none focus:border-violet-500", className)}
        />
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
      className={cn("cursor-pointer hover:bg-violet-50 rounded px-1 -mx-1 transition-colors group/edit inline-flex items-center gap-1", className)}
    >
      {value}
      <Edit3 className="w-3 h-3 text-zinc-300 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
    </span>
  );
}
