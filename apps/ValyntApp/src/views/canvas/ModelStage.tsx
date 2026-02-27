import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  Edit3,
  Minus,
  Plus,
  TrendingUp,
  X,
} from "lucide-react";
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
  const [valueNodes] = useState([
    {
      id: "v1",
      label: "Infrastructure Cost Reduction",
      value: "$1.8M",
      pct: 43,
      confidence: 85,
      trend: "up" as "up" | "down" | "flat",
      children: [
        { label: "Server consolidation", value: "$900K", confidence: 88 },
        { label: "License optimization", value: "$500K", confidence: 82 },
        { label: "Ops automation", value: "$400K", confidence: 79 },
      ],
    },
    {
      id: "v2",
      label: "Revenue Acceleration",
      value: "$1.5M",
      pct: 36,
      confidence: 72,
      trend: "up" as "up" | "down" | "flat",
      children: [
        { label: "Faster time-to-market", value: "$900K", confidence: 75 },
        { label: "APAC expansion enablement", value: "$600K", confidence: 68 },
      ],
    },
    {
      id: "v3",
      label: "Risk Mitigation",
      value: "$0.9M",
      pct: 21,
      confidence: 78,
      trend: "flat" as "up" | "down" | "flat",
      children: [
        { label: "Compliance automation", value: "$500K", confidence: 82 },
        { label: "Disaster recovery", value: "$400K", confidence: 74 },
      ],
    },
  ]);

  const assumptions = [
    { label: "Migration timeline", baseline: "18 months", target: "12 months", confidence: 75, flagged: true },
    { label: "Server reduction", baseline: "340 servers", target: "85 instances", confidence: 88, flagged: false },
    { label: "Annual ops savings", baseline: "$0", target: "$1.2M/yr", confidence: 72, flagged: true },
    { label: "Uptime improvement", baseline: "99.2%", target: "99.95%", confidence: 91, flagged: false },
  ];

  const scenarios = [
    { name: "Conservative", totalValue: "$3.2M", roi: "180%", confidence: 89 },
    { name: "Base Case", totalValue: "$4.2M", roi: "240%", confidence: 78 },
    { name: "Aggressive", totalValue: "$5.8M", roi: "320%", confidence: 62 },
  ];

  const trendIcon = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

  return (
    <div className="space-y-5">
      {/* Total value header */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-600" />
            <h4 className="text-[13px] font-semibold text-zinc-900">Value Architecture</h4>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-400">Total Projected Value</span>
            <span className="text-xl font-black text-zinc-950 tracking-tight">$4.2M</span>
          </div>
        </div>

        {/* Value tree nodes */}
        <div className="space-y-3">
          {valueNodes.map((node) => {
            const TrendIcon = trendIcon[node.trend];
            return (
              <div key={node.id} className="p-4 border border-zinc-100 rounded-xl hover:border-zinc-200 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-zinc-900">{node.label}</span>
                    <TrendIcon className={cn(
                      "w-3.5 h-3.5",
                      node.trend === "up" ? "text-emerald-500" : node.trend === "down" ? "text-red-500" : "text-zinc-400"
                    )} />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            node.confidence >= 80 ? "bg-emerald-500" : node.confidence >= 60 ? "bg-amber-500" : "bg-red-400"
                          )}
                          style={{ width: `${node.confidence}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-500">{node.confidence}%</span>
                    </div>
                    <span className="text-[14px] font-black text-zinc-950 tracking-tight">
                      <EditableNumber value={node.value} onSave={() => {}} />
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${node.pct}%` }} />
                </div>

                {/* Child value drivers */}
                <div className="grid grid-cols-3 gap-2">
                  {node.children.map((ch) => (
                    <div key={ch.label} className="p-2.5 bg-zinc-50 rounded-lg">
                      <p className="text-[11px] text-zinc-500 mb-0.5">{ch.label}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-zinc-800">{ch.value}</span>
                        <span className={cn(
                          "text-[10px] font-medium",
                          ch.confidence >= 80 ? "text-emerald-600" : ch.confidence >= 60 ? "text-amber-600" : "text-red-500"
                        )}>
                          {ch.confidence}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key assumptions — editable, flagged */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-violet-600" />
          <h4 className="text-[13px] font-semibold text-zinc-900">Key Assumptions</h4>
          <span className="text-[11px] text-zinc-400 ml-auto">Click values to edit</span>
        </div>
        <div className="space-y-2">
          {assumptions.map((kpi) => (
            <div
              key={kpi.label}
              className={cn(
                "flex items-center gap-4 p-3 rounded-xl transition-colors cursor-pointer",
                kpi.flagged ? "bg-amber-50/50 border border-amber-200" : "bg-zinc-50 hover:bg-zinc-100"
              )}
            >
              {kpi.flagged && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
              <span className="text-[13px] text-zinc-700 flex-1">{kpi.label}</span>
              <span className="text-[12px] text-zinc-400 line-through">{kpi.baseline}</span>
              <ChevronRight className="w-3 h-3 text-zinc-300" />
              <span className="text-[12px] font-semibold text-violet-700">
                <EditableNumber value={kpi.target} onSave={() => {}} />
              </span>
              <div className="flex items-center gap-1">
                <div className="w-8 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      kpi.confidence >= 80 ? "bg-emerald-500" : kpi.confidence >= 60 ? "bg-amber-500" : "bg-red-400"
                    )}
                    style={{ width: `${kpi.confidence}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500">{kpi.confidence}%</span>
              </div>
            </div>
          ))}
        </div>
        <button className="flex items-center gap-1.5 mt-3 px-3 py-1.5 border border-dashed border-zinc-300 rounded-xl text-[12px] text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors">
          <Plus className="w-3 h-3" />
          Add Assumption
        </button>
      </div>

      {/* Scenario comparison */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <h4 className="text-[13px] font-semibold text-zinc-900 mb-4">Scenario Comparison</h4>
        <div className="grid grid-cols-3 gap-3">
          {scenarios.map((s, i) => (
            <div
              key={s.name}
              className={cn(
                "p-4 rounded-xl border text-center transition-colors cursor-pointer",
                i === 1 ? "border-violet-300 bg-violet-50/50" : "border-zinc-100 hover:border-zinc-200"
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400 mb-2">{s.name}</p>
              <p className="text-xl font-black text-zinc-950 tracking-tight">{s.totalValue}</p>
              <p className="text-[12px] font-medium text-violet-700 mt-1">{s.roi} ROI</p>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <div className="w-10 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      s.confidence >= 80 ? "bg-emerald-500" : s.confidence >= 60 ? "bg-amber-500" : "bg-red-400"
                    )}
                    style={{ width: `${s.confidence}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500">{s.confidence}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
