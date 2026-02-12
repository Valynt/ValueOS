/**
 * ValueOS Configuration & Settings Matrix
 * 
 * Comprehensive configuration management system distinguishing between:
 * - Tenant Admin: Customer organization administrators
 * - Vendor Admin: ValueOS Platform Team/Super Admin
 * 
 * Based on the Configuration & Settings Matrix specification
 */

import { logger } from '../lib/logger';

/**
 * Access level for configuration settings
 */
export type AccessLevel = 'tenant_admin' | 'vendor_admin' | 'view_only' | 'none';

/**
 * Configuration category
 */
export type ConfigCategory = 
  | 'multi_tenant'
  | 'iam'
  | 'ai_orchestration'
  | 'operational'
  | 'security'
  | 'billing';

// ============================================================================
// 1. Multi-Tenant & Organization Settings
// ============================================================================

/**
 * Tenant lifecycle status
 */
export type TenantStatus = 'active' | 'trial' | 'suspended' | 'archived';

/**
 * Data residency region
 */
export type DataResidency = 'us-east-1' | 'us-west-2' | 'eu-west-1' | 'ap-southeast-1';

/**
 * Tenant provisioning configuration
 */
export interface TenantProvisioningConfig {
  /** Organization ID */
  organizationId: string;
  /** Tenant status */
  status: TenantStatus;
  /** Trial end date (if applicable) */
  trialEndDate?: Date;
  /** Maximum users allowed */
  maxUsers: number;
  /** Maximum storage (GB) */
  maxStorageGB: number;
  /** Created date */
  createdAt: Date;
  /** Last updated */
  updatedAt: Date;
}

/**
 * Custom branding configuration
 */
export interface CustomBrandingConfig {
  /** Organization ID */
  organizationId: string;
  /** Logo URL */
  logoUrl?: string;
  /** Favicon URL */
  faviconUrl?: string;
  /** Primary brand color */
  primaryColor: string;
  /** Secondary brand color */
  secondaryColor?: string;
  /** Font family */
  fontFamily?: string;
  /** Custom CSS */
  customCss?: string;
}

/**
 * Data residency configuration
 */
export interface DataResidencyConfig {
  /** Organization ID */
  organizationId: string;
  /** Primary region */
  primaryRegion: DataResidency;
  /** Backup region */
  backupRegion?: DataResidency;
  /** Data sovereignty requirements */
  sovereigntyRequirements?: string[];
}

/**
 * Domain management configuration
 */
export interface DomainManagementConfig {
  /** Organization ID */
  organizationId: string;
  /** Custom subdomain */
  subdomain: string;
  /** Custom domain (if applicable) */
  customDomain?: string;
  /** SSL certificate status */
  sslStatus: 'active' | 'pending' | 'expired';
  /** SSL certificate expiry */
  sslExpiry?: Date;
}

/**
 * Namespace isolation configuration
 */
export interface NamespaceIsolationConfig {
  /** Organization ID */
  organizationId: string;
  /** Database schema prefix */
  schemaPrefix: string;
  /** Storage bucket prefix */
  bucketPrefix: string;
  /** Dedicated infrastructure */
  dedicatedInfra: boolean;
}

// ============================================================================
// 2. Identity & Access Management (IAM)
// ============================================================================

/**
 * Authentication policy configuration
 */
export interface AuthPolicyConfig {
  /** Organization ID */
  organizationId: string;
  /** Enforce MFA */
  enforceMFA: boolean;
  /** Enable WebAuthn */
  enableWebAuthn: boolean;
  /** Enable passwordless login */
  enablePasswordless: boolean;
  /** Password complexity requirements */
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    expiryDays?: number;
  };
}

/**
 * SSO/SAML configuration
 * 
 * NOTE: SSO/SAML is not currently implemented.
 * This interface is reserved for future enterprise features.
 * Current authentication uses Supabase (email/password + OAuth).
 */
export interface SSOConfig {
  /** Organization ID */
  organizationId: string;
  /** SSO provider */
  provider: 'okta' | 'azure_ad' | 'google' | 'custom';
  /** SAML metadata URL */
  metadataUrl?: string;
  /** OIDC client ID */
  clientId?: string;
  /** OIDC client secret (encrypted) */
  clientSecretEncrypted?: string;
  /** SSO enabled */
  enabled: boolean;
  /** Auto-provision users */
  autoProvision: boolean;
}

/**
 * Session control configuration
 */
export interface SessionControlConfig {
  /** Organization ID */
  organizationId: string;
  /** Session timeout (minutes) */
  timeoutMinutes: number;
  /** Idle timeout (minutes) */
  idleTimeoutMinutes: number;
  /** Maximum concurrent sessions */
  maxConcurrentSessions: number;
  /** Remember me duration (days) */
  rememberMeDays?: number;
}

/**
 * Value roles (RBAC)
 */
export type ValueRole = 
  | 'architect'      // Can design value models
  | 'auditor'        // Can review and audit
  | 'analyst'        // Can analyze data
  | 'contributor'    // Can contribute data
  | 'viewer';        // Read-only access

/**
 * Role assignment configuration
 */
export interface RoleAssignmentConfig {
  /** User ID */
  userId: string;
  /** Organization ID */
  organizationId: string;
  /** Assigned roles */
  roles: ValueRole[];
  /** Custom permissions */
  customPermissions?: string[];
}

/**
 * IP whitelisting configuration
 */
export interface IPWhitelistConfig {
  /** Organization ID */
  organizationId: string;
  /** Enabled */
  enabled: boolean;
  /** Allowed CIDR blocks */
  allowedCIDRs: string[];
  /** Bypass for specific users */
  bypassUsers?: string[];
}

// ============================================================================
// 3. AI Orchestration & Agent Fabric
// ============================================================================

/**
 * LLM spending limits configuration
 */
export interface LLMSpendingLimitsConfig {
  /** Organization ID */
  organizationId: string;
  /** Monthly hard cap (USD) */
  monthlyHardCap: number;
  /** Monthly soft cap (USD) - triggers warning */
  monthlySoftCap: number;
  /** Per-request limit (USD) */
  perRequestLimit: number;
  /** Alert threshold percentage */
  alertThreshold: number;
  /** Alert recipients */
  alertRecipients: string[];
}

/**
 * Model routing configuration
 */
export interface ModelRoutingConfig {
  /** Organization ID */
  organizationId: string;
  /** Default model */
  defaultModel: string;
  /** Task-specific routing rules */
  routingRules: {
    taskType: string;
    preferredModel: string;
    fallbackModel?: string;
  }[];
  /** Enable auto-downgrade */
  enableAutoDowngrade: boolean;
}

/**
 * Agent toggles configuration
 */
export interface AgentTogglesConfig {
  /** Organization ID */
  organizationId: string;
  /** Enabled agents */
  enabledAgents: {
    opportunityAgent: boolean;
    targetAgent: boolean;
    assumptionAgent: boolean;
    riskAgent: boolean;
    valueAgent: boolean;
  };
}

/**
 * HITL (Human-in-the-Loop) thresholds configuration
 */
export interface HITLThresholdsConfig {
  /** Organization ID */
  organizationId: string;
  /** Confidence threshold for auto-approval */
  autoApprovalThreshold: number;
  /** Confidence threshold for human review */
  humanReviewThreshold: number;
  /** Confidence threshold for rejection */
  rejectionThreshold: number;
  /** Reviewers */
  reviewers: string[];
}

/**
 * Ground truth sync configuration
 */
export interface GroundTruthSyncConfig {
  /** Organization ID */
  organizationId: string;
  /** MCP endpoint */
  mcpEndpoint: string;
  /** Sync frequency (hours) */
  syncFrequencyHours: number;
  /** Last sync timestamp */
  lastSyncAt?: Date;
  /** Enabled data sources */
  enabledSources: string[];
}

/**
 * Formula versioning configuration
 */
export interface FormulaVersioningConfig {
  /** Organization ID */
  organizationId: string;
  /** Active formula version */
  activeVersion: string;
  /** Available versions */
  availableVersions: string[];
  /** Auto-update enabled */
  autoUpdate: boolean;
}

// ============================================================================
// 4. Operational & Performance Settings
// ============================================================================

/**
 * Feature flags configuration
 */
export interface FeatureFlagsConfig {
  /** Organization ID */
  organizationId: string;
  /** Enabled features */
  enabledFeatures: Record<string, boolean>;
  /** Beta features */
  betaFeatures: Record<string, boolean>;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitingConfig {
  /** Organization ID */
  organizationId: string;
  /** Requests per minute */
  requestsPerMinute: number;
  /** Requests per hour */
  requestsPerHour: number;
  /** Requests per day */
  requestsPerDay: number;
  /** Burst allowance */
  burstAllowance: number;
}

/**
 * Observability configuration
 */
export interface ObservabilityConfig {
  /** Organization ID */
  organizationId: string;
  /** OpenTelemetry sampling rate */
  traceSamplingRate: number;
  /** Log verbosity */
  logVerbosity: 'error' | 'warn' | 'info' | 'debug';
  /** Enable metrics */
  enableMetrics: boolean;
  /** Enable distributed tracing */
  enableTracing: boolean;
}

/**
 * Cache management configuration
 */
export interface CacheManagementConfig {
  /** Organization ID */
  organizationId: string;
  /** Cache TTL (seconds) */
  cacheTTL: number;
  /** Enable cache */
  enableCache: boolean;
  /** Cache strategy */
  cacheStrategy: 'lru' | 'lfu' | 'fifo';
}

/**
 * Webhooks configuration
 */
export interface WebhooksConfig {
  /** Organization ID */
  organizationId: string;
  /** Webhook endpoints */
  endpoints: {
    url: string;
    events: string[];
    secret: string;
    enabled: boolean;
  }[];
}

// ============================================================================
// 5. Security, Audit & Governance
// ============================================================================

/**
 * Audit integrity configuration
 */
export interface AuditIntegrityConfig {
  /** Organization ID */
  organizationId: string;
  /** Enable hash chaining */
  enableHashChaining: boolean;
  /** Verification frequency (hours) */
  verificationFrequencyHours: number;
  /** Last verification */
  lastVerificationAt?: Date;
}

/**
 * Retention policies configuration
 */
export interface RetentionPoliciesConfig {
  /** Organization ID */
  organizationId: string;
  /** Data retention (days) */
  dataRetentionDays: number;
  /** Log retention (days) */
  logRetentionDays: number;
  /** Audit retention (days) */
  auditRetentionDays: number;
  /** Financial data retention (years) */
  financialRetentionYears: number;
}

/**
 * Manifesto strictness configuration
 */
export interface ManifestoStrictnessConfig {
  /** Organization ID */
  organizationId: string;
  /** Strictness mode */
  mode: 'warning' | 'hard_block';
  /** Enabled rules */
  enabledRules: string[];
  /** Custom rules */
  customRules?: {
    name: string;
    description: string;
    severity: 'warning' | 'error';
  }[];
}

/**
 * Secret rotation configuration
 */
export interface SecretRotationConfig {
  /** Organization ID */
  organizationId: string;
  /** Auto-rotation enabled */
  autoRotation: boolean;
  /** Rotation frequency (days) */
  rotationFrequencyDays: number;
  /** Last rotation */
  lastRotationAt?: Date;
  /** Next rotation */
  nextRotationAt?: Date;
}

/**
 * RLS monitoring configuration
 */
export interface RLSMonitoringConfig {
  /** Organization ID */
  organizationId: string;
  /** Enable monitoring */
  enabled: boolean;
  /** Alert on policy violations */
  alertOnViolations: boolean;
  /** Performance threshold (ms) */
  performanceThresholdMs: number;
}

// ============================================================================
// 6. Billing & Usage Analytics
// ============================================================================

/**
 * Token dashboard configuration
 */
export interface TokenDashboardConfig {
  /** Organization ID */
  organizationId: string;
  /** Enable real-time updates */
  enableRealTime: boolean;
  /** Refresh interval (seconds) */
  refreshIntervalSeconds: number;
  /** Show cost breakdown */
  showCostBreakdown: boolean;
}

/**
 * Value metering configuration
 */
export interface ValueMeteringConfig {
  /** Organization ID */
  organizationId: string;
  /** Metering enabled */
  enabled: boolean;
  /** Billable milestones */
  billableMilestones: string[];
  /** Pricing model */
  pricingModel: 'per_milestone' | 'per_user' | 'per_value';
}

/**
 * Subscription plan configuration
 */
export type SubscriptionTier = 'free' | 'professional' | 'enterprise';

export interface SubscriptionPlanConfig {
  /** Organization ID */
  organizationId: string;
  /** Current tier */
  tier: SubscriptionTier;
  /** Billing cycle */
  billingCycle: 'monthly' | 'annual';
  /** Next billing date */
  nextBillingDate: Date;
  /** Auto-renew */
  autoRenew: boolean;
}

/**
 * Invoicing configuration
 */
export interface InvoicingConfig {
  /** Organization ID */
  organizationId: string;
  /** Payment method */
  paymentMethod: 'credit_card' | 'invoice' | 'wire_transfer';
  /** Stripe customer ID */
  stripeCustomerId?: string;
  /** Billing email */
  billingEmail: string;
  /** Billing address */
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

// ============================================================================
// Master Configuration Interface
// ============================================================================

/**
 * Complete organization configuration
 */
export interface OrganizationConfiguration {
  // Multi-Tenant & Organization
  tenantProvisioning: TenantProvisioningConfig;
  customBranding?: CustomBrandingConfig;
  dataResidency: DataResidencyConfig;
  domainManagement?: DomainManagementConfig;
  namespaceIsolation?: NamespaceIsolationConfig;
  
  // IAM
  authPolicy: AuthPolicyConfig;
  ssoConfig?: SSOConfig;
  sessionControl: SessionControlConfig;
  ipWhitelist?: IPWhitelistConfig;
  
  // AI Orchestration
  llmSpendingLimits: LLMSpendingLimitsConfig;
  modelRouting: ModelRoutingConfig;
  agentToggles: AgentTogglesConfig;
  hitlThresholds: HITLThresholdsConfig;
  groundTruthSync?: GroundTruthSyncConfig;
  formulaVersioning: FormulaVersioningConfig;
  
  // Operational
  featureFlags: FeatureFlagsConfig;
  rateLimiting: RateLimitingConfig;
  observability: ObservabilityConfig;
  cacheManagement: CacheManagementConfig;
  webhooks?: WebhooksConfig;
  
  // Security & Governance
  auditIntegrity: AuditIntegrityConfig;
  retentionPolicies: RetentionPoliciesConfig;
  manifestoStrictness: ManifestoStrictnessConfig;
  secretRotation: SecretRotationConfig;
  rlsMonitoring: RLSMonitoringConfig;
  
  // Billing & Usage
  tokenDashboard: TokenDashboardConfig;
  valueMetering: ValueMeteringConfig;
  subscriptionPlan: SubscriptionPlanConfig;
  invoicing: InvoicingConfig;
}

/**
 * Admin IA section that a setting belongs to.
 * Maps to the top-level navigation in the admin control plane.
 * See: docs/architecture/admin-settings-ia.md
 */
export type AdminIASection =
  | 'governance'
  | 'identity'
  | 'security'
  | 'agents'
  | 'data'
  | 'compliance'
  | 'billing'
  | 'platform';

/**
 * Configuration access control
 */
export interface ConfigurationAccess {
  setting: string;
  category: ConfigCategory;
  tenantAdmin: AccessLevel;
  vendorAdmin: AccessLevel;
  description: string;
  /** Admin IA section this setting maps to */
  iaSection?: AdminIASection;
}

/**
 * Configuration access matrix
 */
export const CONFIGURATION_ACCESS_MATRIX: ConfigurationAccess[] = [
  // Multi-Tenant & Organization → Governance
  { setting: 'tenantProvisioning', category: 'multi_tenant', tenantAdmin: 'none', vendorAdmin: 'tenant_admin', description: 'Create/Delete Orgs, manage lifecycle', iaSection: 'platform' },
  { setting: 'customBranding', category: 'multi_tenant', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'SDUI theme config', iaSection: 'governance' },
  { setting: 'dataResidency', category: 'multi_tenant', tenantAdmin: 'none', vendorAdmin: 'tenant_admin', description: 'Geographic pinning of data', iaSection: 'governance' },
  { setting: 'domainManagement', category: 'multi_tenant', tenantAdmin: 'view_only', vendorAdmin: 'tenant_admin', description: 'Custom subdomains and SSL', iaSection: 'governance' },
  { setting: 'namespaceIsolation', category: 'multi_tenant', tenantAdmin: 'none', vendorAdmin: 'tenant_admin', description: 'DB Schema/Bucket prefix', iaSection: 'platform' },
  
  // IAM → Identity & Access / Security Posture
  { setting: 'authPolicy', category: 'iam', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Enforce MFA, WebAuthn', iaSection: 'security' },
  { setting: 'ssoConfig', category: 'iam', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Configure OIDC or SAML', iaSection: 'security' },
  { setting: 'sessionControl', category: 'iam', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Timeout durations', iaSection: 'security' },
  { setting: 'roleAssignment', category: 'iam', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Assign Value Roles', iaSection: 'identity' },
  { setting: 'customRoleMapping', category: 'iam', tenantAdmin: 'view_only', vendorAdmin: 'tenant_admin', description: 'Map platform permissions', iaSection: 'identity' },
  { setting: 'ipWhitelist', category: 'iam', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Restrict access to CIDR blocks', iaSection: 'security' },
  
  // AI Orchestration → Agent Governance
  { setting: 'llmSpendingLimits', category: 'ai_orchestration', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Hard/Soft monthly caps', iaSection: 'agents' },
  { setting: 'modelRouting', category: 'ai_orchestration', tenantAdmin: 'none', vendorAdmin: 'tenant_admin', description: 'Global model selection rules', iaSection: 'agents' },
  { setting: 'agentToggles', category: 'ai_orchestration', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Enable/Disable agents', iaSection: 'agents' },
  { setting: 'hitlThresholds', category: 'ai_orchestration', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Confidence scores for HITL', iaSection: 'agents' },
  { setting: 'groundTruthSync', category: 'ai_orchestration', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'MCP data ingestion config', iaSection: 'data' },
  { setting: 'formulaVersioning', category: 'ai_orchestration', tenantAdmin: 'view_only', vendorAdmin: 'tenant_admin', description: 'Structural Truth versions', iaSection: 'agents' },
  
  // Operational → Platform / Data
  { setting: 'featureFlags', category: 'operational', tenantAdmin: 'none', vendorAdmin: 'tenant_admin', description: 'Phased rollouts', iaSection: 'platform' },
  { setting: 'rateLimiting', category: 'operational', tenantAdmin: 'none', vendorAdmin: 'tenant_admin', description: 'API throttles', iaSection: 'platform' },
  { setting: 'observability', category: 'operational', tenantAdmin: 'none', vendorAdmin: 'tenant_admin', description: 'Sampling rates and log verbosity', iaSection: 'platform' },
  { setting: 'cacheManagement', category: 'operational', tenantAdmin: 'none', vendorAdmin: 'tenant_admin', description: 'Manual flush of Redis keys', iaSection: 'platform' },
  { setting: 'webhooks', category: 'operational', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Outbound event subscriptions', iaSection: 'data' },
  
  // Security & Governance → Compliance & Audit / Security Posture
  { setting: 'auditIntegrity', category: 'security', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Verify hash chains', iaSection: 'compliance' },
  { setting: 'retentionPolicies', category: 'security', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Data/Log lifecycle', iaSection: 'compliance' },
  { setting: 'manifestoStrictness', category: 'security', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Warning vs Hard Block', iaSection: 'agents' },
  { setting: 'secretRotation', category: 'security', tenantAdmin: 'none', vendorAdmin: 'tenant_admin', description: 'Encryption key management', iaSection: 'security' },
  { setting: 'rlsMonitoring', category: 'security', tenantAdmin: 'none', vendorAdmin: 'tenant_admin', description: 'RLS performance auditing', iaSection: 'platform' },
  
  // Billing & Usage → Billing & Usage
  { setting: 'tokenDashboard', category: 'billing', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Real-time LLM costs', iaSection: 'billing' },
  { setting: 'valueMetering', category: 'billing', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Value Milestones tracking', iaSection: 'billing' },
  { setting: 'subscriptionPlan', category: 'billing', tenantAdmin: 'view_only', vendorAdmin: 'tenant_admin', description: 'Tier management', iaSection: 'billing' },
  { setting: 'invoicing', category: 'billing', tenantAdmin: 'tenant_admin', vendorAdmin: 'tenant_admin', description: 'Payment methods and history', iaSection: 'billing' },
];

/**
 * Check if user has access to a configuration setting
 */
export function hasConfigAccess(
  setting: string,
  userRole: 'tenant_admin' | 'vendor_admin' | 'user',
  requiredLevel: AccessLevel = 'tenant_admin'
): boolean {
  const config = CONFIGURATION_ACCESS_MATRIX.find(c => c.setting === setting);
  
  if (!config) {
    logger.warn('Configuration setting not found in access matrix', { setting });
    return false;
  }
  
  const userAccess = userRole === 'vendor_admin' 
    ? config.vendorAdmin 
    : userRole === 'tenant_admin'
    ? config.tenantAdmin
    : 'none';
  
  // Access level hierarchy: tenant_admin > view_only > none
  const accessLevels: AccessLevel[] = ['none', 'view_only', 'tenant_admin', 'vendor_admin'];
  const userLevel = accessLevels.indexOf(userAccess);
  const requiredLevelIndex = accessLevels.indexOf(requiredLevel);
  
  return userLevel >= requiredLevelIndex;
}

/**
 * Get accessible settings for user role
 */
export function getAccessibleSettings(
  userRole: 'tenant_admin' | 'vendor_admin' | 'user',
  category?: ConfigCategory
): ConfigurationAccess[] {
  return CONFIGURATION_ACCESS_MATRIX.filter(config => {
    if (category && config.category !== category) {
      return false;
    }
    
    const access = userRole === 'vendor_admin' 
      ? config.vendorAdmin 
      : userRole === 'tenant_admin'
      ? config.tenantAdmin
      : 'none';
    
    return access !== 'none';
  });
}

