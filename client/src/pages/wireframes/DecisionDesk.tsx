/*
 * ValueOS Wireframes — Decision Desk
 * Approval queue for value cases requiring human sign-off
 * Responsive: Desktop = queue list + detail panel, Mobile = list with expandable detail
 */
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, AlertTriangle,
  ArrowRight, Shield, DollarSign, Eye
} from "lucide-react";
import { useState } from "react";
import { AnnotatedSection, ANNOTATIONS } from "@/components/wireframes/AnnotationOverlay";
import { ResponsivePageLayout } from "@/components/wireframes/ResponsiveNav";

/* ------------------------------------------------------------------ */
/*  Decision Items                                                     */
/* ------------------------------------------------------------------ */
interface DecisionItem {
  id: string;
  title: string;
  company: string;
  type: "discount-approval" | "case-promotion" | "assumption-override" | "policy-exception";
  urgency: "high" | "medium" | "low";
  requestedBy: string;
  requestedAt: string;
  summary: string;
  impact: string;
  policyRef: string;
  evidence: string[];
}

const decisions: DecisionItem[] = [
  {
    id: "D1", title: "Approve 22% discount for Stark Industries", company: "Stark Industries",
    type: "discount-approval", urgency: "high", requestedBy: "The Strategist (Agent)", requestedAt: "12 min ago",
    summary: "Discount of 22% exceeds the 15% policy threshold. The value model shows positive ROI even at this discount level, but margin drops below 65%.",
    impact: "Revenue impact: -$836K over 3 years. Margin: 62.4% (threshold: 65%)",
    policyRef: "Policy \u00a74.2 \u2014 Max discount without VP approval: 15%",
    evidence: ["E1 \u2014 Stark Industries P&L", "E7 \u2014 McKinsey Digital Index"],
  },
  {
    id: "D2", title: "Promote Acme Cloud Migration to Executive Ready", company: "Acme Corp",
    type: "case-promotion", urgency: "medium", requestedBy: "The Analyst (Agent)", requestedAt: "1 hour ago",
    summary: "Value case has 4/5 assumptions validated (72% confidence). Assumption A3 remains at 41% confidence but has been weighted down to 50%.",
    impact: "Projected value: $4.2M. Remaining risk: A3 productivity assumption.",
    policyRef: "Policy \u00a72.1 \u2014 Minimum confidence for Executive Ready: 70%",
    evidence: ["E2 \u2014 Gartner Benchmark", "E3 \u2014 Contoso Case Study", "E5 \u2014 CloudCo SOW"],
  },
  {
    id: "D3", title: "Override assumption A4 with manual estimate", company: "Acme Corp",
    type: "assumption-override", urgency: "low", requestedBy: "Sarah Chen (User)", requestedAt: "3 hours ago",
    summary: "User wants to replace the unvalidated security savings assumption (A4: $180K/yr) with a manual estimate of $120K/yr based on a conversation with the CISO.",
    impact: "Reduces total case value by $180K over 3 years. Improves confidence from 72% to 78%.",
    policyRef: "Policy \u00a73.3 \u2014 Manual overrides require documented justification",
    evidence: ["Meeting notes \u2014 CISO call 03/05"],
  },
  {
    id: "D4", title: "Allow non-standard payment terms for Cyberdyne", company: "Cyberdyne",
    type: "policy-exception", urgency: "medium", requestedBy: "The Strategist (Agent)", requestedAt: "5 hours ago",
    summary: "Cyberdyne requests Net-90 payment terms. Standard policy is Net-30. The deal value ($5.6M) and strategic importance justify consideration.",
    impact: "Cash flow impact: $1.4M delayed per quarter. DSO increase: +8 days.",
    policyRef: "Policy \u00a75.1 \u2014 Payment terms exceptions require CFO approval",
    evidence: ["E8 \u2014 Cyberdyne credit assessment"],
  },
];

const typeConfig = {
  "discount-approval": { icon: DollarSign, color: "text-warning", bg: "bg-warning/10", label: "Discount Approval" },
  "case-promotion": { icon: ArrowRight, color: "text-primary", bg: "bg-primary/10", label: "Stage Promotion" },
  "assumption-override": { icon: Shield, color: "text-violet-400", bg: "bg-violet-500/10", label: "Override" },
  "policy-exception": { icon: AlertTriangle, color: "text-risk", bg: "bg-risk/10", label: "Policy Exception" },
};

const urgencyConfig = {
  high: { color: "text-risk", bg: "bg-risk/10", border: "border-risk/20" },
  medium: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
  low: { color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
};

/* ------------------------------------------------------------------ */
/*  Detail Panel (shared between desktop sidebar and mobile full-screen) */
/* ------------------------------------------------------------------ */
function DetailPanel({ item, onBack }: { item: DecisionItem; onBack?: () => void }) {
  const cfg = typeConfig[item.type];
  const Icon = cfg.icon;

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      {onBack && (
        <button onClick={onBack} className="md:hidden flex items-center gap-1.5 text-[11px] text-muted-foreground mb-4 hover:text-foreground transition-colors">
          <ArrowRight className="w-3 h-3 rotate-180" />
          Back to queue
        </button>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-7 h-7 rounded-md ${cfg.bg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${cfg.color}`} />
          </div>
          <span className={`text-[10px] font-mono uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
        </div>
        <h2 className="text-base md:text-lg font-semibold mb-1">{item.title}</h2>
        <p className="text-[11px] text-muted-foreground">
          Requested by <span className="text-foreground font-medium">{item.requestedBy}</span> · {item.requestedAt}
        </p>
      </div>

      <div className="mb-5">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Summary</h3>
        <p className="text-[12px] leading-relaxed bg-card border border-border rounded-lg p-4">{item.summary}</p>
      </div>

      <div className="mb-5">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Impact Assessment</h3>
        <div className="text-[12px] leading-relaxed bg-warning/5 border border-warning/15 rounded-lg p-4 text-warning">{item.impact}</div>
      </div>

      <div className="mb-5">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Policy Reference</h3>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border">
          <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-[11px] font-mono">{item.policyRef}</span>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Supporting Evidence</h3>
        <div className="space-y-1.5">
          {item.evidence.map((e) => (
            <div key={e} className="flex items-center gap-2 px-3 py-2 rounded-md bg-card border border-border hover:border-primary/20 transition-colors cursor-pointer">
              <Eye className="w-3 h-3 text-muted-foreground" />
              <span className="text-[11px]">{e}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-border">
        <button className="h-9 px-4 md:px-5 rounded-lg bg-health text-health-foreground text-[12px] font-medium flex items-center gap-2 hover:bg-health/90 transition-colors">
          <CheckCircle2 className="w-4 h-4" />
          Approve
        </button>
        <button className="h-9 px-4 md:px-5 rounded-lg bg-risk text-white text-[12px] font-medium flex items-center gap-2 hover:bg-risk/90 transition-colors">
          <XCircle className="w-4 h-4" />
          Reject
        </button>
        <button className="h-9 px-4 md:px-5 rounded-lg bg-muted text-foreground text-[12px] font-medium flex items-center gap-2 hover:bg-accent transition-colors sm:ml-auto">
          Request More Evidence
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function DecisionDesk() {
  const [selectedId, setSelectedId] = useState<string>("D1");
  const [showDetail, setShowDetail] = useState(false);
  const selected = decisions.find(d => d.id === selectedId)!;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setShowDetail(true);
  };

  return (
    <ResponsivePageLayout activeHref="/decisions">
      {/* Header */}
      <header className="h-12 border-b border-border flex items-center px-4 shrink-0 gap-2 md:gap-3">
        <h1 className="text-sm font-semibold">Decision Desk</h1>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-risk/10 text-risk border border-risk/20">4 pending</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground hidden sm:inline">1 high urgency</span>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Queue List */}
        <AnnotatedSection annotation={ANNOTATIONS.decisionDesk} position="top-right" className={`w-full md:w-96 md:shrink-0 ${showDetail ? 'hidden md:block' : ''}`}>
          <div className="w-full md:w-96 md:border-r border-border overflow-y-auto h-full">
            <div className="p-3 space-y-2">
              {decisions.map((d, i) => {
                const cfg = typeConfig[d.type];
                const urg = urgencyConfig[d.urgency];
                const Icon = cfg.icon;
                const isSelected = selectedId === d.id;

                return (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.2 }}
                    onClick={() => handleSelect(d.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected ? "bg-primary/5 border-primary/20" : "bg-card border-border hover:border-primary/10"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-5 h-5 rounded ${cfg.bg} flex items-center justify-center`}>
                        <Icon className={`w-3 h-3 ${cfg.color}`} />
                      </div>
                      <span className={`text-[9px] font-mono uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                      <span className={`text-[8px] font-mono px-1 py-0.5 rounded ${urg.bg} ${urg.color} ${urg.border} border ml-auto`}>{d.urgency}</span>
                    </div>
                    <h3 className="text-[11px] font-medium leading-snug mb-1">{d.title}</h3>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <span>{d.company}</span>
                      <span>·</span>
                      <Clock className="w-2.5 h-2.5" />
                      <span>{d.requestedAt}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </AnnotatedSection>

        {/* Detail Panel */}
        <AnnotatedSection annotation={ANNOTATIONS.hitlApproval} position="top-left" className={`flex-1 overflow-y-auto ${showDetail ? 'block' : 'hidden md:block'}`}>
          <motion.div key={selected.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <DetailPanel item={selected} onBack={() => setShowDetail(false)} />
          </motion.div>
        </AnnotatedSection>
      </div>
    </ResponsivePageLayout>
  );
}
