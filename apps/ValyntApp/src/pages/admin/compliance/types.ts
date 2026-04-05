export type ComplianceFramework = "SOC2" | "GDPR" | "ISO27001" | "ISO27001" | "CCPA";
export type ControlHealthStatus = "pass" | "warn" | "fail";
export type ComplianceFrameworkAvailability = "available" | "gated";

export interface ControlStatusRecord {
  control_id: string;
  framework: ComplianceFramework;
  status: ControlHealthStatus;
  evidence_ts: string;
  tenant_id: string;
  evidence_pointer: string;
  metric_value: number;
  metric_unit: "percent" | "hours" | "count";
  evidence_recency_minutes: number;
}

export interface ComplianceControlStatusResponse {
  tenant_id: string;
  generated_at: string;
  summary: {
    controls_total: number;
    controls_passing: number;
    controls_warning: number;
    controls_failing: number;
  };
  controls: ControlStatusRecord[];
}

export interface PolicyHistoryEntry {
  id: string;
  policy_key: string;
  previous_value: string | null;
  next_value: string;
  changed_by: string;
  changed_at: string;
  tenant_id: string;
  evidence_pointer: string;
}

export interface RetentionRule {
  id: string;
  data_class: string;
  retention_days: number;
  legal_hold: boolean;
  last_reviewed_at: string;
}

export interface DsrQueueItem {
  id: string;
  request_type: "access" | "erasure" | "rectification";
  subject_ref: string;
  status: "queued" | "in_progress" | "completed";
  submitted_at: string;
  due_at: string;
}

export interface ComplianceFrameworkStatus {
  framework: ComplianceFramework;
  availability: ComplianceFrameworkAvailability;
  selectable: boolean;
  prerequisites_met: boolean;
  gate_label: "prerequisite_gating";
  missing_prerequisites: string[];
}

export interface ComplianceModeStatus {
  tenant_id: string;
  active_modes: ComplianceFramework[];
  framework_statuses: ComplianceFrameworkStatus[];
  strict_enforcement: boolean;
  last_changed_at: string;
}
