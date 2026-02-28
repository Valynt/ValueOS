/**
 * Zod validation schemas for company onboarding forms
 * Provides type-safe validation for the 5-phase onboarding flow
 */

import { z } from "zod";

// ============================================
// Shared Enums
// ============================================

export const CompanySizeSchema = z.enum(["smb", "mid_market", "enterprise"]);
export const SalesMotionSchema = z.enum(["new_logo", "expansion", "land_and_expand", "renewal"]);
export const ProductTypeSchema = z.enum(["platform", "module", "service", "add_on"]);
export const RelationshipSchema = z.enum(["direct", "indirect", "incumbent", "emerging"]);
export const PersonaTypeSchema = z.enum(["decision_maker", "champion", "influencer", "end_user", "blocker"]);
export const SenioritySchema = z.enum(["c_suite", "vp", "director", "manager", "individual_contributor"]);
export const RiskLevelSchema = z.enum(["safe", "conditional", "high_risk"]);
export const ClaimCategorySchema = z.enum(["revenue", "cost", "risk", "productivity", "compliance"]);

// ============================================
// URL Validation Helper
// ============================================

const urlSchema = z
  .string()
  .url("Invalid URL format")
  .optional()
  .or(z.literal(""));

// ============================================
// Phase 1: Company Profile + Products
// ============================================

const ProductInputSchema = z.object({
  name: z.string().min(1, "Product name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional().default(""),
  product_type: ProductTypeSchema.default("module"),
});

export const OnboardingPhase1Schema = z.object({
  company_name: z.string().min(1, "Company name is required").max(100, "Name too long"),
  website_url: urlSchema,
  industry: z.string().max(100, "Industry name too long").optional().default(""),
  company_size: CompanySizeSchema.nullable(),
  sales_motion: SalesMotionSchema.nullable(),
  products: z.array(ProductInputSchema).min(1, "At least one product is required"),
});

// ============================================
// Phase 2: Competitive Landscape
// ============================================

const CompetitorInputSchema = z.object({
  name: z.string().min(1, "Competitor name is required").max(100, "Name too long"),
  website_url: urlSchema,
  relationship: RelationshipSchema,
});

export const OnboardingPhase2Schema = z.object({
  competitors: z.array(CompetitorInputSchema).min(1, "At least one competitor is required"),
});

// ============================================
// Phase 3: Buyer Personas
// ============================================

const PersonaInputSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  persona_type: PersonaTypeSchema,
  seniority: SenioritySchema,
  typical_kpis: z.array(z.string().max(100, "KPI too long")).max(10, "Too many KPIs").default([]),
  pain_points: z.array(z.string().max(200, "Pain point too long")).max(10, "Too many pain points").default([]),
});

export const OnboardingPhase3Schema = z.object({
  personas: z.array(PersonaInputSchema).min(1, "At least one persona is required"),
});

// ============================================
// Phase 4: Claim Governance
// ============================================

const ClaimInputSchema = z.object({
  claim_text: z.string().min(1, "Claim text is required").max(500, "Claim too long"),
  risk_level: RiskLevelSchema,
  category: ClaimCategorySchema.nullable(),
  rationale: z.string().max(500, "Rationale too long").optional().default(""),
});

export const OnboardingPhase4Schema = z.object({
  claim_governance: z.array(ClaimInputSchema).min(1, "At least one claim is required"),
});

// ============================================
// Type Exports
// ============================================

export type OnboardingPhase1Input = z.infer<typeof OnboardingPhase1Schema>;
export type OnboardingPhase2Input = z.infer<typeof OnboardingPhase2Schema>;
export type OnboardingPhase3Input = z.infer<typeof OnboardingPhase3Schema>;
export type OnboardingPhase4Input = z.infer<typeof OnboardingPhase4Schema>;
