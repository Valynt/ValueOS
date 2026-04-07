/**
 * Phase 3 TDD — Shared test fixtures
 *
 * Mock data for Dashboard, Case Listing, Executive Reviewer, and
 * Realization Placeholder test suites.
 */

import type { ValueCaseWithRelations } from "@/lib/supabase/types";

// ============================================================================
// Mock Cases — 6 cases spanning all warmth tiers
// ============================================================================

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

export const MOCK_CASES: ValueCaseWithRelations[] = [
  // Forming (2)
  {
    id: "case-forming-1",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    session_id: null,
    name: "Acme Corp — Value Case",
    description: null,
    company_profile_id: "cp-1",
    domain_pack_id: "dp-1",
    status: "draft",
    stage: "discovery",
    quality_score: 0.3,
    created_at: hoursAgo(48),
    updated_at: hoursAgo(2),
    metadata: {
      agent_status: "running",
      projected_value: 890_000,
      next_action: "Agent mapping value drivers",
    },
    company_profiles: { id: "cp-1", company_name: "Acme Corp" },
    domain_packs: { id: "dp-1", name: "Manufacturing", industry: "manufacturing", slug: "manufacturing" },
  },
  {
    id: "case-forming-2",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    session_id: null,
    name: "Globex Industries — Value Case",
    description: null,
    company_profile_id: "cp-2",
    domain_pack_id: "dp-2",
    status: "draft",
    stage: "discovery",
    quality_score: 0.45,
    created_at: hoursAgo(72),
    updated_at: hoursAgo(1),
    metadata: {
      agent_status: "needs-input",
      projected_value: 1_200_000,
      next_action: "Review flagged assumptions",
    },
    company_profiles: { id: "cp-2", company_name: "Globex Industries" },
    domain_packs: { id: "dp-2", name: "Energy", industry: "energy", slug: "energy" },
  },

  // Firm (2)
  {
    id: "case-firm-1",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    session_id: null,
    name: "Initech — Value Case",
    description: null,
    company_profile_id: "cp-3",
    domain_pack_id: "dp-3",
    status: "review",
    stage: "target",
    quality_score: 0.72,
    created_at: hoursAgo(120),
    updated_at: hoursAgo(4),
    metadata: {
      agent_status: "paused",
      projected_value: 2_400_000,
      next_action: "Output ready for your review",
    },
    company_profiles: { id: "cp-3", company_name: "Initech" },
    domain_packs: { id: "dp-3", name: "SaaS", industry: "saas", slug: "saas" },
  },
  {
    id: "case-firm-2",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    session_id: null,
    name: "Massive Dynamic — Value Case",
    description: null,
    company_profile_id: "cp-4",
    domain_pack_id: "dp-4",
    status: "review",
    stage: "target",
    quality_score: 0.65,
    created_at: hoursAgo(96),
    updated_at: hoursAgo(8),
    metadata: {
      agent_status: "paused",
      projected_value: 1_800_000,
      next_action: "Validate model assumptions",
    },
    company_profiles: { id: "cp-4", company_name: "Massive Dynamic" },
    domain_packs: { id: "dp-4", name: "Financial Services", industry: "finserv", slug: "finserv" },
  },

  // Verified (2)
  {
    id: "case-verified-1",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    session_id: null,
    name: "Umbrella Corp — Value Case",
    description: null,
    company_profile_id: "cp-5",
    domain_pack_id: "dp-5",
    status: "published",
    stage: "narrative",
    quality_score: 0.92,
    created_at: hoursAgo(240),
    updated_at: hoursAgo(24),
    metadata: {
      agent_status: "paused",
      projected_value: 5_100_000,
      next_action: "Share with stakeholders",
    },
    company_profiles: { id: "cp-5", company_name: "Umbrella Corp" },
    domain_packs: { id: "dp-5", name: "Healthcare", industry: "healthcare", slug: "healthcare" },
  },
  {
    id: "case-verified-2",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    session_id: null,
    name: "Wayne Enterprises — Value Case",
    description: null,
    company_profile_id: "cp-6",
    domain_pack_id: "dp-6",
    status: "published",
    stage: "narrative",
    quality_score: 0.88,
    created_at: hoursAgo(200),
    updated_at: hoursAgo(48),
    metadata: {
      agent_status: "paused",
      projected_value: 3_200_000,
      next_action: "Case finalized — export ready",
    },
    company_profiles: { id: "cp-6", company_name: "Wayne Enterprises" },
    domain_packs: { id: "dp-6", name: "Defense", industry: "defense", slug: "defense" },
  },
];

// ============================================================================
// Mock Assumptions — for AssumptionsAtRisk tests
// ============================================================================

export interface MockAssumption {
  id: string;
  name: string;
  confidenceScore: number;
  sourceType: string;
  warmthState: "forming" | "firm" | "verified";
}

export const MOCK_ASSUMPTIONS: MockAssumption[] = [
  { id: "a-1", name: "Market volatility forecast", confidenceScore: 0.3, sourceType: "inferred", warmthState: "forming" },
  { id: "a-2", name: "Training cost estimate", confidenceScore: 0.4, sourceType: "benchmark-derived", warmthState: "forming" },
  { id: "a-3", name: "Close time reduction", confidenceScore: 0.25, sourceType: "inferred", warmthState: "forming" },
  { id: "a-4", name: "Revenue per seat", confidenceScore: 0.85, sourceType: "CRM-derived", warmthState: "verified" },
  { id: "a-5", name: "Renewal rate", confidenceScore: 0.78, sourceType: "customer-confirmed", warmthState: "firm" },
];

// ============================================================================
// Helper: the needs-input case (for sorting tests)
// ============================================================================

export const NEEDS_INPUT_CASE = MOCK_CASES.find(
  (c) => (c.metadata as Record<string, unknown>)?.agent_status === "needs-input",
)!;

export const FORMING_CASES = MOCK_CASES.filter((c) =>
  c.stage?.toLowerCase().includes("discovery"),
);
export const FIRM_CASES = MOCK_CASES.filter((c) =>
  c.stage?.toLowerCase().includes("target"),
);
export const VERIFIED_CASES = MOCK_CASES.filter((c) =>
  c.stage?.toLowerCase().includes("narrat"),
);
