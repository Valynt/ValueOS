import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { useNarrativeDraft, useRunNarrativeAgent } from "@/hooks/useNarrative";

// Collapsible section
function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-5 py-4 hover:bg-zinc-50 transition-colors"
      >
        <Icon className="w-4 h-4 text-zinc-500" />
        <span className="text-[13px] font-semibold text-zinc-900 flex-1 text-left">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-zinc-100">{children}</div>}
    </div>
  );
}

export function NarrativeStage({ caseId }: { caseId?: string }) {
  const { data: draft, isLoading, error } = useNarrativeDraft(caseId);
  const runAgent = useRunNarrativeAgent(caseId);

  const formats = [
    { key: "executive" as const, label: "Executive Summary", desc: "Board-ready, impact-focused" },
    { key: "technical" as const, label: "Technical Brief", desc: "Architecture and implementation" },
    { key: "financial" as const, label: "Financial Case", desc: "ROI, TCO, and payback analysis" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-[13px]">Loading narrative draft…</span>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <FileText className="w-8 h-8 text-zinc-300" />
        <p className="text-[13px] text-zinc-500 text-center max-w-xs">
          No narrative draft yet. Run the Narrative Agent to assemble the value case story.
        </p>
        <button
          onClick={() => runAgent.mutate({})}
          disabled={runAgent.isPending || !caseId}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white rounded-xl text-[12px] font-semibold hover:bg-zinc-800 disabled:opacity-50"
        >
          {runAgent.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          Run Narrative Agent
        </button>
        {runAgent.error && (
          <p className="text-[11px] text-red-500">{runAgent.error.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-pink-600" />
            <h4 className="text-[13px] font-semibold text-zinc-900">Narrative Assembly</h4>
          </div>
          <div className="flex items-center gap-2">
            {draft.defense_readiness_score != null && (
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                draft.defense_readiness_score >= 0.8 ? "bg-emerald-50 text-emerald-700" :
                draft.defense_readiness_score >= 0.6 ? "bg-amber-50 text-amber-700" :
                "bg-zinc-100 text-zinc-500"
              )}>
                {Math.round(draft.defense_readiness_score * 100)}% defense readiness
              </span>
            )}
            <button
              onClick={() => runAgent.mutate({})}
              disabled={runAgent.isPending || !caseId}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              {runAgent.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RotateCcw className="w-3 h-3" />
              )}
              Regenerate
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Format</span>
          <span className="text-[11px] text-zinc-600">{draft.format.replace(/_/g, " ")}</span>
        </div>
      </div>

      {/* Format selector (display only — agent produces executive format) */}
      <div className="flex items-center gap-2">
        {formats.map((f) => (
          <div
            key={f.key}
            className={cn(
              "flex-1 p-3 rounded-xl border text-left",
              f.key === "executive" ? "border-pink-300 bg-pink-50/50" : "border-zinc-200 opacity-50"
            )}
          >
            <p className="text-[12px] font-semibold text-zinc-900">{f.label}</p>
            <p className="text-[10px] text-zinc-400">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Narrative content */}
      <Section title="Narrative" icon={FileText} defaultOpen={true}>
        <div className="pt-4 space-y-4">
          <pre className="text-[13px] text-zinc-700 leading-relaxed whitespace-pre-wrap font-sans">
            {draft.content}
          </pre>
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
              <Edit3 className="w-3 h-3" />
              Edit
            </button>
            <button
              onClick={() => runAgent.mutate({})}
              disabled={runAgent.isPending || !caseId}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              Regenerate
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
              <Sparkles className="w-3 h-3" />
              Adjust Tone
            </button>
          </div>
        </div>
      </Section>

      {/* Export panel */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <h4 className="text-[13px] font-semibold text-zinc-900 mb-4">Export & Share</h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "PDF Report", desc: "Full business case", icon: Download },
            { label: "Slide Deck", desc: "Executive presentation", icon: ExternalLink },
            { label: "Copy to Clipboard", desc: "Paste into email/doc", icon: Copy },
          ].map((exp) => {
            const ExpIcon = exp.icon;
            return (
              <button
                key={exp.label}
                className="p-4 rounded-xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-colors text-left"
              >
                <ExpIcon className="w-4 h-4 text-zinc-500 mb-2" />
                <p className="text-[12px] font-semibold text-zinc-900">{exp.label}</p>
                <p className="text-[10px] text-zinc-400">{exp.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
