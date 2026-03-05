// ValueOS / VALYNT — Complete Mock Data Layer
// Matches the reference screenshots exactly

export interface Organization {
  id: string;
  name: string;
  plan: string;
  initials: string;
}

export interface Tenant {
  id: string;
  name: string;
  plan: string;
  initials: string;
}

export interface ValueCase {
  id: string;
  caseNumber: string;
  company: string;
  title: string;
  status: "running" | "paused" | "completed" | "committed" | "draft";
  confidence: number;
  version: number;
  currentStage: string;
  totalValue: number;
  owner: string;
  ownerEmail: string;
  lastUpdated: string;
}

export interface Hypothesis {
  id: string;
  caseId: string;
  text: string;
  status: "verified" | "needs_evidence" | "flagged" | "pending";
  confidence: number;
  sources: string;
  evidence: { name: string; type: string }[];
}

export interface IntegrityClaim {
  id: string;
  caseId: string;
  text: string;
  status: "verified" | "flagged";
  tier: string;
  tierLevel: number;
  confidence: number;
  source: string;
  resolution?: string;
  objection?: string;
}

export interface NarrativeData {
  readiness: number;
  components: { name: string; count: string; status: "complete" | "warning" }[];
  documentTypes: string[];
  impactCascade: { category: string; value: number; items: string[] }[];
  executiveSummary: string;
}

export interface RealizationData {
  valueDelivered: { current: number; target: number; status: "on_track" | "at_risk" };
  kpisOnTrack: { current: number; total: number; status: "on_track" | "at_risk" };
  milestonesHit: { current: number; total: number; status: "on_track" | "at_risk" };
  timeElapsed: { current: string; total: string; status: "on_track" | "at_risk" };
  milestones: { name: string; date: string; status: "complete" | "at_risk" | "pending" }[];
}

export interface EvidenceClaim {
  id: string;
  caseId: string;
  text: string;
  tier: string;
  tierLevel: number;
  source: string;
  confidence: number;
}

export interface AgentWorkflowStep {
  id: string;
  name: string;
  agent: string;
  duration: string;
  status: "completed" | "running" | "pending";
}

export interface ApprovalRequired {
  text: string;
}

export interface Agent {
  id: string;
  name: string;
  type: string;
  version: string;
  isActive: boolean;
  successRate: number;
  costLast7Days: number;
  runsLast7Days: number;
  description: string;
  lastRun: string;
}

export interface CompanyIntelItem {
  id: string;
  company: string;
  industry: string;
  revenue: string;
  employees: string;
  source: string;
  lastUpdated: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "member" | "viewer";
  status: "active" | "invited" | "suspended";
  lastActive: string;
}

export interface Notification {
  id: string;
  type: "checkpoint" | "veto" | "failure" | "success" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// --- Mock Data ---

export const currentOrg: Organization = {
  id: "org_1",
  name: "Value Org",
  plan: "Standard",
  initials: "VO",
};

export const tenants: Tenant[] = [
  { id: "t_1", name: "Value Org", plan: "Standard", initials: "VO" },
  { id: "t_2", name: "Acme Corp", plan: "Enterprise", initials: "AC" },
  { id: "t_3", name: "TechVentures", plan: "Growth", initials: "TV" },
];

export const valueCases: ValueCase[] = [
  {
    id: "vc_1", caseNumber: "VC-1024", company: "Acme Corp",
    title: "Enterprise Platform Migration", status: "running", confidence: 87,
    version: 12, currentStage: "integrity", totalValue: 4200000,
    owner: "brian@me.com", ownerEmail: "brian@me.com", lastUpdated: "25m ago",
  },
  {
    id: "vc_2", caseNumber: "VC-1023", company: "Beta Inc",
    title: "Cloud Infrastructure Optimization", status: "committed", confidence: 94,
    version: 8, currentStage: "realization", totalValue: 2100000,
    owner: "sarah@me.com", ownerEmail: "sarah@me.com", lastUpdated: "2h ago",
  },
  {
    id: "vc_3", caseNumber: "VC-1022", company: "Gamma Solutions",
    title: "AI/ML Platform ROI Analysis", status: "running", confidence: 72,
    version: 5, currentStage: "modeling", totalValue: 1800000,
    owner: "brian@me.com", ownerEmail: "brian@me.com", lastUpdated: "1d ago",
  },
  {
    id: "vc_4", caseNumber: "VC-1021", company: "Delta Corp",
    title: "DevOps Transformation Value Case", status: "draft", confidence: 45,
    version: 2, currentStage: "hypothesis", totalValue: 950000,
    owner: "alex@me.com", ownerEmail: "alex@me.com", lastUpdated: "3d ago",
  },
  {
    id: "vc_5", caseNumber: "VC-1020", company: "Epsilon Tech",
    title: "Customer Success Platform", status: "completed", confidence: 96,
    version: 15, currentStage: "realization", totalValue: 3400000,
    owner: "brian@me.com", ownerEmail: "brian@me.com", lastUpdated: "1w ago",
  },
];

export const hypotheses: Hypothesis[] = [
  {
    id: "h_1", caseId: "vc_1",
    text: "Acme's legacy infrastructure costs $45M/yr to maintain — migration could cut this by 60%",
    status: "verified", confidence: 82, sources: "EDGAR 10-K + Gartner benchmark",
    evidence: [
      { name: "10-K FY2025 filing", type: "document" },
      { name: "Gartner IT Spending Benchmark 2025", type: "document" },
    ],
  },
  {
    id: "h_2", caseId: "vc_1",
    text: "APAC expansion is blocked by on-prem scalability — cloud migration unblocks $2.1M in new revenue",
    status: "needs_evidence", confidence: 68, sources: "Earnings call + customer interview",
    evidence: [
      { name: "Q3 2025 Earnings Call Transcript", type: "document" },
    ],
  },
  {
    id: "h_3", caseId: "vc_1",
    text: "Current 99.2% uptime is insufficient for APAC SLA requirements (99.95% needed)",
    status: "verified", confidence: 91, sources: "Customer RFP + SLA docs",
    evidence: [
      { name: "Customer RFP v2.1", type: "document" },
      { name: "Current SLA Dashboard Export", type: "document" },
    ],
  },
];

export const integrityClaims: IntegrityClaim[] = [
  {
    id: "ic_1", caseId: "vc_1",
    text: "IT spend at 7.5% of revenue ($180M)",
    status: "verified", tier: "Tier 2: Market Data", tierLevel: 2,
    confidence: 82, source: "Gartner benchmark + customer estimate",
    resolution: "Cross-referenced with Gartner Manufacturing IT Spending Report 2025. 7.5% is within the 6.8-8.2% range for manufacturing sector.",
  },
  {
    id: "ic_2", caseId: "vc_1",
    text: "APAC expansion will generate $2.1M in new revenue within 18 months",
    status: "flagged", tier: "Tier 3: Self-reported", tierLevel: 3,
    confidence: 58, source: "Customer interview — VP of Strategy",
    objection: "Revenue projection is based on a single customer interview. No market sizing data or competitive analysis to support the $2.1M figure.",
  },
];

export const narrativeData: NarrativeData = {
  readiness: 91,
  components: [
    { name: "Hypotheses", count: "3/3", status: "complete" },
    { name: "Value Model", count: "3 drivers", status: "complete" },
    { name: "Integrity", count: "2 flagged", status: "warning" },
    { name: "Evidence", count: "8 sources", status: "complete" },
  ],
  documentTypes: ["Executive Summary", "Technical Brief", "Financial Case"],
  impactCascade: [
    {
      category: "Infrastructure Cost Reduction", value: 1800000,
      items: ["Server consolidation: 340 → 85 instances", "License optimization: 40% reduction in VMware licensing", "Ops automation: 60% reduction in manual provisioning"],
    },
    {
      category: "Revenue Acceleration", value: 1500000,
      items: ["Time-to-market: 6 weeks → 2 weeks for new features", "APAC expansion: infrastructure ready for 99.95% SLA"],
    },
    {
      category: "Risk Mitigation", value: 900000,
      items: ["Compliance automation: SOC 2 + ISO 27001 continuous", "Disaster recovery: RTO from 24h to 4h"],
    },
  ],
  executiveSummary: "Acme Corp faces a strategic inflection point: their legacy on-premises infrastructure, supporting 340+ applications across 12,400 employees, is constraining their ability to expand into APAC markets — a board-level priority for H1 2026.\nOur analysis, grounded in EDGAR filings, Gartner benchmarks, and direct customer data, identifies $4.2M in projected value across three pillars: infrastructure cost reduction ($1.8M), revenue acceleration ($1.5M), and risk mitigation ($0.9M).\nThe base case projects a 240% ROI with a 14-month payback period. Key assumptions include a 12-month migration timeline and 4:1 server consolidation ratio — both within industry norms for enterprises of this scale.",
};

export const realizationData: RealizationData = {
  valueDelivered: { current: 2100000, target: 4200000, status: "on_track" },
  kpisOnTrack: { current: 6, total: 8, status: "on_track" },
  milestonesHit: { current: 4, total: 7, status: "at_risk" },
  timeElapsed: { current: "6mo", total: "12mo", status: "on_track" },
  milestones: [
    { name: "Phase 1: Assessment Complete", date: "Jan 15", status: "complete" },
    { name: "Phase 2: Pilot Migration (50 servers)", date: "Mar 1", status: "complete" },
    { name: "Phase 3: Production Migration Wave 1", date: "May 15", status: "complete" },
    { name: "Phase 4: Production Migration Wave 2", date: "Jul 30", status: "at_risk" },
    { name: "Phase 5: Full Cutover", date: "Oct 1", status: "pending" },
    { name: "Phase 6: Optimization & Handoff", date: "Dec 15", status: "pending" },
    { name: "Phase 7: Value Realization Report", date: "Jan 15", status: "pending" },
  ],
};

export const evidenceClaims: EvidenceClaim[] = [
  { id: "e_1", caseId: "vc_1", text: "Annual revenue $2.4B", tier: "Tier 1: EDGAR", tierLevel: 1, source: "10-K FY2025", confidence: 98 },
  { id: "e_2", caseId: "vc_1", text: "IT spend 7.5% of revenue", tier: "Tier 2: Market Data", tierLevel: 2, source: "Gartner benchmark", confidence: 82 },
  { id: "e_3", caseId: "vc_1", text: "340 on-prem servers", tier: "Tier 3: Self-reported", tierLevel: 3, source: "Customer interview", confidence: 70 },
  { id: "e_4", caseId: "vc_1", text: "99.2% current uptime", tier: "Tier 1: Customer Data", tierLevel: 1, source: "SLA Dashboard Export", confidence: 95 },
  { id: "e_5", caseId: "vc_1", text: "Server consolidation 4:1 ratio", tier: "Tier 2: Estimate", tierLevel: 2, source: "Engineering assessment", confidence: 72 },
  { id: "e_6", caseId: "vc_1", text: "APAC revenue potential $2.1M", tier: "Tier 3: Self-reported", tierLevel: 3, source: "VP Strategy interview", confidence: 58 },
];

export const agentWorkflowSteps: AgentWorkflowStep[] = [
  { id: "aw_1", name: "Fetched 10-K from EDGAR", agent: "Opportunity Agent", duration: "2m", status: "completed" },
  { id: "aw_2", name: "Extracted financial metrics", agent: "Opportunity Agent", duration: "1m", status: "completed" },
  { id: "aw_3", name: "Competitive landscape analysis", agent: "Research Agent", duration: "3m", status: "completed" },
  { id: "aw_4", name: "Verified revenue claims", agent: "Integrity Agent", duration: "30s", status: "completed" },
  { id: "aw_5", name: "Flagged server consolidation ratio", agent: "Integrity Agent", duration: "15s", status: "completed" },
  { id: "aw_6", name: "Building value tree...", agent: "Target Agent", duration: "—", status: "running" },
];

export const approvalRequired: ApprovalRequired = {
  text: "Value tree includes projected savings of $1.8M. Confirm before proceeding to narrative generation.",
};

export const agents: Agent[] = [
  { id: "a_1", name: "Opportunity Agent", type: "extraction", version: "2.4", isActive: true, successRate: 97.2, costLast7Days: 12.40, runsLast7Days: 156, description: "Extracts structured data from financial documents, SEC filings, and market reports.", lastRun: "2m ago" },
  { id: "a_2", name: "Research Agent", type: "research", version: "1.8", isActive: true, successRate: 89.5, costLast7Days: 28.60, runsLast7Days: 42, description: "Conducts competitive landscape analysis and market research.", lastRun: "3m ago" },
  { id: "a_3", name: "Integrity Agent", type: "integrity", version: "2.0", isActive: true, successRate: 99.1, costLast7Days: 5.80, runsLast7Days: 210, description: "Validates claims against ground truth sources and classifies evidence tiers.", lastRun: "30s ago" },
  { id: "a_4", name: "Target Agent", type: "modeling", version: "3.1", isActive: true, successRate: 94.8, costLast7Days: 8.20, runsLast7Days: 38, description: "Builds value trees and financial projection models.", lastRun: "Running..." },
  { id: "a_5", name: "Narrative Agent", type: "narrative", version: "1.2", isActive: true, successRate: 91.3, costLast7Days: 15.90, runsLast7Days: 28, description: "Generates executive-ready business narratives from value models.", lastRun: "1h ago" },
  { id: "a_6", name: "Red Team Agent", type: "red_team", version: "2.2", isActive: false, successRate: 85.7, costLast7Days: 3.40, runsLast7Days: 89, description: "Stress-tests value cases by generating objections and challenging assumptions.", lastRun: "2h ago" },
];

export const companyIntel: CompanyIntelItem[] = [
  { id: "ci_1", company: "Acme Corp", industry: "Manufacturing", revenue: "$2.4B", employees: "12,400", source: "EDGAR 10-K", lastUpdated: "2d ago" },
  { id: "ci_2", company: "Beta Inc", industry: "Technology", revenue: "$890M", employees: "4,200", source: "Bloomberg", lastUpdated: "1w ago" },
  { id: "ci_3", company: "Gamma Solutions", industry: "Financial Services", revenue: "$1.6B", employees: "8,100", source: "EDGAR 10-K", lastUpdated: "3d ago" },
  { id: "ci_4", company: "Delta Corp", industry: "Healthcare", revenue: "$3.1B", employees: "15,600", source: "Annual Report", lastUpdated: "5d ago" },
];

export const users: User[] = [
  { id: "u_1", name: "Brian", email: "brian@me.com", role: "admin", status: "active", lastActive: "Just now" },
  { id: "u_2", name: "Sarah K.", email: "sarah@me.com", role: "manager", status: "active", lastActive: "2h ago" },
  { id: "u_3", name: "Alex Chen", email: "alex@me.com", role: "member", status: "active", lastActive: "1d ago" },
  { id: "u_4", name: "Jordan T.", email: "jordan@me.com", role: "viewer", status: "invited", lastActive: "" },
];

export const notifications: Notification[] = [
  { id: "n_1", type: "checkpoint", title: "Approval Required", message: "Value tree for VC-1024 needs review before narrative generation.", timestamp: "5m ago", read: false },
  { id: "n_2", type: "veto", title: "Integrity Flag", message: "APAC revenue claim flagged — insufficient evidence.", timestamp: "25m ago", read: false },
  { id: "n_3", type: "success", title: "Case Committed", message: "Beta Inc Cloud Infrastructure case committed.", timestamp: "2h ago", read: true },
];

// Helper functions
export function formatCurrency(value: number): string {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

export function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);
}

// Legacy aliases for backward compatibility
export const organization = currentOrg;

export function formatDate(date: string): string {
  return date;
}

export function timeAgo(date: string): string {
  return date;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "active": return "bg-emerald-50 text-emerald-700";
    case "draft": return "bg-amber-50 text-amber-700";
    case "archived": return "bg-zinc-100 text-zinc-500";
    default: return "bg-muted text-muted-foreground";
  }
}

// Value Models for the Models page
export interface ValueModel {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "active" | "draft" | "archived";
  kpiCount: number;
  usedByCount: number;
  version: number;
  lastUpdated: string;
}

export interface KPI {
  id: string;
  modelId: string;
  name: string;
  formula: string;
  baseline: number;
  target: number;
  unit: string;
  category: string;
}

export const valueModels: ValueModel[] = [
  { id: "vm_1", name: "SaaS ROI Calculator", description: "Standard ROI model for SaaS platform migrations with TCO analysis, payback period, and NPV calculations.", category: "Financial", status: "active", kpiCount: 8, usedByCount: 12, version: 3, lastUpdated: "2d ago" },
  { id: "vm_2", name: "Infrastructure Cost Model", description: "Server consolidation and cloud migration cost-benefit analysis with multi-year projections.", category: "Cost Analysis", status: "active", kpiCount: 6, usedByCount: 8, version: 2, lastUpdated: "1w ago" },
  { id: "vm_3", name: "Revenue Acceleration Model", description: "Time-to-market improvement and revenue impact modeling for platform modernization.", category: "Revenue", status: "active", kpiCount: 5, usedByCount: 5, version: 1, lastUpdated: "3d ago" },
  { id: "vm_4", name: "Risk Mitigation Framework", description: "Compliance, disaster recovery, and operational risk quantification model.", category: "Risk", status: "draft", kpiCount: 4, usedByCount: 3, version: 1, lastUpdated: "5d ago" },
];

export const kpis: KPI[] = [
  { id: "k_1", modelId: "vm_1", name: "Net Present Value", formula: "NPV = Σ(Bt - Ct) / (1+r)^t", baseline: 0, target: 1000000, unit: "USD", category: "Financial" },
  { id: "k_2", modelId: "vm_1", name: "Internal Rate of Return", formula: "IRR where NPV = 0", baseline: 0, target: 15, unit: "%", category: "Financial" },
  { id: "k_3", modelId: "vm_1", name: "Payback Period", formula: "Cumulative CF >= 0", baseline: 36, target: 14, unit: "months", category: "Financial" },
  { id: "k_4", modelId: "vm_2", name: "Server Consolidation Ratio", formula: "Old Servers / New Servers", baseline: 1, target: 4, unit: ":1", category: "Efficiency" },
  { id: "k_5", modelId: "vm_2", name: "Annual OpEx Savings", formula: "Old OpEx - New OpEx", baseline: 0, target: 1800000, unit: "USD", category: "Cost" },
];

// Audit log entries for Settings
export interface AuditEntry {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
}

export const auditLog: AuditEntry[] = [
  { id: "al_1", user: "brian@me.com", action: "Updated", target: "VC-1024 Integrity claims", timestamp: "25m ago" },
  { id: "al_2", user: "sarah@me.com", action: "Committed", target: "VC-1023 Beta Inc case", timestamp: "2h ago" },
  { id: "al_3", user: "brian@me.com", action: "Ran agent", target: "Opportunity Agent on VC-1024", timestamp: "3h ago" },
  { id: "al_4", user: "alex@me.com", action: "Created", target: "VC-1021 Delta Corp case", timestamp: "3d ago" },
  { id: "al_5", user: "brian@me.com", action: "Invited", target: "jordan@me.com as Viewer", timestamp: "5d ago" },
];
