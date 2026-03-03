// ValueOS Mock Data Layer
// All entities follow the schema from the ValueOS spec

export interface Organization {
  id: string;
  name: string;
  slug: string;
  tier: "starter" | "growth" | "enterprise";
}

export interface Tenant {
  id: string;
  name: string;
  color: string;
  role: "member" | "manager" | "admin";
}

export interface Opportunity {
  id: string;
  name: string;
  status: "open" | "qualified" | "in_progress" | "won" | "lost";
  owner: string;
  ownerAvatar?: string;
  valuePotential: number;
  createdAt: string;
  activeCaseStage?: string;
  activeCaseConfidence?: number;
  description?: string;
  tenantId: string;
}

export interface ValueCase {
  id: string;
  opportunityId: string;
  name: string;
  stage: "discovery" | "modeling" | "validation" | "narrative" | "realization" | "expansion";
  status: "running" | "paused" | "failed" | "completed";
  confidence: number;
  totalValue: number;
  lastUpdated: string;
  owner: string;
}

export interface ValueModel {
  id: string;
  name: string;
  version: string;
  status: "draft" | "active" | "archived";
  kpiCount: number;
  usedByCount: number;
  category: string;
  description: string;
  lastUpdated: string;
}

export interface KPI {
  id: string;
  modelId: string;
  name: string;
  category: string;
  formula: string;
  baseline: number;
  target: number;
  unit: string;
}

export interface Agent {
  id: string;
  name: string;
  type: "extraction" | "modeling" | "narrative" | "integrity" | "red_team" | "ground_truth";
  version: string;
  isActive: boolean;
  successRate: number;
  costLast7Days: number;
  runsLast7Days: number;
  description: string;
  lastRun: string;
}

export interface AgentRun {
  id: string;
  agentId: string;
  agentName: string;
  status: "success" | "failed" | "running" | "cancelled";
  duration: number;
  tokensUsed: number;
  cost: number;
  startedAt: string;
  caseId?: string;
  opportunityId?: string;
  output?: string;
}

export interface Integration {
  id: string;
  name: string;
  type: "crm" | "comms" | "ground_truth" | "llm";
  provider: string;
  connected: boolean;
  lastSync?: string;
  errorCount: number;
  status: "healthy" | "degraded" | "error" | "disconnected";
  icon: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
  details: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "member" | "viewer";
  status: "active" | "invited" | "suspended";
  lastActive: string;
  avatar?: string;
}

export interface Notification {
  id: string;
  type: "checkpoint" | "veto" | "failure" | "success" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

// --- Mock Data ---

export const organization: Organization = {
  id: "org_1",
  name: "Valynt Intelligence",
  slug: "valynt",
  tier: "enterprise",
};

export const tenants: Tenant[] = [
  { id: "t_1", name: "Acme Global", color: "#4338CA", role: "admin" },
  { id: "t_2", name: "TechCorp EMEA", color: "#059669", role: "manager" },
  { id: "t_3", name: "Meridian Partners", color: "#D97706", role: "member" },
];

export const opportunities: Opportunity[] = [
  {
    id: "opp_1", name: "Cloud Migration ROI", status: "in_progress", owner: "Jane Doe",
    valuePotential: 1200000, createdAt: "2026-01-15", activeCaseStage: "discovery",
    activeCaseConfidence: 88, description: "Quantify the total cost of ownership reduction from migrating legacy on-prem infrastructure to multi-cloud.", tenantId: "t_1",
  },
  {
    id: "opp_2", name: "EMEA Sales Efficiency", status: "in_progress", owner: "Marcus Chen",
    valuePotential: 840000, createdAt: "2026-01-22", activeCaseStage: "modeling",
    activeCaseConfidence: 92, description: "Model the revenue impact of consolidating EMEA sales operations and implementing AI-driven lead scoring.", tenantId: "t_1",
  },
  {
    id: "opp_3", name: "Supply Chain Optimization", status: "qualified", owner: "Sarah Kim",
    valuePotential: 2100000, createdAt: "2026-02-01", description: "Evaluate end-to-end supply chain digitization including predictive demand planning and automated procurement.", tenantId: "t_1",
  },
  {
    id: "opp_4", name: "Customer Success Platform", status: "open", owner: "Alex Rivera",
    valuePotential: 560000, createdAt: "2026-02-10", description: "Build the business case for a unified customer success platform to reduce churn and increase NRR.", tenantId: "t_1",
  },
  {
    id: "opp_5", name: "Data Warehouse Modernization", status: "won", owner: "Jane Doe",
    valuePotential: 3200000, createdAt: "2025-11-05", activeCaseStage: "realization",
    activeCaseConfidence: 96, description: "Completed value case for migrating from legacy data warehouse to modern lakehouse architecture.", tenantId: "t_1",
  },
  {
    id: "opp_6", name: "DevOps Transformation", status: "in_progress", owner: "Marcus Chen",
    valuePotential: 780000, createdAt: "2026-02-15", activeCaseStage: "validation",
    activeCaseConfidence: 74, description: "Quantify developer productivity gains from CI/CD pipeline modernization and platform engineering.", tenantId: "t_1",
  },
];

export const valueCases: ValueCase[] = [
  { id: "vc_1", opportunityId: "opp_1", name: "Cloud TCO Analysis", stage: "discovery", status: "running", confidence: 88, totalValue: 1200000, lastUpdated: "2026-03-02T14:30:00Z", owner: "Jane Doe" },
  { id: "vc_2", opportunityId: "opp_2", name: "EMEA Revenue Model", stage: "modeling", status: "paused", confidence: 92, totalValue: 840000, lastUpdated: "2026-03-01T09:15:00Z", owner: "Marcus Chen" },
  { id: "vc_3", opportunityId: "opp_5", name: "Lakehouse Business Case", stage: "realization", status: "completed", confidence: 96, totalValue: 3200000, lastUpdated: "2026-02-28T16:45:00Z", owner: "Jane Doe" },
  { id: "vc_4", opportunityId: "opp_6", name: "DevOps ROI Model", stage: "validation", status: "running", confidence: 74, totalValue: 780000, lastUpdated: "2026-03-02T11:20:00Z", owner: "Marcus Chen" },
];

export const valueModels: ValueModel[] = [
  { id: "m_1", name: "Cloud Migration TCO", version: "2.1", status: "active", kpiCount: 12, usedByCount: 8, category: "Infrastructure", description: "Total cost of ownership model for cloud migration scenarios including compute, storage, networking, and operational costs.", lastUpdated: "2026-02-20" },
  { id: "m_2", name: "Sales Efficiency ROI", version: "1.3", status: "active", kpiCount: 8, usedByCount: 5, category: "Revenue", description: "Revenue impact model for sales process optimization including lead scoring, pipeline velocity, and win rate improvements.", lastUpdated: "2026-02-18" },
  { id: "m_3", name: "Customer Retention Value", version: "3.0", status: "active", kpiCount: 15, usedByCount: 12, category: "Customer Success", description: "Comprehensive model for customer lifetime value, churn prediction, and expansion revenue forecasting.", lastUpdated: "2026-02-25" },
  { id: "m_4", name: "DevOps Productivity", version: "1.0", status: "draft", kpiCount: 6, usedByCount: 2, category: "Engineering", description: "Developer productivity and deployment frequency model for DevOps transformation initiatives.", lastUpdated: "2026-03-01" },
  { id: "m_5", name: "Supply Chain Digital Twin", version: "1.2", status: "active", kpiCount: 18, usedByCount: 3, category: "Operations", description: "End-to-end supply chain optimization model with demand forecasting, inventory optimization, and logistics efficiency.", lastUpdated: "2026-02-15" },
  { id: "m_6", name: "AI/ML Platform ROI", version: "2.0", status: "archived", kpiCount: 10, usedByCount: 0, category: "Data & AI", description: "Return on investment model for enterprise AI/ML platform adoption including model development, deployment, and monitoring costs.", lastUpdated: "2025-12-10" },
];

export const kpis: KPI[] = [
  { id: "k_1", modelId: "m_1", name: "Infrastructure Cost Reduction", category: "Cost", formula: "(baseline_cost - cloud_cost) / baseline_cost", baseline: 2400000, target: 1440000, unit: "USD" },
  { id: "k_2", modelId: "m_1", name: "Deployment Frequency", category: "Velocity", formula: "deployments_per_month", baseline: 4, target: 30, unit: "deploys/mo" },
  { id: "k_3", modelId: "m_1", name: "Time to Market", category: "Velocity", formula: "avg_feature_delivery_days", baseline: 90, target: 21, unit: "days" },
  { id: "k_4", modelId: "m_2", name: "Win Rate", category: "Revenue", formula: "won_deals / total_deals", baseline: 22, target: 35, unit: "%" },
  { id: "k_5", modelId: "m_2", name: "Pipeline Velocity", category: "Revenue", formula: "qualified_opps * avg_deal_size * win_rate / sales_cycle", baseline: 180000, target: 420000, unit: "USD/mo" },
];

export const agents: Agent[] = [
  { id: "a_1", name: "ExtractionAgent", type: "extraction", version: "2.4", isActive: true, successRate: 97.2, costLast7Days: 12.40, runsLast7Days: 156, description: "Extracts structured data from financial documents, SEC filings, and market reports using multi-modal LLM analysis.", lastRun: "2026-03-02T15:30:00Z" },
  { id: "a_2", name: "ValueTreeArchitect", type: "modeling", version: "1.8", isActive: true, successRate: 89.5, costLast7Days: 28.60, runsLast7Days: 42, description: "Constructs value tree models from extracted data, generating hierarchical KPI structures and financial projections.", lastRun: "2026-03-02T14:15:00Z" },
  { id: "a_3", name: "NarrativeComposer", type: "narrative", version: "3.1", isActive: true, successRate: 94.8, costLast7Days: 8.20, runsLast7Days: 38, description: "Generates executive-ready business narratives from value models, tailored to stakeholder personas.", lastRun: "2026-03-02T12:45:00Z" },
  { id: "a_4", name: "IntegrityGuard", type: "integrity", version: "2.0", isActive: true, successRate: 99.1, costLast7Days: 5.80, runsLast7Days: 210, description: "Validates claims against ground truth sources, classifies evidence tiers, and computes confidence scores.", lastRun: "2026-03-02T15:45:00Z" },
  { id: "a_5", name: "RedTeamChallenger", type: "red_team", version: "1.2", isActive: true, successRate: 91.3, costLast7Days: 15.90, runsLast7Days: 28, description: "Stress-tests value cases by generating objections, identifying logical gaps, and challenging assumptions.", lastRun: "2026-03-01T18:30:00Z" },
  { id: "a_6", name: "GroundTruthFetcher", type: "ground_truth", version: "2.2", isActive: false, successRate: 85.7, costLast7Days: 3.40, runsLast7Days: 89, description: "Retrieves and classifies evidence from EDGAR, XBRL, market data APIs, and benchmark databases.", lastRun: "2026-03-02T10:00:00Z" },
];

export const agentRuns: AgentRun[] = [
  { id: "r_1", agentId: "a_1", agentName: "ExtractionAgent", status: "success", duration: 12.4, tokensUsed: 8420, cost: 0.08, startedAt: "2026-03-02T15:30:00Z", caseId: "vc_1", opportunityId: "opp_1" },
  { id: "r_2", agentId: "a_2", agentName: "ValueTreeArchitect", status: "failed", duration: 45.2, tokensUsed: 15600, cost: 0.22, startedAt: "2026-03-02T14:15:00Z", caseId: "vc_4", opportunityId: "opp_6", output: "Error: Validation failed on node 'revenue_projection'. Missing baseline data for Q3 2025." },
  { id: "r_3", agentId: "a_4", agentName: "IntegrityGuard", status: "success", duration: 3.1, tokensUsed: 2100, cost: 0.02, startedAt: "2026-03-02T15:45:00Z", caseId: "vc_1", opportunityId: "opp_1" },
  { id: "r_4", agentId: "a_3", agentName: "NarrativeComposer", status: "running", duration: 0, tokensUsed: 0, cost: 0, startedAt: "2026-03-02T16:00:00Z", caseId: "vc_2", opportunityId: "opp_2" },
  { id: "r_5", agentId: "a_5", agentName: "RedTeamChallenger", status: "success", duration: 28.7, tokensUsed: 12300, cost: 0.15, startedAt: "2026-03-01T18:30:00Z", caseId: "vc_3", opportunityId: "opp_5" },
  { id: "r_6", agentId: "a_1", agentName: "ExtractionAgent", status: "success", duration: 8.9, tokensUsed: 6200, cost: 0.06, startedAt: "2026-03-02T13:00:00Z", caseId: "vc_2", opportunityId: "opp_2" },
  { id: "r_7", agentId: "a_6", agentName: "GroundTruthFetcher", status: "success", duration: 5.3, tokensUsed: 3400, cost: 0.03, startedAt: "2026-03-02T10:00:00Z" },
  { id: "r_8", agentId: "a_4", agentName: "IntegrityGuard", status: "success", duration: 2.8, tokensUsed: 1900, cost: 0.02, startedAt: "2026-03-02T14:00:00Z", caseId: "vc_4", opportunityId: "opp_6" },
];

export const integrations: Integration[] = [
  { id: "i_1", name: "Salesforce", type: "crm", provider: "Salesforce", connected: true, lastSync: "2026-03-02T15:00:00Z", errorCount: 0, status: "healthy", icon: "cloud" },
  { id: "i_2", name: "HubSpot", type: "crm", provider: "HubSpot", connected: false, errorCount: 0, status: "disconnected", icon: "circle-dot" },
  { id: "i_3", name: "Slack", type: "comms", provider: "Slack", connected: true, lastSync: "2026-03-02T15:30:00Z", errorCount: 0, status: "healthy", icon: "hash" },
  { id: "i_4", name: "ServiceNow", type: "comms", provider: "ServiceNow", connected: true, lastSync: "2026-03-01T12:00:00Z", errorCount: 3, status: "degraded", icon: "wrench" },
  { id: "i_5", name: "SharePoint", type: "comms", provider: "Microsoft", connected: false, errorCount: 0, status: "disconnected", icon: "folder" },
  { id: "i_6", name: "EDGAR/XBRL", type: "ground_truth", provider: "SEC", connected: true, lastSync: "2026-03-02T06:00:00Z", errorCount: 0, status: "healthy", icon: "file-text" },
  { id: "i_7", name: "Market Data", type: "ground_truth", provider: "Bloomberg", connected: true, lastSync: "2026-03-02T15:45:00Z", errorCount: 1, status: "degraded", icon: "trending-up" },
  { id: "i_8", name: "Together.ai Gateway", type: "llm", provider: "Together.ai", connected: true, lastSync: "2026-03-02T16:00:00Z", errorCount: 0, status: "healthy", icon: "cpu" },
];

export const users: User[] = [
  { id: "u_1", name: "Jane Doe", email: "jane.doe@valynt.io", role: "admin", status: "active", lastActive: "2026-03-02T16:00:00Z" },
  { id: "u_2", name: "Marcus Chen", email: "marcus.chen@valynt.io", role: "manager", status: "active", lastActive: "2026-03-02T15:30:00Z" },
  { id: "u_3", name: "Sarah Kim", email: "sarah.kim@valynt.io", role: "member", status: "active", lastActive: "2026-03-02T14:00:00Z" },
  { id: "u_4", name: "Alex Rivera", email: "alex.rivera@valynt.io", role: "member", status: "active", lastActive: "2026-03-01T18:00:00Z" },
  { id: "u_5", name: "Jordan Taylor", email: "jordan.taylor@valynt.io", role: "viewer", status: "invited", lastActive: "" },
  { id: "u_6", name: "Priya Patel", email: "priya.patel@valynt.io", role: "member", status: "active", lastActive: "2026-03-02T12:00:00Z" },
];

export const notifications: Notification[] = [
  { id: "n_1", type: "checkpoint", title: "Human Checkpoint Required", message: "Cloud TCO Analysis requires approval to proceed from Discovery to Modeling.", timestamp: "2026-03-02T15:30:00Z", read: false, link: "/opportunities/opp_1" },
  { id: "n_2", type: "veto", title: "Integrity Veto", message: "IntegrityGuard flagged 2 claims in EMEA Revenue Model with insufficient evidence.", timestamp: "2026-03-02T14:00:00Z", read: false, link: "/opportunities/opp_2" },
  { id: "n_3", type: "failure", title: "Agent Run Failed", message: "ValueTreeArchitect failed on DevOps ROI Model — missing baseline data.", timestamp: "2026-03-02T14:15:00Z", read: true, link: "/agents/a_2" },
  { id: "n_4", type: "success", title: "Value Case Finalized", message: "Lakehouse Business Case has been finalized and locked.", timestamp: "2026-03-01T16:45:00Z", read: true, link: "/opportunities/opp_5" },
  { id: "n_5", type: "info", title: "New Model Version", message: "Customer Retention Value model updated to v3.0 with expanded churn metrics.", timestamp: "2026-02-25T10:00:00Z", read: true },
];

// Dashboard metrics
export const dashboardMetrics = {
  valuePipeline: { value: 4200000, change: 12 },
  activeValueCases: { value: 18, critical: 4 },
  agentSuccessRate: { value: 94.2, trend: [91, 92, 93, 94, 94.2] },
  integrityVetoes: { value: 2, reviewOpen: 2 },
};

// Helper functions
export function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toFixed(2)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return "—";
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function getStageColor(stage: string): string {
  const colors: Record<string, string> = {
    discovery: "bg-indigo-100 text-indigo-700",
    modeling: "bg-amber-100 text-amber-700",
    validation: "bg-cyan-100 text-cyan-700",
    narrative: "bg-purple-100 text-purple-700",
    realization: "bg-emerald-100 text-emerald-700",
    expansion: "bg-rose-100 text-rose-700",
  };
  return colors[stage] || "bg-zinc-100 text-zinc-700";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    running: "bg-emerald-500",
    paused: "bg-amber-500",
    failed: "bg-red-500",
    completed: "bg-indigo-500",
    success: "bg-emerald-500",
    cancelled: "bg-zinc-400",
    healthy: "bg-emerald-500",
    degraded: "bg-amber-500",
    error: "bg-red-500",
    disconnected: "bg-zinc-300",
    active: "bg-emerald-500",
    invited: "bg-amber-500",
    suspended: "bg-red-500",
    open: "bg-zinc-400",
    qualified: "bg-indigo-400",
    in_progress: "bg-emerald-500",
    won: "bg-emerald-600",
    lost: "bg-red-400",
    draft: "bg-zinc-400",
    archived: "bg-zinc-300",
  };
  return colors[status] || "bg-zinc-400";
}
