import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileSearch,
  GitBranch,
  Hash,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────
type ClaimStatus = "verified" | "flagged" | "rejected" | "pending";

interface Claim {
  id: string;
  text: string;
  tier: string;
  source: string;
  confidence: number;
  status: ClaimStatus;
  objection?: string;
  resolution?: string;
  component?: string; // Which component scoped this veto
  formula?: string;   // For CFO Defence Lineage
  rawCalc?: string;
  agent?: string;
  sources?: string[];
}

// ── Config ──────────────────────────────────────────────────────
const statusConfig: Record<ClaimStatus, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  verified: { icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50", label: "Verified" },
  flagged: { icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50", label: "Flagged" },
  rejected: { icon: XCircle, color: "text-red-700", bg: "bg-red-50", label: "Rejected" },
  pending: { icon: Clock, color: "text-zinc-500", bg: "bg-zinc-100", label: "Pending" },
};

const tierConfig: Record<string, { color: string; bg: string }> = {
  "Tier 1": { color: "text-emerald-700", bg: "bg-emerald-50" },
  "Tier 2": { color: "text-blue-700", bg: "bg-blue-50" },
  "Tier 3": { color: "text-amber-700", bg: "bg-amber-50" },
};

// ── CFO Defence Lineage Panel ───────────────────────────────────
function CFODefenceLineage({ claim }: { claim: Claim }) {
  const [expanded, setExpanded] = useState(false);

  if (!claim.formula && !claim.rawCalc) return null;

  return (
    <div className="mt-3 border border-zinc-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 transition-colors"
      >
        <GitBranch className="w-3 h-3 text-zinc-500" />
        <span className="text-[11px] font-semibold text-zinc-700">CFO Defence Lineage</span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-zinc-400 ml-auto" />
        ) : (
          <ChevronRight className="w-3 h-3 text-zinc-400 ml-auto" />
        )}
      </button>

      {expanded && (
        <div className="p-3 space-y-2 bg-white">
          {/* Formula */}
          {claim.formula && (
            <div className="flex items-start gap-2">
              <Hash className="w-3 h-3 text-violet-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-0.5">Formula</p>
                <code className="text-[11px] text-violet-700 bg-violet-50 px-2 py-0.5 rounded font-mono">
                  {claim.formula}
                </code>
              </div>
            </div>
          )}

          {/* Raw Calculation */}
          {claim.rawCalc && (
            <div className="flex items-start gap-2">
              <ArrowRight className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-0.5">Calculation</p>
                <p className="text-[11px] text-zinc-700 font-mono">{claim.rawCalc}</p>
              </div>
            </div>
          )}

          {/* Agent */}
          {claim.agent && (
            <div className="flex items-start gap-2">
              <Bot className="w-3 h-3 text-pink-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-0.5">Agent</p>
                <p className="text-[11px] text-zinc-700">{claim.agent}</p>
              </div>
            </div>
          )}

          {/* Sources */}
          {claim.sources && claim.sources.length > 0 && (
            <div className="flex items-start gap-2">
              <FileSearch className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-0.5">Sources</p>
                <div className="space-y-1">
                  {claim.sources.map((src, i) => (
                    <p key={i} className="text-[11px] text-zinc-600 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-zinc-300" />
                      {src}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Claim Card ──────────────────────────────────────────────────
function ClaimCard({ claim }: { claim: Claim }) {
  const st = statusConfig[claim.status];
  const StIcon = st.icon;
  const tierKey = claim.tier.split(":")[0] ?? "Tier 3";
  const tc = (tierConfig[tierKey] ?? tierConfig["Tier 3"])!;

  return (
    <div className={cn(
      "p-4 rounded-2xl border transition-colors",
      claim.status === "flagged" ? "border-amber-200 bg-amber-50/30" :
      claim.status === "rejected" ? "border-red-200 bg-red-50/30" :
      "border-zinc-200 bg-white"
    )}>
      {/* Header: status + tier + confidence + component scope */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", st.color, st.bg)}>
            <StIcon className="w-3 h-3" />
            <span>{st.label}</span>
          </div>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", tc.color, tc.bg)}>
            {claim.tier}
          </span>
          {claim.component && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-zinc-100 text-zinc-600">
              {claim.component}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                claim.confidence >= 90 ? "bg-emerald-500" : claim.confidence >= 75 ? "bg-blue-500" : claim.confidence >= 50 ? "bg-amber-500" : "bg-red-400"
              )}
              style={{ width: `${claim.confidence}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-zinc-600">{claim.confidence}%</span>
        </div>
      </div>

      {/* Claim text */}
      <p className="text-[13px] text-zinc-800 font-medium mb-2">{claim.text}</p>

      {/* Source */}
      <div className="flex items-center gap-1.5 mb-3">
        <FileSearch className="w-3 h-3 text-zinc-400" />
        <span className="text-[11px] text-zinc-500">{claim.source}</span>
        <ExternalLink className="w-3 h-3 text-zinc-300 cursor-pointer hover:text-zinc-500" />
      </div>

      {/* Objection (if flagged) */}
      {claim.objection && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 mb-3">
          <p className="text-[11px] font-semibold text-amber-800 mb-1">
            {claim.component ? `Veto by ${claim.component}` : "Objection"}
          </p>
          <p className="text-[12px] text-amber-700">{claim.objection}</p>
        </div>
      )}

      {/* Resolution (if resolved) */}
      {claim.resolution && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 mb-3">
          <p className="text-[11px] font-semibold text-emerald-800 mb-1">Resolution</p>
          <p className="text-[12px] text-emerald-700">{claim.resolution}</p>
        </div>
      )}

      {/* CFO Defence Lineage */}
      <CFODefenceLineage claim={claim} />

      {/* Actions */}
      {claim.status === "flagged" && (
        <div className="flex items-center gap-2 pt-3 mt-3 border-t border-zinc-100">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 text-white rounded-lg text-[11px] font-medium hover:bg-zinc-800">
            <RotateCcw className="w-3 h-3" />
            Revise Claim
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
            <ThumbsUp className="w-3 h-3" />
            Override
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
            <ThumbsDown className="w-3 h-3" />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

// ── Confidence Methodology ──────────────────────────────────────
function ConfidenceMethodology() {
  const [expanded, setExpanded] = useState(false);

  const methodology = [
    { tier: "Tier 1", label: "Authoritative", range: "90-100%", desc: "SEC filings, audited financials, customer-provided data", color: "bg-emerald-500" },
    { tier: "Tier 2", label: "Market Data", range: "70-89%", desc: "Gartner, Bloomberg, industry benchmarks, analyst reports", color: "bg-blue-500" },
    { tier: "Tier 3", label: "Self-Reported", range: "40-69%", desc: "Customer interviews, internal estimates, vendor claims", color: "bg-amber-500" },
    { tier: "Unverified", label: "Unverified", range: "0-39%", desc: "Assumptions without supporting evidence", color: "bg-red-400" },
  ];

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-5 py-3 hover:bg-zinc-50 transition-colors"
      >
        <ShieldCheck className="w-4 h-4 text-zinc-500" />
        <span className="text-[13px] font-semibold text-zinc-900">Confidence Scoring Methodology</span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-400 ml-auto" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-400 ml-auto" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-2">
          {methodology.map((m) => (
            <div key={m.tier} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50">
              <div className={cn("w-2 h-8 rounded-full", m.color)} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-zinc-900">{m.tier}</span>
                  <span className="text-[10px] font-semibold text-zinc-400">{m.label}</span>
                  <span className="text-[10px] font-mono text-zinc-500 ml-auto">{m.range}</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Red Team Challenges ─────────────────────────────────────────
function RedTeamSection() {
  const challenges = [
    {
      id: "rt1",
      challenge: "The 4:1 server consolidation ratio assumes all workloads are containerizable. Legacy monoliths may require 2:1 at best.",
      severity: "high" as const,
      component: "Financial Modeling Agent",
      status: "open" as const,
    },
    {
      id: "rt2",
      challenge: "APAC revenue projection lacks competitive analysis. Three incumbents hold 60% market share in target segment.",
      severity: "medium" as const,
      component: "Opportunity Agent",
      status: "open" as const,
    },
    {
      id: "rt3",
      challenge: "12-month migration timeline doesn't account for Q4 code freeze. Realistic estimate is 14-16 months.",
      severity: "low" as const,
      component: "Compliance Auditor",
      status: "resolved" as const,
    },
  ];

  const severityConfig = {
    high: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
    medium: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
    low: { color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-4 h-4 text-red-500" />
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Red Team Challenges</h4>
      </div>
      <div className="space-y-3">
        {challenges.map((c) => {
          const sc = severityConfig[c.severity];
          return (
            <div key={c.id} className={cn("p-4 rounded-2xl border", sc.border, c.status === "resolved" ? "opacity-60" : "")}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", sc.color, sc.bg)}>
                  {c.severity}
                </span>
                <span className="text-[10px] text-zinc-400">{c.component}</span>
                {c.status === "resolved" && (
                  <span className="text-[10px] font-semibold text-emerald-600 ml-auto">Resolved</span>
                )}
              </div>
              <p className="text-[12px] text-zinc-700">{c.challenge}</p>
              {c.status === "open" && (
                <div className="flex items-center gap-2 mt-3">
                  <button className="px-3 py-1.5 bg-zinc-950 text-white rounded-lg text-[11px] font-medium hover:bg-zinc-800">
                    Action
                  </button>
                  <button className="px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
                    Override
                  </button>
                  <button className="px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
                    Compensate
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main IntegrityStage ─────────────────────────────────────────
export function IntegrityStage() {
  const claims: Claim[] = [
    {
      id: "c1",
      text: "Annual revenue $2.4B with 8.2% YoY growth",
      tier: "Tier 1: EDGAR",
      source: "10-K FY2025 Filing",
      confidence: 98,
      status: "verified",
      component: "Financial Modeling Agent",
      formula: "revenue_growth = (rev_current - rev_prior) / rev_prior × 100",
      rawCalc: "($2.4B - $2.218B) / $2.218B × 100 = 8.2%",
      agent: "Financial Modeling Agent v2.1",
      sources: ["SEC EDGAR 10-K FY2025", "Bloomberg Terminal — ACME US Equity"],
    },
    {
      id: "c2",
      text: "Infrastructure cost reduction of $1.8M through server consolidation",
      tier: "Tier 2: Market Data",
      source: "Gartner IT Spending Benchmark 2025",
      confidence: 72,
      status: "flagged",
      objection: "Server consolidation ratio of 4:1 exceeds industry average of 3:1. The $1.8M figure may be overstated by 15-20%.",
      component: "Integrity Engine",
      formula: "savings = servers_reduced × avg_cost_per_server × 12",
      rawCalc: "150 servers × $1,000/mo × 12 = $1.8M (but 3:1 ratio → 112 servers → $1.34M)",
      agent: "Financial Modeling Agent v2.1",
      sources: ["Gartner IT Spending Benchmark 2025", "Customer infrastructure audit Q3"],
    },
    {
      id: "c3",
      text: "IT spend at 7.5% of revenue ($180M)",
      tier: "Tier 2: Market Data",
      source: "Gartner benchmark + customer estimate",
      confidence: 82,
      status: "verified",
      resolution: "Cross-referenced with Gartner Manufacturing IT Spending Report 2025. 7.5% is within the 6.8-8.2% range for manufacturing sector.",
      component: "Opportunity Agent",
      formula: "it_spend_pct = it_budget / annual_revenue × 100",
      rawCalc: "$180M / $2.4B × 100 = 7.5%",
      agent: "Opportunity Agent v1.8",
      sources: ["Gartner Manufacturing IT Spending Report 2025", "Customer CFO interview transcript"],
    },
    {
      id: "c4",
      text: "APAC expansion will generate $2.1M in new revenue within 18 months",
      tier: "Tier 3: Self-reported",
      source: "Customer interview — VP of Strategy",
      confidence: 58,
      status: "flagged",
      objection: "Revenue projection is based on a single customer interview. No market sizing data or competitive analysis to support the $2.1M figure.",
      component: "Compliance Auditor",
    },
    {
      id: "c5",
      text: "Current uptime is 99.2%, target SLA requires 99.95%",
      tier: "Tier 1: Customer Data",
      source: "Customer SLA Dashboard Export",
      confidence: 95,
      status: "verified",
      component: "Opportunity Agent",
    },
    {
      id: "c6",
      text: "Migration can be completed in 12 months",
      tier: "Tier 3: Estimate",
      source: "Internal engineering assessment",
      confidence: 45,
      status: "pending",
      component: "Target Agent",
    },
  ];

  const verified = claims.filter((c) => c.status === "verified").length;
  const flagged = claims.filter((c) => c.status === "flagged").length;
  const pending = claims.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex items-center gap-1 p-1 bg-white border border-zinc-200 rounded-2xl">
        {[
          { label: "Total Claims", value: claims.length, color: "text-zinc-900" },
          { label: "Verified", value: verified, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Flagged", value: flagged, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Pending", value: pending, color: "text-zinc-500", bg: "bg-zinc-100" },
        ].map((s) => (
          <div key={s.label} className={cn("flex-1 text-center py-3 rounded-xl", s.bg)}>
            <p className={cn("text-lg font-black tracking-tight", s.color)}>{s.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Overall integrity score */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-zinc-600" />
            <h4 className="text-[13px] font-semibold text-zinc-900">Integrity Score</h4>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: "76%" }} />
            </div>
            <span className="text-[14px] font-black text-zinc-950">76%</span>
          </div>
        </div>
        <p className="text-[12px] text-zinc-500">
          2 claims need attention before this case can advance to Narrative. Resolve flagged items to improve the integrity score.
        </p>
      </div>

      {/* Confidence Methodology */}
      <ConfidenceMethodology />

      {/* Red Team Challenges */}
      <RedTeamSection />

      {/* Claims list */}
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">All Claims</h4>
        <div className="space-y-3">
          {claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
        </div>
      </div>
    </div>
  );
}
