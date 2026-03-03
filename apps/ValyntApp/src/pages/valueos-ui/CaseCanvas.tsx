/*
 * VALYNT Value Case Canvas — The flagship screen
 * 5-stage pipeline: Hypothesis → Model → Integrity → Narrative → Realization
 * Right panel: Agent Workflow + Approval Required (or Evidence & Provenance)
 * Matches reference screenshots pixel-for-pixel
 */
import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, Eye, Clock, Play, CheckCircle2, AlertTriangle,
  ChevronUp, ChevronDown, ExternalLink, Plus, Loader2,
  FileText, Shield, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  valueCases, hypotheses, integrityClaims, narrativeData,
  realizationData, evidenceClaims, agentWorkflowSteps,
  approvalRequired, formatCurrency,
} from "@/lib/data";

const stages = [
  { id: "hypothesis", label: "Hypothesis", color: "bg-blue-500", dotColor: "bg-blue-500" },
  { id: "model", label: "Model", color: "bg-purple-500", dotColor: "bg-purple-500" },
  { id: "integrity", label: "Integrity", color: "bg-amber-500", dotColor: "bg-amber-500" },
  { id: "narrative", label: "Narrative", color: "bg-pink-500", dotColor: "bg-pink-500" },
  { id: "realization", label: "Realization", color: "bg-emerald-500", dotColor: "bg-emerald-500" },
];

const stageDescriptions: Record<string, string> = {
  hypothesis: "Discovery & claims",
  model: "Financial projections",
  integrity: "Verify & validate",
  narrative: "Assemble & export",
  realization: "Track & prove",
};

export default function CaseCanvas() {
  const params = useParams<{ id: string }>();
  const vc = valueCases.find((c) => c.id === params.id) || valueCases[0];
  const [activeStage, setActiveStage] = useState("hypothesis");
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/cases">
              <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-foreground">{vc.company} — {vc.title}</h1>
                <Badge className={cn(
                  "text-[10px] font-semibold capitalize",
                  vc.status === "running" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                  vc.status === "committed" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                  "bg-muted text-muted-foreground hover:bg-muted"
                )}>
                  {vc.status === "running" ? "Running" : vc.status.charAt(0).toUpperCase() + vc.status.slice(1)}
                </Badge>
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5">{vc.caseNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Confidence */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Confidence</span>
              <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    vc.confidence >= 80 ? "bg-emerald-500" :
                    vc.confidence >= 60 ? "bg-blue-500" : "bg-amber-500"
                  )}
                  style={{ width: `${vc.confidence}%` }}
                />
              </div>
              <span className="text-[13px] font-semibold">{vc.confidence}%</span>
            </div>
            {/* Version */}
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />
              v{vc.version}
            </div>
            {/* Evidence button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[12px]"
              onClick={() => setShowEvidence(!showEvidence)}
            >
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              Evidence
            </Button>
            {/* Run Stage */}
            <Button size="sm" className="h-8 text-[12px] bg-foreground text-background hover:bg-foreground/90">
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Run Stage
            </Button>
          </div>
        </div>

        {/* Stage Pipeline */}
        <div className="flex items-center gap-1 mt-4">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all",
                activeStage === stage.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full", stage.dotColor)} />
              {stage.label}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Iterate anytime
          </span>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5">
            {/* Stage header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className={cn("w-2.5 h-2.5 rounded-full", stages.find(s => s.id === activeStage)?.dotColor)} />
                <h2 className="text-base font-bold text-foreground capitalize">{activeStage}</h2>
                <span className="text-[13px] text-muted-foreground">{stageDescriptions[activeStage]}</span>
              </div>
              <span className="text-[12px] text-muted-foreground">Last updated {vc.lastUpdated}</span>
            </div>

            {/* Stage content */}
            {activeStage === "hypothesis" && <HypothesisStage />}
            {activeStage === "model" && <ModelStage />}
            {activeStage === "integrity" && <IntegrityStage />}
            {activeStage === "narrative" && <NarrativeStage />}
            {activeStage === "realization" && <RealizationStage />}
          </div>
        </div>

        {/* Right panel: Agent Workflow OR Evidence */}
        {showEvidence ? (
          <EvidencePanel onClose={() => setShowEvidence(false)} />
        ) : (
          <AgentWorkflowPanel />
        )}
      </div>
    </div>
  );
}

/* ============================================================
   HYPOTHESIS STAGE
   ============================================================ */
function HypothesisStage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-muted-foreground">💡</span>
          <h3 className="text-[14px] font-semibold">Hypotheses</h3>
          <span className="text-[12px] text-muted-foreground">{hypotheses.length} claims</span>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-[11px]">
          <Plus className="w-3 h-3 mr-1" />
          Add Hypothesis
        </Button>
      </div>

      <div className="space-y-3">
        {hypotheses.map((h) => (
          <div key={h.id} className="border border-border rounded-xl p-4 bg-card">
            {/* Status + confidence */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                {h.status === "verified" && (
                  <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 text-[10px] font-semibold">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
                {h.status === "needs_evidence" && (
                  <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 text-[10px] font-semibold">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Needs Evidence
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      h.confidence >= 80 ? "bg-emerald-500" :
                      h.confidence >= 60 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${h.confidence}%` }}
                  />
                </div>
                <span className="text-[12px] font-mono text-muted-foreground">{h.confidence}%</span>
                <span className="text-[11px] text-muted-foreground">{h.sources}</span>
              </div>
            </div>

            {/* Claim text */}
            <p className="text-[13.5px] text-foreground leading-relaxed">{h.text}</p>

            {/* Evidence tags */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Evidence:</span>
              {h.evidence.map((e, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  <FileText className="w-3 h-3" />
                  {e.name}
                </span>
              ))}
              <button className="text-[11px] text-muted-foreground hover:text-foreground">+ Link</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   MODEL STAGE
   ============================================================ */
function ModelStage() {
  return (
    <div className="space-y-5">
      {/* Model Assumptions */}
      <div className="border border-border rounded-xl p-5 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[13px]">⚙️</span>
            <h3 className="text-[14px] font-semibold">Model Assumptions</h3>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-[11px]">
            <FileText className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </div>
        <p className="text-[12px] text-muted-foreground mb-4">Key parameters that drive financial projections</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Time Horizon", value: "36 months" },
            { label: "Discount Rate", value: "12% annual" },
            { label: "Initial Adoption", value: "50%" },
            { label: "Ramp Duration", value: "12 months" },
            { label: "Inflation Rate", value: "2.5% annual" },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
              <p className="text-[15px] font-semibold mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Investments + Expected Benefits side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Investments */}
        <div className="border border-border rounded-xl p-5 bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px]">💰</span>
              <h3 className="text-[14px] font-semibold">Investments</h3>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-[11px]">
              <Plus className="w-3 h-3 mr-1" />
              Add Investment
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">Costs required to deliver the solution</p>
          <div className="space-y-3">
            {[
              { name: "ERP Software Licenses", cost: "$500,000", detail: "$500,000 upfront" },
              { name: "Implementation Services", cost: "$180,000", detail: "$10,900/mo – 3t for 12: 4mo" },
              { name: "Ongoing Support & Maintenance", cost: "$19,000", detail: "$10,000/mo – 15 for 15mo" },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                </div>
                <span className="text-[13px] font-semibold text-emerald-600">{item.cost}</span>
              </div>
            ))}
            <div className="border-t pt-3 flex items-center justify-between">
              <p className="text-[13px] font-medium">Total Investment</p>
              <span className="text-[14px] font-bold text-emerald-600">$830,000</span>
            </div>
          </div>
        </div>

        {/* Expected Benefits */}
        <div className="border border-border rounded-xl p-5 bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px]">🌱</span>
              <h3 className="text-[14px] font-semibold">Expected Benefits</h3>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-[11px]">
              <Plus className="w-3 h-3 mr-1" />
              Add Benefit
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">Value realized from the solution</p>
          <div className="space-y-3">
            {[
              { name: "Operational Efficiency Gains", tag: "cost savings", cost: "$637,500", detail: "$25,000 mo – 30mo @ 85% confidence" },
              { name: "Inventory Cost Reduction", tag: "cost savings", cost: "$270,000", detail: "$15,000 mo – 2.3mo @ 70% confidence" },
              { name: "Improved Decision-Making Speed", tag: "productivity", cost: "$189,000", detail: "$10,000 mo – 12mo @ 70% confidence" },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[9px]">{item.tag}</Badge>
                    <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-emerald-600">{item.cost}</span>
              </div>
            ))}
            <div className="border-t pt-3 flex items-center justify-between">
              <p className="text-[13px] font-medium">Total Benefits (risk-adjusted)</p>
              <span className="text-[14px] font-bold text-emerald-600">$1,096,500</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   INTEGRITY STAGE
   ============================================================ */
function IntegrityStage() {
  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-8 text-[12px] bg-emerald-600 hover:bg-emerald-700 text-white">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
          Revise Claim
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-[12px]">Override</Button>
        <Button variant="outline" size="sm" className="h-8 text-[12px]">Remove</Button>
      </div>

      {/* Claims */}
      {integrityClaims.map((claim) => (
        <div key={claim.id} className="border border-border rounded-xl p-5 bg-card">
          {/* Status + tier + confidence */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {claim.status === "verified" ? (
                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 text-[10px] font-semibold">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <Badge className="bg-red-50 text-red-700 hover:bg-red-50 text-[10px] font-semibold">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Flagged
                </Badge>
              )}
              <Badge variant="secondary" className={cn(
                "text-[10px] font-semibold",
                claim.tierLevel === 1 ? "bg-emerald-50 text-emerald-700" :
                claim.tierLevel === 2 ? "bg-blue-50 text-blue-700" :
                "bg-amber-50 text-amber-700"
              )}>
                {claim.tier}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    claim.confidence >= 80 ? "bg-blue-500" :
                    claim.confidence >= 60 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${claim.confidence}%` }}
                />
              </div>
              <span className="text-[12px] font-mono">{claim.confidence}%</span>
            </div>
          </div>

          {/* Claim text */}
          <p className="text-[14px] font-medium text-foreground">{claim.text}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[11px] text-muted-foreground">📎</span>
            <span className="text-[11px] text-muted-foreground">{claim.source}</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </div>

          {/* Resolution or Objection */}
          {claim.resolution && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-[11px] font-semibold text-emerald-800 mb-1">Resolution</p>
              <p className="text-[12px] text-emerald-700 leading-relaxed">{claim.resolution}</p>
            </div>
          )}
          {claim.objection && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-[11px] font-semibold text-red-800 mb-1">Objection</p>
              <p className="text-[12px] text-red-700 leading-relaxed">{claim.objection}</p>
            </div>
          )}

          {/* Per-claim action buttons for flagged */}
          {claim.status === "flagged" && (
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Revise Claim
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px]">Override</Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px]">Remove</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   NARRATIVE STAGE
   ============================================================ */
function NarrativeStage() {
  const [expandedSummary, setExpandedSummary] = useState(true);
  const [expandedStakeholder, setExpandedStakeholder] = useState(true);

  return (
    <div className="space-y-5">
      {/* Narrative Assembly */}
      <div className="border border-border rounded-xl p-5 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[13px]">📋</span>
            <h3 className="text-[14px] font-semibold">Narrative Assembly</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground">Readiness</span>
            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${narrativeData.readiness}%` }} />
            </div>
            <span className="text-[13px] font-semibold">{narrativeData.readiness}%</span>
          </div>
        </div>

        {/* Component readiness cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {narrativeData.components.map((comp) => (
            <div key={comp.name} className={cn(
              "rounded-lg p-3 text-center",
              comp.status === "complete" ? "bg-emerald-50" : "bg-amber-50"
            )}>
              <div className="flex justify-center mb-1">
                {comp.status === "complete" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                )}
              </div>
              <p className="text-[12px] font-semibold text-foreground">{comp.name}</p>
              <p className="text-[11px] text-muted-foreground">{comp.count}</p>
            </div>
          ))}
        </div>

        {/* Document type tabs */}
        <div className="flex gap-2">
          {narrativeData.documentTypes.map((doc, i) => (
            <button
              key={doc}
              className={cn(
                "px-4 py-2 rounded-lg text-[12px] font-medium transition-colors",
                i === 0 ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {doc}
            </button>
          ))}
        </div>
      </div>

      {/* Executive Summary */}
      <div className="border border-border rounded-xl bg-card">
        <button
          onClick={() => setExpandedSummary(!expandedSummary)}
          className="w-full flex items-center justify-between p-5"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-[14px] font-semibold">Executive Summary</h3>
          </div>
          {expandedSummary ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {expandedSummary && (
          <div className="px-5 pb-5 -mt-1">
            <div className="text-[13.5px] text-foreground leading-[1.8] whitespace-pre-line">
              {narrativeData.executiveSummary.split('\n').map((para, i) => (
                <p key={i} className="mb-3 last:mb-0">
                  {para.split(/(\$[\d.]+[MBK]?\s+in\s+projected\s+value|\d+%\s+ROI)/).map((part, j) => {
                    if (/\$[\d.]+[MBK]?\s+in\s+projected\s+value|\d+%\s+ROI/.test(part)) {
                      return <strong key={j}>{part}</strong>;
                    }
                    return part;
                  })}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Impact Cascade */}
      <div className="border border-border rounded-xl bg-card">
        <button
          onClick={() => setExpandedStakeholder(!expandedStakeholder)}
          className="w-full flex items-center justify-between p-5"
        >
          <div className="flex items-center gap-2">
            <span className="text-[13px]">📈</span>
            <h3 className="text-[14px] font-semibold">Impact Cascade</h3>
          </div>
          {expandedStakeholder ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {expandedStakeholder && (
          <div className="px-5 pb-5 space-y-4">
            {narrativeData.impactCascade.map((impact) => (
              <div key={impact.category}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[13.5px] font-semibold">{impact.category}</h4>
                  <span className="text-[14px] font-bold">{formatCurrency(impact.value)}</span>
                </div>
                <ul className="space-y-1">
                  {impact.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stakeholder Alignment */}
      <div className="border border-border rounded-xl bg-card">
        <button className="w-full flex items-center justify-between p-5">
          <div className="flex items-center gap-2">
            <span className="text-[13px]">👥</span>
            <h3 className="text-[14px] font-semibold">Stakeholder Alignment</h3>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   REALIZATION STAGE
   ============================================================ */
function RealizationStage() {
  const rd = realizationData;

  const metricCards = [
    {
      label: "Value Delivered",
      current: formatCurrency(rd.valueDelivered.current),
      target: `/ ${formatCurrency(rd.valueDelivered.target)}`,
      progress: (rd.valueDelivered.current / rd.valueDelivered.target) * 100,
      status: rd.valueDelivered.status,
    },
    {
      label: "KPIs On Track",
      current: `${rd.kpisOnTrack.current}/${rd.kpisOnTrack.total}`,
      target: `/ ${rd.kpisOnTrack.total}/${rd.kpisOnTrack.total}`,
      progress: (rd.kpisOnTrack.current / rd.kpisOnTrack.total) * 100,
      status: rd.kpisOnTrack.status,
    },
    {
      label: "Milestones Hit",
      current: `${rd.milestonesHit.current}/${rd.milestonesHit.total}`,
      target: `/ ${rd.milestonesHit.total}/${rd.milestonesHit.total}`,
      progress: (rd.milestonesHit.current / rd.milestonesHit.total) * 100,
      status: rd.milestonesHit.status,
    },
    {
      label: "Time Elapsed",
      current: rd.timeElapsed.current,
      target: `/ ${rd.timeElapsed.total}`,
      progress: 50,
      status: rd.timeElapsed.status,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Metric cards grid */}
      <div className="grid grid-cols-2 gap-4">
        {metricCards.map((card) => (
          <div key={card.label} className="border border-border rounded-xl p-4 bg-card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] text-muted-foreground">{card.label}</p>
              <Badge className={cn(
                "text-[10px] font-semibold",
                card.status === "on_track"
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-50"
              )}>
                {card.status === "on_track" ? (
                  <><CheckCircle2 className="w-3 h-3 mr-1" />On Track</>
                ) : (
                  <><AlertTriangle className="w-3 h-3 mr-1" />At Risk</>
                )}
              </Badge>
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-2xl font-bold">{card.current}</span>
              <span className="text-[12px] text-muted-foreground">{card.target}</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  card.status === "on_track" ? "bg-emerald-500" : "bg-amber-500"
                )}
                style={{ width: `${card.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Milestone Timeline */}
      <div className="border border-border rounded-xl p-5 bg-card">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[13px]">🎯</span>
          <h3 className="text-[14px] font-semibold">Milestone Timeline</h3>
        </div>
        <div className="space-y-0">
          {rd.milestones.map((m, i) => (
            <div key={m.name} className="flex items-start gap-3 relative">
              {/* Timeline line */}
              {i < rd.milestones.length - 1 && (
                <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-border" />
              )}
              {/* Dot */}
              <div className={cn(
                "w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 z-10",
                m.status === "complete" ? "bg-emerald-500" :
                m.status === "at_risk" ? "bg-amber-500" : "bg-muted"
              )}>
                {m.status === "complete" && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
              <div className="pb-5">
                <p className={cn(
                  "text-[13px] font-medium",
                  m.status === "pending" ? "text-muted-foreground" : "text-foreground"
                )}>{m.name}</p>
                <p className="text-[11px] text-muted-foreground">{m.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   AGENT WORKFLOW PANEL (right side)
   ============================================================ */
function AgentWorkflowPanel() {
  return (
    <div className="w-[280px] border-l border-border flex-shrink-0 flex flex-col bg-background overflow-y-auto hidden lg:flex">
      <div className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4">Agent Workflow</p>
        <div className="space-y-0">
          {agentWorkflowSteps.map((step, i) => (
            <div key={step.id} className="flex items-start gap-3 relative">
              {/* Timeline line */}
              {i < agentWorkflowSteps.length - 1 && (
                <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-border" />
              )}
              {/* Status dot */}
              <div className={cn(
                "w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 z-10",
                step.status === "completed" ? "bg-emerald-500" :
                step.status === "running" ? "bg-blue-500" : "bg-muted"
              )}>
                {step.status === "completed" && <CheckCircle2 className="w-3 h-3 text-white" />}
                {step.status === "running" && <Loader2 className="w-3 h-3 text-white animate-spin" />}
              </div>
              <div className="pb-5">
                <p className="text-[12.5px] font-medium text-foreground">{step.name}</p>
                <p className="text-[10.5px] text-muted-foreground">{step.agent} · {step.duration}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Approval Required */}
      <div className="mt-auto p-3">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-[12px] font-bold text-red-700">Approval Required</p>
          </div>
          <p className="text-[11.5px] text-amber-800 leading-relaxed">{approvalRequired.text}</p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   EVIDENCE & PROVENANCE PANEL (right side, replaces Agent Workflow)
   ============================================================ */
function EvidencePanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="w-[320px] border-l border-border flex-shrink-0 flex flex-col bg-background overflow-y-auto hidden lg:flex">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <p className="text-[13px] font-semibold">Evidence & Provenance</p>
          <span className="text-[11px] text-muted-foreground">{evidenceClaims.length} claims</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 space-y-2.5 flex-1">
        {evidenceClaims.map((claim) => (
          <div key={claim.id} className={cn(
            "rounded-xl p-4 border",
            claim.tierLevel === 1 ? "bg-emerald-50/50 border-emerald-200" :
            claim.tierLevel === 2 ? "bg-blue-50/50 border-blue-200" :
            "bg-amber-50/50 border-amber-200"
          )}>
            <p className="text-[13px] font-semibold text-foreground mb-2">{claim.text}</p>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn(
                "text-[9px] font-bold",
                claim.tierLevel === 1 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                claim.tierLevel === 2 ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                "bg-amber-100 text-amber-700 hover:bg-amber-100"
              )}>
                {claim.tier}
              </Badge>
              <span className="text-[10.5px] text-muted-foreground">{claim.source}</span>
              <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    claim.confidence >= 90 ? "bg-emerald-500" :
                    claim.confidence >= 70 ? "bg-blue-500" :
                    claim.confidence >= 60 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${claim.confidence}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-semibold">{claim.confidence}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
