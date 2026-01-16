/**
 * Structural Data Types
 *
 * Moved from src/types/structural-data.ts to shared types location.
 * Contains core data structures used across the application.
 */

// ============================================================================
// Base Entity Types
// ============================================================================

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface TenantEntity extends BaseEntity {
  tenant_id: string;
  organization_id: string;
}

// ============================================================================
// User and Organization Types
// ============================================================================

export interface User extends TenantEntity {
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  preferences?: UserPreferences;
}

export interface Organization extends BaseEntity {
  name: string;
  domain: string;
  plan: OrganizationPlan;
  settings: OrganizationSettings;
  subscription_id?: string;
}

export type UserRole = "super_admin" | "tenant_admin" | "user" | "viewer";
export type OrganizationPlan = "free" | "starter" | "professional" | "enterprise";

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
}

export interface OrganizationSettings {
  allowed_domains: string[];
  sso_enabled: boolean;
  api_access: boolean;
  custom_branding: boolean;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  in_app: boolean;
  digest_frequency: "daily" | "weekly" | "never";
}

// ============================================================================
// Value Case Types
// ============================================================================

export interface ValueCase extends TenantEntity {
  name: string;
  description?: string;
  status: ValueCaseStatus;
  company?: string;
  workflow_state?: WorkflowState;
  tags: string[];
  priority: ValueCasePriority;
  assigned_to?: string;
  due_date?: string;
}

export type ValueCaseStatus = "draft" | "in_progress" | "completed" | "archived";
export type ValueCasePriority = "low" | "medium" | "high" | "urgent";

export interface ValueCaseCreate {
  name: string;
  description?: string;
  company?: string;
  tags?: string[];
  priority?: ValueCasePriority;
  assigned_to?: string;
  due_date?: string;
}

export interface ValueCaseUpdate {
  name?: string;
  description?: string;
  status?: ValueCaseStatus;
  company?: string;
  tags?: string[];
  priority?: ValueCasePriority;
  assigned_to?: string;
  due_date?: string;
}

// ============================================================================
// Workflow State Types
// ============================================================================

export interface WorkflowState extends TenantEntity {
  case_id: string;
  current_stage: WorkflowStage;
  stages: WorkflowStageData[];
  context: WorkflowContext;
  metadata?: WorkflowMetadata;
}

export type WorkflowStage = "target" | "opportunity" | "expansion" | "realization" | "integrity";

export interface WorkflowStageData {
  stage: WorkflowStage;
  status: "pending" | "in_progress" | "completed" | "failed";
  started_at?: string;
  completed_at?: string;
  data?: Record<string, any>;
  errors?: string[];
}

export interface WorkflowContext {
  user_inputs: Record<string, any>;
  agent_outputs: Record<string, any>;
  external_data: Record<string, any>;
  session_data: Record<string, any>;
}

export interface WorkflowMetadata {
  duration_ms?: number;
  agent_versions: Record<string, string>;
  llm_usage?: LLMUsageMetrics;
  quality_score?: number;
}

export interface LLMUsageMetrics {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  model: string;
}

// ============================================================================
// Agent Types
// ============================================================================

export interface Agent extends BaseEntity {
  name: string;
  type: AgentType;
  description: string;
  version: string;
  status: AgentStatus;
  configuration: AgentConfiguration;
  capabilities: AgentCapability[];
  permissions: AgentPermission[];
}

export type AgentType =
  | "orchestrator"
  | "intelligence"
  | "opportunity"
  | "target"
  | "value_mapping"
  | "financial"
  | "integration"
  | "compliance"
  | "reporting"
  | "notification";
export type AgentStatus = "active" | "inactive" | "deprecated" | "error";

export interface AgentConfiguration {
  model: string;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
  retry_attempts: number;
  custom_settings: Record<string, any>;
}

export interface AgentCapability {
  name: string;
  description: string;
  parameters: Record<string, any>;
  required_permissions: string[];
}

export interface AgentPermission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

// ============================================================================
// Integration Types
// ============================================================================

export interface Integration extends TenantEntity {
  name: string;
  type: IntegrationType;
  provider: string;
  status: IntegrationStatus;
  configuration: IntegrationConfiguration;
  credentials: IntegrationCredentials;
  last_sync?: string;
  sync_errors?: string[];
}

export type IntegrationType =
  | "crm"
  | "email"
  | "calendar"
  | "storage"
  | "communication"
  | "analytics"
  | "billing";
export type IntegrationStatus = "connected" | "disconnected" | "error" | "syncing";

export interface IntegrationConfiguration {
  sync_frequency: string;
  data_mapping: Record<string, string>;
  filters: Record<string, any>;
  webhooks: WebhookConfig[];
}

export interface IntegrationCredentials {
  type: "api_key" | "oauth" | "basic" | "custom";
  data: Record<string, any>;
  encrypted: boolean;
}

export interface WebhookConfig {
  event: string;
  url: string;
  headers: Record<string, string>;
  active: boolean;
}

// ============================================================================
// Analytics and Metrics Types
// ============================================================================

export interface AnalyticsEvent extends TenantEntity {
  event_type: string;
  user_id?: string;
  session_id?: string;
  properties: Record<string, any>;
  timestamp: string;
  source: string;
}

export interface Metric extends TenantEntity {
  name: string;
  value: number | string;
  unit?: string;
  tags: Record<string, string>;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Dashboard extends TenantEntity {
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  filters: DashboardFilter[];
  shared_with: string[];
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  query: string;
  visualization: VisualizationConfig;
  position: WidgetPosition;
  size: WidgetSize;
}

export type WidgetType = "metric" | "chart" | "table" | "text" | "list";
export type VisualizationConfig = Record<string, any>;

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface DashboardLayout {
  columns: number;
  row_height: number;
  margin: [number, number];
  container_padding: [number, number];
}

export interface DashboardFilter {
  name: string;
  type: "date" | "select" | "text" | "number";
  field: string;
  options?: string[];
  default_value?: any;
}

// ============================================================================
// API and Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface ResponseMetadata {
  request_id: string;
  timestamp: string;
  duration_ms: number;
  version: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface SearchParams {
  query?: string;
  filters?: Record<string, any>;
  sort?: SortOption[];
  page?: number;
  limit?: number;
}

export interface SortOption {
  field: string;
  direction: "asc" | "desc";
}

export interface ExportOptions {
  format: "json" | "csv" | "xlsx" | "pdf";
  fields?: string[];
  filters?: Record<string, any>;
  include_metadata?: boolean;
}
