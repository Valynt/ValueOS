export type DataAssetType = "supabase_table" | "bullmq_queue";
export type PiiClassification = "none" | "contains_pii";
export type DsrErasureMode = "none" | "anonymize" | "scrub" | "delete";

export interface DsrMapping {
  userColumn?: string;
  tenantColumn?: string;
  exportable: boolean;
  erasure: DsrErasureMode;
}

export interface DataAssetInventoryEntry {
  asset: string;
  type: DataAssetType;
  owner: "Platform";
  piiClassification: PiiClassification;
  dsr: DsrMapping;
}

const NO_DSR: DsrMapping = { exportable: false, erasure: "none" };

/**
 * Canonical machine-readable inventory for backend privacy/compliance checks.
 * Keep this aligned with docs/observability/data-asset-inventory.md.
 */
export const DATA_ASSET_INVENTORY: readonly DataAssetInventoryEntry[] = [
  { asset: "users", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "anonymize", userColumn: "id", tenantColumn: "tenant_id" } },
  { asset: "cases", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "scrub", userColumn: "user_id", tenantColumn: "tenant_id" } },
  { asset: "messages", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "scrub", userColumn: "user_id", tenantColumn: "tenant_id" } },
  { asset: "agent_sessions", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "scrub", userColumn: "user_id", tenantColumn: "tenant_id" } },
  { asset: "agent_memory", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "scrub", userColumn: "user_id", tenantColumn: "tenant_id" } },
  { asset: "audit_logs", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "scrub", userColumn: "user_id", tenantColumn: "tenant_id" } },
  { asset: "hypothesis_outputs", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "delete", userColumn: "created_by", tenantColumn: "tenant_id" } },
  { asset: "integrity_outputs", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "delete", userColumn: "created_by", tenantColumn: "tenant_id" } },
  { asset: "narrative_drafts", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "delete", userColumn: "created_by", tenantColumn: "tenant_id" } },
  { asset: "realization_reports", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "delete", userColumn: "created_by", tenantColumn: "tenant_id" } },
  { asset: "expansion_opportunities", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "delete", userColumn: "created_by", tenantColumn: "tenant_id" } },
  { asset: "value_tree_nodes", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "delete", userColumn: "created_by", tenantColumn: "tenant_id" } },
  { asset: "financial_model_snapshots", type: "supabase_table", owner: "Platform", piiClassification: "contains_pii", dsr: { exportable: true, erasure: "delete", userColumn: "created_by", tenantColumn: "tenant_id" } },
  { asset: "semantic_memory", type: "supabase_table", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
  { asset: "agent_audit_log", type: "supabase_table", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
  { asset: "workflow_checkpoints", type: "supabase_table", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
  { asset: "saga_transitions", type: "supabase_table", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
  { asset: "crm-sync", type: "bullmq_queue", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
  { asset: "crm-webhook", type: "bullmq_queue", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
  { asset: "crm-prefetch", type: "bullmq_queue", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
  { asset: "onboarding-research", type: "bullmq_queue", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
  { asset: "user_tenants", type: "supabase_table", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
  { asset: "memberships", type: "supabase_table", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
  { asset: "compliance_controls", type: "supabase_table", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
  { asset: "pending_subscription_changes", type: "supabase_table", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
  { asset: "crm-dead-letter", type: "bullmq_queue", owner: "Platform", piiClassification: "none", dsr: NO_DSR },
] as const;

export function getPiiAssets(): DataAssetInventoryEntry[] {
  return DATA_ASSET_INVENTORY.filter((entry) => entry.piiClassification === "contains_pii");
}

export function getDsrMappedPiiAssets(): DataAssetInventoryEntry[] {
  return getPiiAssets().filter(
    (entry) => entry.dsr.exportable || entry.dsr.erasure !== "none",
  );
}

export function getUnmappedPiiAssets(): DataAssetInventoryEntry[] {
  return getPiiAssets().filter(
    (entry) => !entry.dsr.userColumn || !entry.dsr.tenantColumn || (!entry.dsr.exportable && entry.dsr.erasure === "none"),
  );
}
