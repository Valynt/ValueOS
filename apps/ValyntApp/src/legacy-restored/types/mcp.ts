/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * Comprehensive type definitions for MCP components to replace 'any' usage
 * and improve type safety across the system.
 */

// ============================================================================
// Base MCP Types
// ============================================================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPInputSchema;
}

export interface MCPInputSchema {
  type: "object";
  properties: Record<string, MCPProperty>;
  required?: string[];
}

export interface MCPProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: MCPProperty;
  minimum?: number;
  maximum?: number;
  default?: any;
  format?: string;
}

export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

export interface MCPContent {
  type: "text" | "resource";
  text?: string;
  resource?: any;
}

// ============================================================================
// Financial Data Types
// ============================================================================

export interface AuthoritativeFinancialsArgs {
  entity_id: string;
  period?: string;
  metrics: string[];
  currency?: string;
}

export interface PrivateEntityEstimatesArgs {
  domain: string;
  proxy_metric?: string;
  industry_code?: string;
}

export interface VerifyClaimAletheiaArgs {
  claim_text: string;
  context_entity: string;
  context_date?: string;
  strict_mode?: boolean;
}

export interface ValueDriverTreeArgs {
  target_cik: string;
  benchmark_naics: string;
  driver_node_id: string;
  simulation_period: string;
}

export interface IndustryBenchmarkArgs {
  identifier: string;
  metric?: string;
}

// ============================================================================
// CRM Types
// ============================================================================

export interface CRMProvider {
  hubspot: "hubspot";
  salesforce: "salesforce";
}

export type CRMProviderType = CRMProvider[keyof CRMProvider];

export interface CRMConnection {
  id: string;
  tenantId: string;
  provider: CRMProviderType;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  instanceUrl?: string;
  hubId?: string;
  scopes: string[];
  status: "active" | "inactive" | "error";
}

export interface CRMModule {
  provider: CRMProviderType;
  searchDeals(params: DealSearchParams): Promise<DealSearchResult>;
  getDeal(dealId: string): Promise<Deal | null>;
  getDealContacts(dealId: string): Promise<Contact[]>;
  getDealActivities(dealId: string, limit: number): Promise<Activity[]>;
  addDealNote(dealId: string, note: string): Promise<boolean>;
  updateDealProperties(dealId: string, properties: Record<string, unknown>): Promise<boolean>;
}

export interface DealSearchParams {
  query?: string;
  companyName?: string;
  stage?: string[];
  minAmount?: number;
  limit?: number;
}

export interface DealSearchResult {
  deals: Deal[];
  total: number;
  hasMore: boolean;
}

export interface Deal {
  id: string;
  name: string;
  amount?: number;
  currency?: string;
  stage: string;
  probability?: number;
  closeDate?: Date;
  ownerId?: string;
  ownerName?: string;
  companyId?: string;
  companyName?: string;
  createdAt: Date;
  updatedAt: Date;
  properties?: Record<string, unknown>;
  externalId?: string;
}

export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  title?: string;
  role?: string;
  companyName?: string;
}

export interface Activity {
  id: string;
  type: string;
  subject: string;
  body?: string;
  occurredAt: Date;
  durationMinutes?: number;
}

export interface MCPCRMServerConfig {
  tenantId: string;
  userId: string;
  enabledProviders: CRMProviderType[];
  refreshTokensAutomatically: boolean;
}

export interface MCPCRMServerToolArgs {
  [key: string]: unknown;
}

export interface MCPCRMToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    provider: CRMProviderType;
    requestDurationMs: number;
  };
}

// ============================================================================
// Phase 3 - Integrated Server Types
// ============================================================================

export interface KPIFormulaArgs {
  kpiId: string;
  industry?: string;
}

export interface CalculateKPIValueArgs {
  kpiId: string;
  inputs: KPIInput[];
}

export interface KPIInput {
  kpiId: string;
  value: number;
  confidence: number;
}

export interface CascadingImpactsArgs {
  rootKpi: string;
  changeAmount: number;
  maxDepth?: number;
}

export interface CausalImpactArgs {
  action: string;
  kpi: string;
  persona: PersonaType;
  industry: IndustryType;
  companySize: CompanySizeType;
}

export interface SimulateActionOutcomeArgs {
  action: string;
  baseline: KPIBaseline[];
  persona: PersonaType;
  industry: IndustryType;
  companySize: CompanySizeType;
}

export interface KPIBaseline {
  kpi: string;
  value: number;
}

export interface CompareScenariosArgs {
  scenarios: BusinessScenario[];
}

export interface BusinessScenario {
  name: string;
  actions: string[];
  baseline: KPIBaseline[];
  persona: PersonaType;
  industry: IndustryType;
  companySize: CompanySizeType;
  timeframe: TimeframeType;
}

export interface GenerateBusinessCaseArgs {
  persona: PersonaType;
  industry: IndustryType;
  companySize: CompanySizeType;
  annualRevenue: number;
  currentKPIs: Record<string, number>;
  selectedActions: string[];
  timeframe: TimeframeType;
  confidenceThreshold?: number;
  scenarioName?: string;
}

export interface ComplianceReportArgs {
  startTime: string;
  endTime: string;
}

// ============================================================================
// Enum Types
// ============================================================================

export type PersonaType =
  | "cfo"
  | "cio"
  | "cto"
  | "coo"
  | "vp_sales"
  | "vp_ops"
  | "vp_engineering"
  | "director_finance"
  | "data_analyst";

export type IndustryType =
  | "saas"
  | "manufacturing"
  | "healthcare"
  | "finance"
  | "retail"
  | "technology"
  | "professional_services";

export type CompanySizeType = "startup" | "scaleup" | "enterprise";

export type TimeframeType = "30d" | "90d" | "180d" | "365d";

// ============================================================================
// Tool Registry Types
// ============================================================================

export interface ToolExecutionContext {
  userId?: string;
  sessionId?: string;
  workflowId?: string;
  agentType?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    duration?: number;
    cost?: number;
    tokensUsed?: number;
    cached?: boolean;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface ToolMetadata {
  version?: string;
  author?: string;
  category?: string;
  tags?: string[];
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}

// ============================================================================
// Connection Pool Types
// ============================================================================

export interface ConnectionConfig {
  maxConnections?: number;
  timeout?: number;
  healthCheckInterval?: number;
  maxIdleTime?: number;
}

export interface Connection<T> {
  instance: T;
  createdAt: number;
  lastUsed: number;
  inUse: boolean;
  healthy: boolean;
}

// ============================================================================
// Audit Trail Types
// ============================================================================

export interface AuditEntry {
  level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";
  category:
    | "VALIDATION"
    | "CALCULATION"
    | "DECISION"
    | "EVIDENCE"
    | "COMPLIANCE"
    | "ERROR"
    | "PERFORMANCE"
    | "SECURITY";
  component: string;
  operation: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  evidence: Array<{
    type: string;
    content: string;
    source: string;
  }>;
  metadata: Record<string, unknown>;
  timestamp: string;
  correlationId?: string;
  sessionId?: string;
  userId?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
