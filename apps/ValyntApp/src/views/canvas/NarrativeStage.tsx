import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  RotateCcw,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

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

export function NarrativeStage() {
  const [activeFormat, setActiveFormat] = useState<"executive" | "technical" | "financial">("executive");

  const formats = [
    { key: "executive" as const, label: "Executive Summary", desc: "Board-ready, impact-focused" },
    { key: "technical" as const, label: "Technical Brief", desc: "Architecture and implementation" },
    { key: "financial" as const, label: "Financial Case", desc: "ROI, TCO, and payback analysis" },
  ];

  return (
    <div className="space-y-5">
      {/* Narrative readiness */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-pink-600" />
            <h4 className="text-[13px] font-semibold text-zinc-900">Narrative Assembly</h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400">Readiness</span>
            <div className="w-20 h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: "91%" }} />
            </div>
            <span className="text-[12px] font-bold text-zinc-800">91%</span>
          </div>
        </div>

        {/* Readiness checklist */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Hypotheses", status: "complete", count: "3/3" },
            { label: "Value Model", status: "complete", count: "3 drivers" },
            { label: "Integrity", status: "warning", count: "2 flagged" },
            { label: "Evidence", status: "complete", count: "8 sources" },
          ].map((item) => (
            <div key={item.label} className={cn(
              "p-3 rounded-xl text-center",
              item.status === "complete" ? "bg-emerald-50" : "bg-amber-50"
            )}>
              <div className="flex items-center justify-center mb-1">
                {item.status === "complete" ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Shield className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <p className="text-[11px] font-semibold text-zinc-700">{item.label}</p>
              <p className="text-[10px] text-zinc-500">{item.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Format selector */}
      <div className="flex items-center gap-2">
        {formats.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFormat(f.key)}
            className={cn(
              "flex-1 p-3 rounded-xl border text-left transition-colors",
              activeFormat === f.key
                ? "border-pink-300 bg-pink-50/50"
                : "border-zinc-200 hover:border-zinc-300"
            )}
          >
            <p className="text-[12px] font-semibold text-zinc-900">{f.label}</p>
            <p className="text-[10px] text-zinc-400">{f.desc}</p>
          </button>
        ))}
      </div>

      {/* Executive summary content */}
      <Section title="Executive Summary" icon={FileText} defaultOpen={true}>
        <div className="pt-4 space-y-4">
          <div className="prose prose-sm max-w-none">
            <p className="text-[13px] text-zinc-700 leading-relaxed">
              <strong>Acme Corp</strong> faces a strategic inflection point: their legacy on-premises infrastructure, 
              supporting 340+ applications across 12,400 employees, is constraining their ability to expand into APAC 
              markets — a board-level priority for H1 2026.
            </p>
            <p className="text-[13px] text-zinc-700 leading-relaxed">
              Our analysis, grounded in EDGAR filings, Gartner benchmarks, and direct customer data, identifies 
              <strong> $4.2M in projected value</strong> across three pillars: infrastructure cost reduction ($1.8M), 
              revenue acceleration ($1.5M), and risk mitigation ($0.9M).
            </p>
            <p className="text-[13px] text-zinc-700 leading-relaxed">
              The base case projects a <strong>240% ROI</strong> with a 14-month payback period. Key assumptions 
              include a 12-month migration timeline and 4:1 server consolidation ratio — both within industry norms 
              for enterprises of this scale.
            </p>
          </div>

          {/* Edit / regenerate controls */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
              <Edit3 className="w-3 h-3" />
              Edit
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
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

      {/* Impact cascade */}
      <Section title="Impact Cascade" icon={TrendingUp}>
        <div className="pt-4 space-y-3">
          {[
            {
              driver: "Infrastructure Cost Reduction",
              value: "$1.8M",
              impacts: [
                "Server consolidation: 340 → 85 instances",
                "License optimization: 40% reduction in VMware licensing",
                "Ops automation: 60% reduction in manual provisioning",
              ],
            },
            {
              driver: "Revenue Acceleration",
              value: "$1.5M",
              impacts: [
                "Time-to-market: 6 weeks → 2 weeks for new features",
                "APAC expansion: infrastructure ready for 99.95% SLA",
              ],
            },
            {
              driver: "Risk Mitigation",
              value: "$0.9M",
              impacts: [
                "Compliance automation: SOC 2 + ISO 27001 continuous",
                "Disaster recovery: RTO from 24h to 4h",
              ],
            },
          ].map((d) => (
            <div key={d.driver} className="p-4 rounded-xl border border-zinc-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-medium text-zinc-900">{d.driver}</span>
                <span className="text-[14px] font-black text-zinc-950">{d.value}</span>
              </div>
              <div className="space-y-1.5">
                {d.impacts.map((impact) => (
                  <div key={impact} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-400 mt-1.5 flex-shrink-0" />
                    <span className="text-[12px] text-zinc-600">{impact}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Stakeholder map */}
      <Section title="Stakeholder Alignment" icon={Users} defaultOpen={false}>
        <div className="pt-4 space-y-2">
          {[
            { name: "Sarah Chen", role: "CTO", stance: "Champion", priority: "Technical modernization" },
            { name: "Michael Torres", role: "CFO", stance: "Neutral", priority: "ROI and payback period" },
            { name: "Lisa Park", role: "VP Engineering", stance: "Supporter", priority: "Developer productivity" },
            { name: "James Wright", role: "CISO", stance: "Cautious", priority: "Security and compliance" },
          ].map((s) => (
            <div key={s.name} className="flex items-center gap-4 p-3 rounded-xl bg-zinc-50">
              <div className="w-8 h-8 bg-zinc-200 rounded-full flex items-center justify-center text-[11px] font-bold text-zinc-600">
                {s.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-medium text-zinc-900">{s.name} · {s.role}</p>
                <p className="text-[11px] text-zinc-400">{s.priority}</p>
              </div>
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                s.stance === "Champion" ? "bg-emerald-50 text-emerald-700" :
                s.stance === "Supporter" ? "bg-blue-50 text-blue-700" :
                s.stance === "Cautious" ? "bg-amber-50 text-amber-700" :
                "bg-zinc-100 text-zinc-500"
              )}>
                {s.stance}
              </span>
            </div>
          ))}
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
