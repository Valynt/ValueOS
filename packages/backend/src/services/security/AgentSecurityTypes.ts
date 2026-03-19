/**
 * Canonical domain types for the agent security services.
 */

import type {
  AuditEvent,
  AuditEventType,
  ResourceType,
} from "./AuditTrailService.js";

export interface SecurityContext {
  tenantId: string;
  userId: string;
  agentId: string;
  sessionId: string;
  permissions: string[];
  roles: string[];
  authenticationMethod: AuthenticationMethod;
  trustLevel: TrustLevel;
  timestamp: number;
}

export interface AuthenticationMethod {
  type: AuthType;
  credentials: AuthCredentials;
  mfaRequired: boolean;
  mfaVerified?: boolean;
  certificateInfo?: CertificateInfo;
}

export interface AuthCredentials {
  apiKey?: string;
  keyId?: string;
  accessToken?: string;
  refreshToken?: string;
  scope?: string;
  certificate?: string;
  privateKey?: string;
  jwt?: string;
  claims?: JWTClaims;
}

export interface CertificateInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  fingerprint: string;
  keyUsage: string[];
}

export interface JWTClaims {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  scope?: string;
  roles?: string[];
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
  riskLevel: RiskLevel;
  auditRequired: boolean;
  mfaRequired: boolean;
  timeRestrictions?: TimeRestrictions;
  locationRestrictions?: LocationRestrictions;
}

export interface PermissionCondition {
  type: ConditionType;
  operator: ConditionOperator;
  value: unknown;
  negate?: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  inheritedRoles?: string[];
  priority: number;
  systemRole: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  type: PolicyType;
  rules: SecurityRule[];
  enabled: boolean;
  priority: number;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  complianceFrameworks: ComplianceFramework[];
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  condition: RuleCondition;
  action: RuleAction;
  severity: RuleSeverity;
  enabled: boolean;
}

export interface ComplianceReport {
  id: string;
  framework: ComplianceFramework;
  status: ComplianceStatus;
  score: number;
  findings: ComplianceFinding[];
  recommendations: ComplianceRecommendation[];
  generatedAt: number;
  nextReviewDate: number;
  approvedBy?: string;
}

export interface AuditTrail {
  id: string;
  eventType: AuditEventType;
  actorId: string;
  actorType: ActorType;
  resourceId: string;
  resourceType: ResourceType;
  action: string;
  outcome: AuditOutcome;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: number;
  sessionId: string;
  correlationId: string;
  riskScore: number;
  complianceFlags: string[];
  tenantId?: string;
}

export interface AuditTrailFilters {
  eventType?: AuditEventType;
  actorId?: string;
  resourceType?: ResourceType;
  timeRange?: { start: number; end: number };
  limit?: number;
}

export interface SecurityIncident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  source: string;
  affectedResources: string[];
  timeline: IncidentEvent[];
  mitigation: IncidentMitigation;
  reportedAt: number;
  resolvedAt?: number;
  assignedTo?: string;
}

export interface SecurityIncidentFilters {
  type?: IncidentType;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  timeRange?: { start: number; end: number };
}

export interface ComplianceScope {
  agents?: string[];
  policies?: string[];
  timeRange?: { start: number; end: number };
}

export interface AuthenticationRequestContext {
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  tenantId: string;
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
  [key: string]: unknown;
}

export type AuthType = "api_key" | "oauth" | "certificate" | "jwt" | "mfa" | "saml";
export type TrustLevel = "untrusted" | "low" | "medium" | "high" | "privileged";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ConditionType = "time" | "location" | "device" | "network" | "resource" | "user";
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "in"
  | "not_in";
export type PolicyType =
  | "access_control"
  | "data_protection"
  | "audit"
  | "encryption"
  | "compliance";
export type ComplianceFramework =
  | "SOC2"
  | "GDPR"
  | "HIPAA"
  | "PCI_DSS"
  | "ISO27001"
  | "NIST"
  | "SOX";
export type ComplianceStatus = "compliant" | "non_compliant" | "partial" | "pending_review";
export type IncidentType =
  | "unauthorized_access"
  | "data_breach"
  | "malicious_activity"
  | "policy_violation"
  | "system_compromise";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed" | "false_positive";
export type RuleSeverity = "info" | "warning" | "error" | "critical";

export interface TimeRestrictions {
  allowedHours: { start: string; end: string }[];
  allowedDays: number[];
  timezone: string;
  holidays: string[];
}

export interface LocationRestrictions {
  allowedCountries: string[];
  allowedIPRanges: string[];
  geoFencing: boolean;
  requireVPN: boolean;
}

export interface PolicyCondition {
  type: string;
  operator: string;
  value: unknown;
}

export interface PolicyAction {
  type: "allow" | "deny" | "log" | "alert" | "quarantine";
  parameters?: Record<string, unknown>;
}

export interface RuleCondition {
  expression: string;
  parameters?: Record<string, unknown>;
}

export interface RuleAction {
  type: string;
  parameters?: Record<string, unknown>;
}

export interface ComplianceFinding {
  id: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  evidence: string[];
  affectedResources: string[];
  remediation: string;
  dueDate: number;
}

export interface ComplianceRecommendation {
  id: string;
  priority: "low" | "medium" | "high";
  description: string;
  implementation: string;
  estimatedEffort: string;
  dependencies: string[];
}

export interface IncidentEvent {
  timestamp: number;
  type: string;
  description: string;
  details: Record<string, unknown>;
}

export interface IncidentMitigation {
  immediate: string[];
  shortTerm: string[];
  longTerm: string[];
  prevention: string[];
}

export interface SecurityConfig {
  zeroTrustEnabled: boolean;
  mfaRequiredForPrivileged: boolean;
  sessionTimeout: number;
  maxFailedAttempts: number;
  lockoutDuration: number;
  auditRetention: number;
  encryptionEnabled: boolean;
  keyRotationInterval: number;
  complianceCheckInterval: number;
}

export interface CredentialValidationResult {
  valid: boolean;
  reason?: string;
  subject?: string;
  permissions?: string[];
  roles?: string[];
  certificateInfo?: CertificateInfo;
}

export interface AuthorizationResult {
  granted: boolean;
  reason: string;
  conditions?: unknown[];
  requiresMFA?: boolean;
  riskScore: number;
}

export interface PermissionCheckResult {
  granted: boolean;
  reason: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason: string;
  conditions?: unknown[];
  requiresMFA?: boolean;
}

export type { ActorType, AuditEventType, AuditOutcome, ResourceType } from "./AuditTrailService.js";
