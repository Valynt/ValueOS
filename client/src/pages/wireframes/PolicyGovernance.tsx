/*
 * ValueOS Wireframes — Policy & Governance
 * Replaces: Settings
 * Core shift: From preferences to rules, Domain Packs, and audit trails
 * Layout: Nav rail | Sidebar tabs | Content area
 */
import { motion } from "framer-motion";
import {
  Settings,
  Shield, AlertTriangle, Clock, Eye,
  Package, Sliders, Users, History,
  ChevronRight, ToggleLeft, ToggleRight, Lock,
  Download, FileDown, CheckCircle2, Calendar
} from "lucide-react";
import { useState } from "react";
import { AnnotatedSection, ANNOTATIONS } from "@/components/wireframes/AnnotationOverlay";
import { ResponsivePageLayout } from "@/components/wireframes/ResponsiveNav";

/* ------------------------------------------------------------------ */
/*  Policy Rules                                                       */
/* ------------------------------------------------------------------ */
interface PolicyRule {
  id: string;
  name: string;
  description: string;
  category: string;
  threshold: string;
  action: string;
  enabled: boolean;
  lastTriggered: string;
}

const policyRules: PolicyRule[] = [
  { id: "P1", name: "Max Discount Without VP", description: "Discount percentage that triggers VP-level approval", category: "Pricing", threshold: "15%", action: "Escalate to Decision Desk", enabled: true, lastTriggered: "2 hours ago" },
  { id: "P2", name: "Minimum Confidence for Exec Ready", description: "Confidence score required to promote a case to Executive Ready", category: "Quality", threshold: "70%", action: "Block promotion", enabled: true, lastTriggered: "1 day ago" },
  { id: "P3", name: "Stale Evidence Alert", description: "Days after which evidence is flagged as stale", category: "Evidence", threshold: "180 days", action: "Flag + notify owner", enabled: true, lastTriggered: "3 hours ago" },
  { id: "P4", name: "Assumption Override Audit", description: "Require justification for manual assumption overrides", category: "Quality", threshold: "Always", action: "Require comment + log", enabled: true, lastTriggered: "5 hours ago" },
  { id: "P5", name: "Margin Floor", description: "Minimum gross margin for any value case", category: "Pricing", threshold: "65%", action: "Block + escalate", enabled: true, lastTriggered: "12 hours ago" },
  { id: "P6", name: "Realization Drift Threshold", description: "Variance from model before alerting", category: "Monitoring", threshold: "±15%", action: "Alert + re-evaluate", enabled: false, lastTriggered: "Never" },
];

/* ------------------------------------------------------------------ */
/*  Domain Packs                                                       */
/* ------------------------------------------------------------------ */
interface DomainPack {
  id: string;
  name: string;
  description: string;
  assumptions: number;
  benchmarks: number;
  templates: number;
  status: "active" | "available" | "custom";
}

const domainPacks: DomainPack[] = [
  { id: "DP1", name: "Enterprise IT", description: "Cloud migration, infrastructure modernization, security", assumptions: 24, benchmarks: 18, templates: 6, status: "active" },
  { id: "DP2", name: "SaaS", description: "Platform consolidation, revenue operations, churn reduction", assumptions: 19, benchmarks: 12, templates: 4, status: "active" },
  { id: "DP3", name: "Manufacturing", description: "Supply chain, operational efficiency, quality management", assumptions: 22, benchmarks: 15, templates: 5, status: "active" },
  { id: "DP4", name: "Financial Services", description: "Risk management, compliance automation, trading systems", assumptions: 28, benchmarks: 20, templates: 7, status: "available" },
  { id: "DP5", name: "Healthcare", description: "Clinical workflows, EHR optimization, patient engagement", assumptions: 16, benchmarks: 10, templates: 3, status: "available" },
  { id: "DP6", name: "Acme Corp Custom", description: "Custom assumptions and benchmarks for Acme Corp engagement", assumptions: 8, benchmarks: 3, templates: 2, status: "custom" },
];

/* ------------------------------------------------------------------ */
/*  Agent Permissions                                                  */
/* ------------------------------------------------------------------ */
interface AgentPerm {
  name: string;
  role: string;
  canCreateCases: boolean;
  canValidateAssumptions: boolean;
  canPromoteStages: boolean;
  canModifyPricing: boolean;
  canContactExternal: boolean;
  autonomyLevel: "watch" | "assist" | "autonomous";
}

const agentPerms: AgentPerm[] = [
  { name: "The Strategist", role: "Value Case Composition", canCreateCases: true, canValidateAssumptions: true, canPromoteStages: false, canModifyPricing: false, canContactExternal: false, autonomyLevel: "assist" },
  { name: "The Analyst", role: "Evidence Validation", canCreateCases: false, canValidateAssumptions: true, canPromoteStages: false, canModifyPricing: false, canContactExternal: false, autonomyLevel: "autonomous" },
  { name: "The Modeler", role: "Value Modeling", canCreateCases: false, canValidateAssumptions: false, canPromoteStages: false, canModifyPricing: true, canContactExternal: false, autonomyLevel: "assist" },
  { name: "The Monitor", role: "Realization Tracking", canCreateCases: false, canValidateAssumptions: false, canPromoteStages: false, canModifyPricing: false, canContactExternal: false, autonomyLevel: "autonomous" },
];

/* ------------------------------------------------------------------ */
/*  Nav items                                                          */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/*  Sidebar Tabs                                                       */
/* ------------------------------------------------------------------ */
const tabs = [
  { id: "policies", label: "Policy Rules", icon: Shield },
  { id: "domains", label: "Domain Packs", icon: Package },
  { id: "agents", label: "Agent Permissions", icon: Users },
  { id: "audit", label: "Audit Trail", icon: History },
  { id: "compliance", label: "Compliance Export", icon: FileDown },
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function PolicyGovernance() {
  const [activeTab, setActiveTab] = useState("policies");

  return (
    <ResponsivePageLayout activeHref="/governance">
      {/* Sidebar Tabs — horizontal scroll on mobile, vertical on desktop */}
      <div className="md:w-48 md:border-r border-border flex md:flex-col shrink-0">
        <div className="h-12 border-b border-border hidden md:flex items-center px-4">
          <h1 className="text-sm font-semibold">Governance</h1>
        </div>
        <div className="flex md:flex-1 md:flex-col p-2 gap-0.5 overflow-x-auto md:overflow-x-visible">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[11px] transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Policy Rules Tab */}
        {activeTab === "policies" && (
          <AnnotatedSection annotation={ANNOTATIONS.policyEngine} position="top-right" className="h-full">
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[15px] font-semibold">Policy Rules</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Automated guardrails that govern agent behavior and case progression</p>
              </div>
              <button className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors">
                + Add Rule
              </button>
            </div>
            <div className="space-y-3">
              {policyRules.map((rule, i) => (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  className="p-4 rounded-lg bg-card border border-border hover:border-primary/15 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-mono text-muted-foreground">{rule.id}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{rule.category}</span>
                      </div>
                      <h3 className="text-[12px] font-medium mb-0.5">{rule.name}</h3>
                      <p className="text-[10px] text-muted-foreground mb-2">{rule.description}</p>
                      <div className="flex items-center gap-4 text-[10px]">
                        <span className="text-muted-foreground">Threshold: <span className="text-foreground font-mono font-medium">{rule.threshold}</span></span>
                        <span className="text-muted-foreground">Action: <span className="text-foreground">{rule.action}</span></span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Last triggered: {rule.lastTriggered}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      {rule.enabled ? (
                        <ToggleRight className="w-6 h-6 text-health" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          </AnnotatedSection>
        )}

        {/* Domain Packs Tab */}
        {activeTab === "domains" && (
          <AnnotatedSection annotation={ANNOTATIONS.domainPacks} position="top-right" className="h-full">
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[15px] font-semibold">Domain Packs</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Industry-specific assumptions, benchmarks, and value templates</p>
              </div>
              <button className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors">
                + Create Custom Pack
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {domainPacks.map((pack, i) => (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                    pack.status === "active" ? "bg-card border-health/20 hover:border-health/40" :
                    pack.status === "custom" ? "bg-card border-primary/20 hover:border-primary/40" :
                    "bg-card border-border hover:border-primary/15"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package className={`w-4 h-4 ${
                        pack.status === "active" ? "text-health" :
                        pack.status === "custom" ? "text-primary" :
                        "text-muted-foreground"
                      }`} />
                      <h3 className="text-[12px] font-medium">{pack.name}</h3>
                    </div>
                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
                      pack.status === "active" ? "bg-health/10 text-health" :
                      pack.status === "custom" ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>{pack.status}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-3">{pack.description}</p>
                  <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
                    <span>{pack.assumptions} assumptions</span>
                    <span>{pack.benchmarks} benchmarks</span>
                    <span>{pack.templates} templates</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          </AnnotatedSection>
        )}

        {/* Agent Permissions Tab */}
        {activeTab === "agents" && (
          <div className="p-6">
            <div className="mb-5">
              <h2 className="text-[15px] font-semibold">Agent Permissions</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Control what each agent can do and at what autonomy level</p>
            </div>
            <div className="space-y-3">
              {agentPerms.map((agent, i) => (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  className="p-4 rounded-lg bg-card border border-border"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-[12px] font-semibold">{agent.name}</h3>
                      <p className="text-[10px] text-muted-foreground">{agent.role}</p>
                    </div>
                    <span className={`text-[9px] font-mono px-2 py-1 rounded-md ${
                      agent.autonomyLevel === "autonomous" ? "bg-health/10 text-health border border-health/20" :
                      agent.autonomyLevel === "assist" ? "bg-primary/10 text-primary border border-primary/20" :
                      "bg-muted text-muted-foreground border border-border"
                    }`}>{agent.autonomyLevel}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: "Create Cases", value: agent.canCreateCases },
                      { label: "Validate Assumptions", value: agent.canValidateAssumptions },
                      { label: "Promote Stages", value: agent.canPromoteStages },
                      { label: "Modify Pricing", value: agent.canModifyPricing },
                      { label: "Contact External", value: agent.canContactExternal },
                    ].map((perm) => (
                      <div key={perm.label} className={`flex flex-col items-center gap-1 py-2 rounded-md ${perm.value ? "bg-health/5" : "bg-muted/30"}`}>
                        {perm.value ? (
                          <ToggleRight className="w-4 h-4 text-health" />
                        ) : (
                          <Lock className="w-3 h-3 text-muted-foreground/40" />
                        )}
                        <span className="text-[8px] text-muted-foreground text-center">{perm.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Compliance Export Tab */}
        {activeTab === "compliance" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[15px] font-semibold">Compliance Export</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Generate audit-ready reports for regulatory compliance and internal governance reviews</p>
              </div>
            </div>

            {/* Export Templates */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { name: "SOC 2 Audit Package", desc: "Complete evidence chain, policy enforcement logs, and agent permission history", format: "PDF + CSV", lastExport: "Feb 28, 2026", sections: ["Policy Rules", "Audit Trail", "Agent Permissions", "Evidence Provenance"] },
                { name: "Revenue Recognition Report", desc: "Value case projections vs. realization data for ASC 606 compliance", format: "XLSX", lastExport: "Mar 1, 2026", sections: ["Value Cases", "Realization Data", "Variance Analysis"] },
                { name: "Deal Desk Approval Log", desc: "All approval decisions, escalations, and policy exceptions with timestamps", format: "PDF", lastExport: "Mar 5, 2026", sections: ["Decision Desk", "Policy Exceptions", "Approval Chain"] },
                { name: "Evidence Integrity Report", desc: "Source provenance, tier classifications, confidence scores, and staleness flags", format: "PDF + JSON", lastExport: "Never", sections: ["Evidence Graph", "Provenance Chains", "Tier Distribution"] },
              ].map((tmpl, i) => (
                <motion.div
                  key={tmpl.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  className="p-4 rounded-lg bg-card border border-border hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileDown className="w-4 h-4 text-primary" />
                      <h3 className="text-[12px] font-semibold">{tmpl.name}</h3>
                    </div>
                    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tmpl.format}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-3">{tmpl.desc}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tmpl.sections.map((s) => (
                      <span key={s} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-primary/5 text-primary/70 border border-primary/10">{s}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      Last: {tmpl.lastExport}
                    </span>
                    <button className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-[10px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                      <Download className="w-3 h-3" />
                      Export
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Scheduled Exports */}
            <div className="mb-6">
              <h3 className="text-[13px] font-semibold mb-3">Scheduled Exports</h3>
              <div className="space-y-2">
                {[
                  { name: "Weekly Deal Desk Summary", schedule: "Every Monday 9:00 AM", recipients: "vp-sales@company.com, cfo@company.com", enabled: true },
                  { name: "Monthly SOC 2 Package", schedule: "1st of each month", recipients: "compliance@company.com", enabled: true },
                  { name: "Quarterly Revenue Report", schedule: "Q1/Q2/Q3/Q4 close + 5 days", recipients: "finance@company.com", enabled: false },
                ].map((sched, i) => (
                  <div key={sched.name} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                    {sched.enabled ? (
                      <CheckCircle2 className="w-4 h-4 text-health shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-[11px] font-medium">{sched.name}</p>
                      <p className="text-[9px] text-muted-foreground">{sched.schedule} → {sched.recipients}</p>
                    </div>
                    {sched.enabled ? (
                      <ToggleRight className="w-5 h-5 text-health" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Export Builder */}
            <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <Sliders className="w-4 h-4 text-primary" />
                <h3 className="text-[12px] font-semibold">Custom Export Builder</h3>
              </div>
              <p className="text-[10px] text-muted-foreground mb-3">Select data sources, date ranges, and output format to create a custom compliance report</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">Data Sources</label>
                  <div className="space-y-1">
                    {["Policy Rules", "Audit Trail", "Evidence Graph", "Decision Desk", "Value Cases", "Realization Data"].map((src) => (
                      <label key={src} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                        <input type="checkbox" className="rounded border-border" defaultChecked={["Policy Rules", "Audit Trail"].includes(src)} />
                        {src}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">Date Range</label>
                  <div className="space-y-1.5">
                    <input type="date" className="w-full h-7 px-2 rounded-md bg-background border border-border text-[10px]" defaultValue="2026-01-01" />
                    <input type="date" className="w-full h-7 px-2 rounded-md bg-background border border-border text-[10px]" defaultValue="2026-03-10" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">Output Format</label>
                  <div className="space-y-1">
                    {["PDF Report", "CSV Data", "JSON (API)", "XLSX Workbook"].map((fmt) => (
                      <label key={fmt} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                        <input type="radio" name="format" className="border-border" defaultChecked={fmt === "PDF Report"} />
                        {fmt}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button className="mt-3 h-8 px-4 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Generate Custom Export
              </button>
            </div>
          </div>
        )}

        {/* Audit Trail Tab */}
        {activeTab === "audit" && (
          <div className="p-6">
            <div className="mb-5">
              <h2 className="text-[15px] font-semibold">Audit Trail</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Complete log of all policy triggers, approvals, and overrides</p>
            </div>
            <div className="space-y-0">
              {[
                { time: "12 min ago", actor: "The Strategist", action: "Triggered P1 — Discount exceeds 15%", target: "Stark Industries", type: "trigger" as const },
                { time: "1 hour ago", actor: "The Analyst", action: "Requested case promotion to Executive Ready", target: "Acme Corp", type: "request" as const },
                { time: "3 hours ago", actor: "Sarah Chen", action: "Overrode assumption A4 with manual estimate", target: "Acme Corp", type: "override" as const },
                { time: "5 hours ago", actor: "The Strategist", action: "Triggered P5 — Margin below 65%", target: "Stark Industries", type: "trigger" as const },
                { time: "1 day ago", actor: "System", action: "Flagged E4 as stale (>180 days)", target: "Forrester Report", type: "system" as const },
                { time: "1 day ago", actor: "James Park", action: "Approved case promotion to Executive Ready", target: "Initech", type: "approval" as const },
                { time: "2 days ago", actor: "The Monitor", action: "Detected realization drift +18%", target: "Wayne Enterprises", type: "trigger" as const },
              ].map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-card/50 transition-colors"
                >
                  <span className="text-[9px] font-mono text-muted-foreground w-20 shrink-0">{entry.time}</span>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    entry.type === "trigger" ? "bg-warning" :
                    entry.type === "override" ? "bg-risk" :
                    entry.type === "approval" ? "bg-health" :
                    entry.type === "request" ? "bg-primary" :
                    "bg-muted-foreground"
                  }`} />
                  <span className="text-[11px] font-medium w-28 shrink-0">{entry.actor}</span>
                  <span className="text-[11px] text-foreground/70 flex-1">{entry.action}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{entry.target}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ResponsivePageLayout>
  );
}
