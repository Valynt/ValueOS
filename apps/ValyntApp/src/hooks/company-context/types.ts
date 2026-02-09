// Company Value Context — TypeScript types matching the DB schema

export interface CompanyContext {
  id: string;
  tenant_id: string;
  company_name: string;
  website_url: string | null;
  industry: string | null;
  company_size: "smb" | "mid_market" | "enterprise" | null;
  sales_motion: "new_logo" | "expansion" | "land_and_expand" | "renewal" | null;
  annual_revenue: string | null;
  employee_count: number | null;
  onboarding_status: "pending" | "in_progress" | "completed" | "needs_refresh";
  onboarding_completed_at: string | null;
  narrative_doctrine: Record<string, unknown>;
  metadata: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyProduct {
  id: string;
  tenant_id: string;
  context_id: string;
  name: string;
  description: string | null;
  product_type: "platform" | "module" | "service" | "add_on" | null;
  target_industries: string[];
  created_at: string;
  updated_at: string;
}

export interface CompanyCapability {
  id: string;
  tenant_id: string;
  product_id: string;
  capability: string;
  operational_change: string | null;
  economic_lever: string | null;
  confidence: "high" | "medium" | "low";
  created_at: string;
  updated_at: string;
}

export interface CompanyCompetitor {
  id: string;
  tenant_id: string;
  context_id: string;
  name: string;
  website_url: string | null;
  relationship: "direct" | "indirect" | "incumbent" | "emerging" | null;
  differentiated_claims: string[];
  commodity_claims: string[];
  risky_claims: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyPersona {
  id: string;
  tenant_id: string;
  context_id: string;
  title: string;
  persona_type: "decision_maker" | "champion" | "influencer" | "end_user" | "blocker" | null;
  seniority: "c_suite" | "vp" | "director" | "manager" | "individual_contributor" | null;
  typical_kpis: string[];
  pain_points: string[];
  success_metrics: string[];
  created_at: string;
  updated_at: string;
}

export interface CompanyValuePattern {
  id: string;
  tenant_id: string;
  context_id: string;
  pattern_name: string;
  industry: string | null;
  persona_id: string | null;
  capability_id: string | null;
  typical_kpis: Array<{ name: string; category: string; unit: string }>;
  typical_assumptions: Array<{ label: string; baseline: string; target: string }>;
  typical_value_range: { min?: string; max?: string; currency?: string };
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyClaimGovernance {
  id: string;
  tenant_id: string;
  context_id: string;
  claim_text: string;
  risk_level: "safe" | "conditional" | "high_risk";
  category: "revenue" | "cost" | "risk" | "productivity" | "compliance" | null;
  rationale: string | null;
  required_evidence_tier: "tier_1" | "tier_2" | "tier_3" | null;
  auto_flag: boolean;
  created_at: string;
  updated_at: string;
}

// The full hydrated context object consumed by agents and views
export interface CompanyValueContext {
  context: CompanyContext;
  products: CompanyProduct[];
  capabilities: CompanyCapability[];
  competitors: CompanyCompetitor[];
  personas: CompanyPersona[];
  valuePatterns: CompanyValuePattern[];
  claimGovernance: CompanyClaimGovernance[];
}

// Onboarding input shapes (what the user provides)
export interface OnboardingPhase1Input {
  company_name: string;
  website_url: string;
  industry: string;
  company_size: CompanyContext["company_size"];
  sales_motion: CompanyContext["sales_motion"];
  products: Array<{ name: string; description: string; product_type: CompanyProduct["product_type"] }>;
}

export interface OnboardingPhase2Input {
  competitors: Array<{
    name: string;
    website_url?: string;
    relationship: CompanyCompetitor["relationship"];
  }>;
}

export interface OnboardingPhase3Input {
  personas: Array<{
    title: string;
    persona_type: CompanyPersona["persona_type"];
    seniority: CompanyPersona["seniority"];
    typical_kpis: string[];
    pain_points: string[];
  }>;
}

export interface OnboardingPhase4Input {
  claim_governance: Array<{
    claim_text: string;
    risk_level: CompanyClaimGovernance["risk_level"];
    category: CompanyClaimGovernance["category"];
    rationale?: string;
  }>;
}
