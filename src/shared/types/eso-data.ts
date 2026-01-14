/**
 * ESO Data Types
 *
 * Moved from src/types/eso-data.ts to shared types location.
 * Contains enterprise system ontology and related data structures.
 */

// ============================================================================
// ESO Core Types
// ============================================================================

export interface ESOSystem {
  id: string;
  name: string;
  description: string;
  version: string;
  status: ESOSystemStatus;
  components: ESOComponent[];
  relationships: ESORelationship[];
  metadata: ESOSystemMetadata;
}

export type ESOSystemStatus = "active" | "inactive" | "development" | "deprecated" | "maintenance";

export interface ESOComponent {
  id: string;
  name: string;
  type: ESOComponentType;
  description: string;
  status: ESOComponentStatus;
  properties: ESOComponentProperties;
  interfaces: ESOInterface[];
  dependencies: string[];
  metadata: ESOComponentMetadata;
}

export type ESOComponentType =
  | "service"
  | "database"
  | "api"
  | "ui"
  | "integration"
  | "workflow"
  | "agent"
  | "data_store"
  | "message_queue"
  | "cache";

export type ESOComponentStatus = "running" | "stopped" | "error" | "deploying" | "unknown";

export interface ESOComponentProperties {
  version: string;
  technology: string;
  environment: string;
  scalability: ESOScalabilityInfo;
  performance: ESOPerformanceInfo;
  security: ESOSecurityInfo;
  compliance: ESOComplianceInfo;
}

export interface ESOInterface {
  id: string;
  name: string;
  type: ESOInterfaceType;
  protocol: string;
  endpoint: string;
  authentication: ESOAuthentication;
  rate_limiting: ESORateLimiting;
  documentation?: string;
}

export type ESOInterfaceType = "rest" | "graphql" | "websocket" | "grpc" | "message" | "event";

export interface ESOAuthentication {
  type: "none" | "api_key" | "oauth" | "jwt" | "basic" | "mTLS";
  config: Record<string, any>;
}

export interface ESORateLimiting {
  enabled: boolean;
  requests_per_second: number;
  burst_size: number;
  strategy: "fixed" | "adaptive" | "token_bucket";
}

export interface ESORelationship {
  id: string;
  source_component_id: string;
  target_component_id: string;
  type: ESORelationshipType;
  description: string;
  properties: ESORelationshipProperties;
  metadata: ESORelationshipMetadata;
}

export type ESORelationshipType =
  | "depends_on"
  | "communicates_with"
  | "manages"
  | "monitors"
  | "triggers"
  | "contains"
  | "extends"
  | "implements";

export interface ESORelationshipProperties {
  frequency?: "real_time" | "batch" | "scheduled" | "on_demand";
  latency?: number;
  reliability?: number;
  data_volume?: "low" | "medium" | "high";
  criticality?: "low" | "medium" | "high" | "critical";
}

// ============================================================================
// Metadata Types
// ============================================================================

export interface ESOSystemMetadata {
  created_at: string;
  updated_at: string;
  created_by: string;
  tags: string[];
  domain: string;
  business_unit: string;
  owner: string;
  stakeholders: string[];
  documentation_links: string[];
  version_history: ESOVersionHistory[];
}

export interface ESOComponentMetadata {
  created_at: string;
  updated_at: string;
  created_by: string;
  repository_url?: string;
  documentation_url?: string;
  monitoring_dashboards: string[];
  alert_channels: string[];
  tags: string[];
  version_history: ESOVersionHistory[];
}

export interface ESORelationshipMetadata {
  created_at: string;
  updated_at: string;
  created_by: string;
  verified_at?: string;
  verified_by?: string;
  confidence_score: number;
  source: "manual" | "automated" | "discovered";
  last_interaction?: string;
}

export interface ESOVersionHistory {
  version: string;
  released_at: string;
  changes: string[];
  breaking_changes: boolean;
  migration_required: boolean;
}

// ============================================================================
// Performance and Scalability Types
// ============================================================================

export interface ESOScalabilityInfo {
  horizontal_scaling: boolean;
  vertical_scaling: boolean;
  auto_scaling: boolean;
  min_instances: number;
  max_instances: number;
  target_cpu_utilization: number;
  target_memory_utilization: number;
  scaling_cooldown: number;
}

export interface ESOPerformanceInfo {
  response_time_p50: number;
  response_time_p95: number;
  response_time_p99: number;
  throughput: number;
  error_rate: number;
  availability: number;
  cpu_utilization: number;
  memory_utilization: number;
  disk_utilization: number;
  network_utilization: number;
}

export interface ESOSecurityInfo {
  encryption_at_rest: boolean;
  encryption_in_transit: boolean;
  vulnerability_scan_date?: string;
  security_score: number;
  compliance_standards: string[];
  access_controls: ESOSecurityControls;
  threat_model: ESOThreatModel;
}

export interface ESOSecurityControls {
  authentication_required: boolean;
  authorization_required: boolean;
  audit_logging: boolean;
  input_validation: boolean;
  output_encoding: boolean;
  rate_limiting: boolean;
  ddos_protection: boolean;
}

export interface ESOThreatModel {
  last_updated: string;
  threats_identified: ESOThreat[];
  mitigations: ESOMitigation[];
  risk_score: number;
}

export interface ESOThreat {
  id: string;
  name: string;
  description: string;
  category: string;
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  cwe_id?: string;
}

export interface ESOMitigation {
  id: string;
  threat_id: string;
  description: string;
  implemented: boolean;
  effectiveness: "low" | "medium" | "high";
  last_reviewed: string;
}

export interface ESOComplianceInfo {
  standards: ESOComplianceStandard[];
  last_audit_date?: string;
  next_audit_date?: string;
  audit_results: ESOAuditResult[];
  compliance_score: number;
}

export interface ESOComplianceStandard {
  name: string;
  version: string;
  scope: string[];
  requirements: ESOComplianceRequirement[];
}

export interface ESOComplianceRequirement {
  id: string;
  name: string;
  description: string;
  category: string;
  mandatory: boolean;
  implemented: boolean;
  evidence: string[];
  last_verified?: string;
}

export interface ESOAuditResult {
  date: string;
  standard: string;
  score: number;
  findings: ESOAuditFinding[];
  recommendations: string[];
  auditor: string;
}

export interface ESOAuditFinding {
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  description: string;
  recommendation: string;
  due_date?: string;
  status: "open" | "in_progress" | "resolved" | "accepted_risk";
}

// ============================================================================
// Monitoring and Observability Types
// ============================================================================

export interface ESOMonitoringConfig {
  enabled: boolean;
  metrics_collection: boolean;
  log_collection: boolean;
  trace_collection: boolean;
  alerting: boolean;
  dashboards: ESODashboard[];
  alerts: ESOAlert[];
}

export interface ESODashboard {
  id: string;
  name: string;
  description: string;
  url: string;
  type: "performance" | "security" | "business" | "operational";
  refresh_interval: number;
  widgets: ESOWidget[];
}

export interface ESOWidget {
  id: string;
  name: string;
  type: "metric" | "chart" | "table" | "text" | "alert";
  query: string;
  visualization: ESOVisualization;
  position: ESOPosition;
  size: ESOSize;
}

export interface ESOVisualization {
  type: "line" | "bar" | "pie" | "gauge" | "heatmap" | "number";
  config: Record<string, any>;
}

export interface ESOPosition {
  x: number;
  y: number;
}

export interface ESOSize {
  width: number;
  height: number;
}

export interface ESOAlert {
  id: string;
  name: string;
  description: string;
  severity: "info" | "warning" | "error" | "critical";
  condition: string;
  threshold: number;
  duration: number;
  enabled: boolean;
  channels: ESOAlertChannel[];
  last_triggered?: string;
  trigger_count: number;
}

export interface ESOAlertChannel {
  type: "email" | "slack" | "pagerduty" | "webhook" | "sms";
  config: Record<string, any>;
  enabled: boolean;
}

// ============================================================================
// Data Flow and Integration Types
// ============================================================================

export interface ESODataFlow {
  id: string;
  name: string;
  description: string;
  source_component_id: string;
  target_component_id: string;
  data_format: string;
  protocol: string;
  frequency: string;
  volume: ESODataVolume;
  quality: ESODataQuality;
  security: ESODataSecurity;
  monitoring: ESODataMonitoring;
}

export interface ESODataVolume {
  records_per_day: number;
  bytes_per_day: number;
  peak_records_per_hour: number;
  growth_rate: number;
}

export interface ESODataQuality {
  completeness_score: number;
  accuracy_score: number;
  validity_score: number;
  timeliness_score: number;
  consistency_score: number;
  last_quality_check: string;
}

export interface ESODataSecurity {
  classification: "public" | "internal" | "confidential" | "restricted";
  encryption_required: boolean;
  access_logging: boolean;
  data_retention_days: number;
  gdpr_applicable: boolean;
}

export interface ESODataMonitoring {
  latency_monitoring: boolean;
  error_monitoring: boolean;
  volume_monitoring: boolean;
  quality_monitoring: boolean;
  security_monitoring: boolean;
  alerts: ESODataAlert[];
}

export interface ESODataAlert {
  metric: string;
  threshold: number;
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  severity: "info" | "warning" | "error" | "critical";
  enabled: boolean;
}

// ============================================================================
// Business Context Types
// ============================================================================

export interface ESOBusinessContext {
  business_capability: string;
  business_process: string;
  business_value: string;
  revenue_impact: ESORevenueImpact;
  cost_impact: ESOCostImpact;
  risk_impact: ESORiskImpact;
  customer_impact: ESOCustomerImpact;
}

export interface ESORevenueImpact {
  direct_revenue: boolean;
  revenue_percentage: number;
  revenue_amount: number;
  growth_contribution: number;
}

export interface ESOCostImpact {
  operational_cost: number;
  maintenance_cost: number;
  licensing_cost: number;
  infrastructure_cost: number;
}

export interface ESORiskImpact {
  financial_risk: "low" | "medium" | "high";
  operational_risk: "low" | "medium" | "high";
  compliance_risk: "low" | "medium" | "high";
  security_risk: "low" | "medium" | "high";
  reputation_risk: "low" | "medium" | "high";
}

export interface ESOCustomerImpact {
  customer_facing: boolean;
  impact_severity: "low" | "medium" | "high" | "critical";
  affected_customers: number;
  sla_impact: boolean;
  customer_satisfaction_impact: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ESOQuery {
  system_id?: string;
  component_id?: string;
  component_type?: ESOComponentType;
  relationship_type?: ESORelationshipType;
  status?: ESOSystemStatus | ESOComponentStatus;
  tags?: string[];
  domain?: string;
  business_capability?: string;
}

export interface ESOAnalysisResult {
  systems: ESOSystem[];
  components: ESOComponent[];
  relationships: ESORelationship[];
  insights: ESOInsight[];
  recommendations: ESORecommendation[];
  metrics: ESOMetrics;
}

export interface ESOInsight {
  id: string;
  type: "performance" | "security" | "architecture" | "business" | "operational";
  title: string;
  description: string;
  severity: "info" | "warning" | "error" | "critical";
  confidence: number;
  evidence: string[];
  related_components: string[];
}

export interface ESORecommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  dependencies: string[];
  implementation_steps: string[];
}

export interface ESOMetrics {
  total_systems: number;
  total_components: number;
  total_relationships: number;
  health_score: number;
  complexity_score: number;
  security_score: number;
  performance_score: number;
  compliance_score: number;
}
