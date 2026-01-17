export type AgentType =
  | "orchestrator"
  | "company-intelligence"
  | "opportunity"
  | "target"
  | "value-mapping"
  | "financial-modeling"
  | "integrity"
  | "adversarial"
  | "realization"
  | "expansion";

export type AuthorityLevel = "read" | "suggest" | "write" | "govern";

export interface Agent {
  id: AgentType;
  name: string;
  shortName: string;
  description: string;
  color: string;
  icon: string;
  phase: "discovery" | "architecture" | "economics" | "realization" | "system";
  authority: AuthorityLevel;
  permissions: string[];
}

export const AGENTS: Record<AgentType, Agent> = {
  orchestrator: {
    id: "orchestrator",
    name: "Orchestrator",
    shortName: "Orch",
    description: "Coordinates all agent activities",
    color: "bg-neutral-600",
    icon: "Cpu",
    phase: "system",
    authority: "govern",
    permissions: ["route-requests", "manage-agents", "access-all-data"],
  },
  "company-intelligence": {
    id: "company-intelligence",
    name: "Company Intelligence",
    shortName: "Intel",
    description: "Research and analyze company data",
    color: "bg-primary",
    icon: "Building2",
    phase: "discovery",
    authority: "read",
    permissions: ["read-external-data", "read-documents", "read-filings"],
  },
  opportunity: {
    id: "opportunity",
    name: "Opportunity Agent",
    shortName: "Oppty",
    description: "Identify and qualify opportunities",
    color: "bg-primary/80",
    icon: "Lightbulb",
    phase: "discovery",
    authority: "suggest",
    permissions: ["read-intelligence", "suggest-hypotheses", "draft-scenarios"],
  },
  target: {
    id: "target",
    name: "Target Agent",
    shortName: "Target",
    description: "Define success metrics and KPIs",
    color: "bg-neutral-500",
    icon: "Target",
    phase: "architecture",
    authority: "write",
    permissions: ["read-opportunities", "write-targets", "update-kpis"],
  },
  "value-mapping": {
    id: "value-mapping",
    name: "Value Mapping Agent",
    shortName: "Map",
    description: "Connect features to value drivers",
    color: "bg-primary",
    icon: "GitBranch",
    phase: "architecture",
    authority: "write",
    permissions: ["read-features", "write-mappings", "update-value-tree"],
  },
  "financial-modeling": {
    id: "financial-modeling",
    name: "Financial Modeling Agent",
    shortName: "Finance",
    description: "Build ROI and financial models",
    color: "bg-primary/90",
    icon: "Calculator",
    phase: "economics",
    authority: "write",
    permissions: ["read-mappings", "write-models", "update-calculations"],
  },
  integrity: {
    id: "integrity",
    name: "Integrity Agent",
    shortName: "Verify",
    description: "Validate assumptions and logic",
    color: "bg-neutral-600",
    icon: "ShieldCheck",
    phase: "system",
    authority: "govern",
    permissions: ["read-all-data", "validate-logic", "block-invalid-outputs"],
  },
  adversarial: {
    id: "adversarial",
    name: "Adversarial Reasoning",
    shortName: "Challenge",
    description: "Generate counter-arguments",
    color: "bg-neutral-500",
    icon: "Swords",
    phase: "system",
    authority: "suggest",
    permissions: ["read-all-data", "challenge-assumptions", "flag-risks"],
  },
  realization: {
    id: "realization",
    name: "Realization Agent",
    shortName: "Track",
    description: "Monitor value delivery",
    color: "bg-primary",
    icon: "TrendingUp",
    phase: "realization",
    authority: "write",
    permissions: ["read-actuals", "write-tracking", "trigger-alerts"],
  },
  expansion: {
    id: "expansion",
    name: "Expansion Agent",
    shortName: "Grow",
    description: "Identify upsell opportunities",
    color: "bg-primary/70",
    icon: "Rocket",
    phase: "realization",
    authority: "suggest",
    permissions: ["read-performance", "suggest-expansions", "draft-proposals"],
  },
};

export interface MessageSource {
  type: "document" | "database" | "model" | "constraint";
  label: string;
  reference?: string;
  confidence?: number;
}

export interface AgentMessage {
  id: string;
  agentId: AgentType;
  content: string;
  timestamp: Date;
  type: "insight" | "action" | "challenge" | "validation" | "handoff" | "widget";
  confidence?: number;
  metadata?: Record<string, unknown>;
  sources?: MessageSource[];
  constraints?: string[];
  widget?: {
    type: "slider" | "select" | "confirm" | "scenario";
    config: Record<string, unknown>;
  };
}

export interface AgentHandoff {
  from: AgentType;
  to: AgentType;
  reason: string;
  timestamp: Date;
}

export interface Challenge {
  id: string;
  claim: string;
  counterArgument: string;
  resolution?: string;
  severity: "low" | "medium" | "high";
  status: "pending" | "resolved" | "acknowledged";
}

export interface IntegrityStatus {
  overallScore: number;
  logicCoverage: number;
  dataQuality: number;
  lastVerified: Date;
  issues: Array<{
    type: string;
    message: string;
    severity: "warning" | "error";
  }>;
}
