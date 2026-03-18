/**
 * Billing v2 Types
 *
 * Types for meters, price versions, usage policies, approvals, and entitlements.
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const AggregationTypeSchema = z.enum(["sum", "count", "unique_count", "max", "min"]);

export type AggregationType = z.infer<typeof AggregationTypeSchema>;

export const PriceVersionStatusSchema = z.enum(["draft", "active", "archived"]);

export type PriceVersionStatus = z.infer<typeof PriceVersionStatusSchema>;

export const EnforcementTypeSchema = z.enum(["hard_lock", "grace_then_lock"]);

export type EnforcementType = z.infer<typeof EnforcementTypeSchema>;

export const ApprovalActionTypeSchema = z.enum([
  "plan_change",
  "seat_change",
  "cancellation",
  "usage_override",
]);

export type ApprovalActionType = z.infer<typeof ApprovalActionTypeSchema>;

export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected", "expired", "canceled"]);

export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

// ============================================================================
// Billing Meter (Global Catalog)
// ============================================================================

export interface DimensionSchema {
  name: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
}

export const BillingMeterSchema = z.object({
  meter_key: z.string(),
  display_name: z.string(),
  unit: z.string(),
  aggregation: AggregationTypeSchema,
  dimensions_schema: z.array(z.custom<DimensionSchema>()),
  created_at: z.string().datetime(),
});

export type BillingMeter = z.infer<typeof BillingMeterSchema>;

// ============================================================================
// Billing Price Version
// ============================================================================

export interface PriceTierDefinition {
  base_price: number;
  currency: string;
  billing_interval: "month" | "year";
  included_quantities: Record<string, number>; // meter_key -> quantity
  overage_rates: Record<string, number>; // meter_key -> rate per unit
}

export const BillingPriceVersionSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  version_tag: z.string(),
  plan_tier: z.string(),
  definition: z.custom<PriceTierDefinition>(),
  status: PriceVersionStatusSchema,
  activated_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

export type BillingPriceVersion = z.infer<typeof BillingPriceVersionSchema>;

export type BillingPriceVersionInsert = Omit<BillingPriceVersion, "id" | "created_at">;

// ============================================================================
// Usage Policy
// ============================================================================

export const UsagePolicySchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  meter_key: z.string(),
  enforcement: EnforcementTypeSchema,
  grace_percent: z.number().min(0).max(100).optional(),
  lock_message_template_key: z.string().optional(),
  effective_start: z.string().datetime(),
  effective_end: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

export type UsagePolicy = z.infer<typeof UsagePolicySchema>;

export type UsagePolicyInsert = Omit<UsagePolicy, "id" | "created_at">;

// ============================================================================
// Billing Approval Policy
// ============================================================================

export interface ThresholdConfig {
  metric: "absolute_delta" | "percentage_delta" | "new_monthly_cost";
  operator: "gt" | "gte" | "lt" | "lte";
  value: number;
}

export const BillingApprovalPolicySchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  action_type: ApprovalActionTypeSchema,
  thresholds: z.array(z.custom<ThresholdConfig>()),
  required_approver_roles: z.array(z.string()),
  sla_hours: z.number().positive(),
  created_at: z.string().datetime(),
});

export type BillingApprovalPolicy = z.infer<typeof BillingApprovalPolicySchema>;

export type BillingApprovalPolicyInsert = Omit<BillingApprovalPolicy, "id" | "created_at">;

// ============================================================================
// Billing Approval Request
// ============================================================================

export const BillingApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  requested_by_user_id: z.string().uuid(),
  action_type: z.string(),
  payload: z.record(z.unknown()),
  computed_delta: z.record(z.unknown()),
  status: ApprovalStatusSchema,
  approved_by_user_id: z.string().uuid().optional(),
  decision_reason: z.string().optional(),
  effective_at: z.string().datetime().optional(),
  expires_at: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type BillingApprovalRequest = z.infer<typeof BillingApprovalRequestSchema>;

export type BillingApprovalRequestInsert = Omit<BillingApprovalRequest, "id" | "created_at" | "updated_at">;

// ============================================================================
// Entitlement Snapshot
// ============================================================================

export interface Entitlement {
  meter_key: string;
  included_quantity: number;
  current_usage: number;
  remaining: number;
  resets_at: string;
}

export const EntitlementSnapshotSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  price_version_id: z.string().uuid(),
  entitlements: z.array(z.custom<Entitlement>()),
  effective_at: z.string().datetime(),
  superseded_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

export type EntitlementSnapshot = z.infer<typeof EntitlementSnapshotSchema>;

export type EntitlementSnapshotInsert = Omit<EntitlementSnapshot, "id" | "created_at">;

// ============================================================================
// Domain Events
// ============================================================================

export interface UsageRecordedEvent {
  type: "UsageRecorded";
  tenant_id: string;
  meter_key: string;
  value: number;
  timestamp: string;
}

export interface SubscriptionChangedEvent {
  type: "SubscriptionChanged";
  tenant_id: string;
  subscription_id: string;
  previous_status: string;
  new_status: string;
  timestamp: string;
}

export interface BillingApprovalRequestedEvent {
  type: "BillingApprovalRequested";
  tenant_id: string;
  approval_id: string;
  action_type: ApprovalActionType;
  requested_by: string;
  timestamp: string;
}

export interface BillingApprovalDecidedEvent {
  type: "BillingApprovalDecided";
  tenant_id: string;
  approval_id: string;
  decision: "approved" | "rejected";
  decided_by: string;
  timestamp: string;
}

export type BillingDomainEvent =
  | UsageRecordedEvent
  | SubscriptionChangedEvent
  | BillingApprovalRequestedEvent
  | BillingApprovalDecidedEvent;
