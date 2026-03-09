/**
 * Database row types for Supabase query layer.
 *
 * Derived from the value_cases, domain_packs, and related tables.
 * These types mirror the DB schema and are used by the query services.
 */

export interface ValueCaseRow {
  id: string;
  organization_id: string | null;
  tenant_id: string | null;
  session_id: string | null;
  name: string;
  description: string | null;
  company_profile_id: string | null;
  domain_pack_id: string | null;
  status: "draft" | "review" | "published";
  stage: string | null;
  quality_score: number | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

export interface ValueCaseInsert {
  name: string;
  description?: string;
  tenant_id: string;
  organization_id?: string;
  company_profile_id?: string;
  domain_pack_id?: string;
  status?: "draft" | "review" | "published";
  stage?: string;
  metadata?: Record<string, unknown>;
}

export interface CompanyProfileRow {
  id: string;
  company_name: string;
}

export interface DomainPackRow {
  id: string;
  name: string;
  industry: string;
  slug: string;
}

export interface ValueCaseWithRelations extends ValueCaseRow {
  company_profiles: CompanyProfileRow | null;
  domain_packs: DomainPackRow | null;
}

export interface PortfolioValue {
  totalValue: number;
  caseCount: number;
  avgConfidence: number;
}
