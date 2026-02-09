import { useState } from "react";
import {
  Lightbulb,
  FileSearch,
  Edit3,
  Check,
  X,
  AlertTriangle,
  Plus,
  Sparkles,
} from "lucide-react";
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

export function HypothesisStage() {
  const [hypotheses, setHypotheses] = useState([
    {
      id: "h1",
      text: "Acme's legacy infrastructure costs $45M/yr to maintain — migration could cut this by 60%",
      confidence: 82,
      source: "EDGAR 10-K + Gartner benchmark",
      status: "verified" as const,
      evidence: ["10-K FY2025 filing", "Gartner IT Spending Benchmark 2025"],
    },
    {
      id: "h2",
      text: "APAC expansion is blocked by on-prem scalability — cloud migration unblocks $2.1M in new revenue",
      confidence: 68,
      source: "Earnings call + customer interview",
      status: "needs-evidence" as const,
      evidence: ["Q3 2025 Earnings Call Transcript"],
    },
    {
      id: "h3",
      text: "Current 99.2% uptime is insufficient for APAC SLA requirements (99.95% needed)",
      confidence: 91,
      source: "Customer RFP + SLA docs",
      status: "verified" as const,
      evidence: ["Customer RFP v2.1", "Current SLA Dashboard Export"],
    },
  ]);

  const statusConfig = {
    verified: { label: "Verified", color: "text-emerald-700", bg: "bg-emerald-50", icon: Check },
    "needs-evidence": { label: "Needs Evidence", color: "text-amber-700", bg: "bg-amber-50", icon: AlertTriangle },
    draft: { label: "Draft", color: "text-zinc-500", bg: "bg-zinc-100", icon: Edit3 },
  };

  return (
    <div className="space-y-5">
      {/* Hypothesis header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-blue-600" />
          <h4 className="text-[13px] font-semibold text-zinc-900">Hypotheses</h4>
          <span className="text-[11px] text-zinc-400">{hypotheses.length} claims</span>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-zinc-300 rounded-xl text-[12px] text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors">
          <Plus className="w-3 h-3" />
          Add Hypothesis
        </button>
      </div>

      {/* Hypothesis cards */}
      <div className="space-y-3">
        {hypotheses.map((h) => {
          const st = statusConfig[h.status];
          const StIcon = st.icon;
          return (
            <div key={h.id} className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 transition-colors">
              {/* Status + confidence row */}
              <div className="flex items-center justify-between mb-3">
                <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", st.color, st.bg)}>
                  <StIcon className="w-3 h-3" />
                  <span>{st.label}</span>
                </div>
                <ConfidenceBadge value={h.confidence} source={h.source} />
              </div>

              {/* Hypothesis text — editable */}
              <p className="text-[14px] text-zinc-800 leading-relaxed mb-3">
                <EditableField value={h.text} onSave={(v) => {
                  setHypotheses(prev => prev.map(x => x.id === h.id ? { ...x, text: v } : x));
                }} />
              </p>

              {/* Evidence chain */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Evidence:</span>
                {h.evidence.map((e) => (
                  <span key={e} className="flex items-center gap-1 px-2 py-0.5 bg-zinc-50 border border-zinc-100 rounded-md text-[10px] text-zinc-600 cursor-pointer hover:bg-zinc-100 transition-colors">
                    <FileSearch className="w-2.5 h-2.5" />
                    {e}
                  </span>
                ))}
                <button className="flex items-center gap-1 px-2 py-0.5 border border-dashed border-zinc-200 rounded-md text-[10px] text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 transition-colors">
                  <Plus className="w-2.5 h-2.5" />
                  Link
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Company intelligence — auto-populated, never blank */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-zinc-500" />
          <h4 className="text-[13px] font-semibold text-zinc-900">Company Intelligence</h4>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
            Auto-populated
          </span>
        </div>
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
      </div>

      {/* Discovery stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Stakeholders Mapped", value: "14", sub: "4 decision makers" },
          { label: "Competitors Identified", value: "6", sub: "2 incumbent" },
          { label: "Use Cases Found", value: "8", sub: "3 high priority" },
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
