export * from "./APIKeyRotationService.js";
// Re-export security primitives from the root security module
export {
  RateLimitExceededError,
  setAuthRateLimiter,
  consumeAuthRateLimit,
  resetRateLimit,
  checkPasswordBreach,
  securityEvents,
  fetchWithCSRF,
  sanitizeInput,
  sanitizeObject,
  sanitizeString,
} from "../../security/index.js";
// AgentSecurityService defines ActorType, AuditEventType, AuditOutcome, ResourceType,
// ComplianceFramework, Permission — all duplicated in AuditTrailService, SecurityMiddleware,
// and ComplianceControlStatusService. Use explicit exports to exclude the duplicates.
export type {
  AuditTrail,
  AuthCredentials,
  AuthType,
  AuthenticationMethod,
  AuthorizationResult,
  CertificateInfo,
  ComplianceFinding,
  ComplianceRecommendation,
  ComplianceReport,
  ComplianceStatus,
  ConditionOperator,
  ConditionType,
  CredentialValidationResult,
  IncidentEvent,
  IncidentMitigation,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  JWTClaims,
  LocationRestrictions,
  PermissionCheckResult,
  PermissionCondition,
  PolicyAction,
  PolicyCheckResult,
  PolicyCondition,
  PolicyType,
  RiskLevel,
  Role,
  RuleAction,
  RuleCondition,
  RuleSeverity,
  SecurityConfig,
  SecurityContext,
  SecurityIncident,
  SecurityPolicy,
  SecurityRule,
  TimeRestrictions,
  TrustLevel,
} from "./AgentSecurityService.js";
export { AgentSecurityService, getAgentSecurityService } from "./AgentSecurityService.js";
export * from "./AuditLogService.js";
// AuditTrailService is canonical for ActorType, AuditEventType, AuditOutcome, ResourceType.
export * from "./AuditTrailService.js";
// ComplianceControlStatusService is canonical for ComplianceFramework.
export * from "./ComplianceControlStatusService.js";
export type { FrameworkCapabilityStatus } from "./ComplianceFrameworkCapabilityGate.js";
export {
  ALL_COMPLIANCE_FRAMEWORKS,
  HIPAA_REQUIREMENTS,
  ComplianceFrameworkCapabilityGate,
  complianceFrameworkCapabilityGate,
  UnsupportedComplianceFrameworkError,
} from "./ComplianceFrameworkCapabilityGate.js";
// ComplianceControlMappingRegistry re-defines ComplianceFramework — exclude it; ComplianceControlStatusService is canonical.
export type { EvidenceType, ControlMapping, FrameworkControlMapping, RetentionSummary } from "./ComplianceControlMappingRegistry.js";
export { ComplianceControlMappingRegistry, complianceControlMappingRegistry } from "./ComplianceControlMappingRegistry.js";
// SecurityMiddleware re-defines Permission, ResourceType — canonical source for these in the security domain.
// Placed after AgentSecurityService explicit exports so export * here wins.
export * from "./ComplianceReportGeneratorService.js";
export * from "./ComplianceEvidenceService.js";
export * from "./InputValidation.js";
// SecurityMiddleware defines AgentContext (conflicts with agents/agent-types) and
// ResourceType (conflicts with AuditTrailService within this barrel).
// Exclude AgentContext; AuditTrailService.ResourceType is canonical within security.
export type {
  Action,
  AuthResult,
  Permission,
  SecurityAgentRole,
} from "./SecurityMiddleware.js";
export { SecurityMiddleware, createAuthMiddleware, createSecurityMiddleware, hasPermission, isGovernanceAgent, canMutateWorkflowState } from "./SecurityMiddleware.js";
// SecurityMonitor defines AlertType (conflicts with tenant/TenantPerformanceManager).
// tenant is canonical for AlertType; exclude it here.
export type {
  MonitoringConfig,
  SecurityAlert,
  SecurityEvent,
  SecurityEventType,
  SecurityMetrics,
  SecuritySeverity,
} from "./SecurityMonitor.js";
export { SecurityMonitor, getSecurityMonitor } from "./SecurityMonitor.js";
export * from "./SiemExportForwarderService.js";
export * from "./auditLogger.js";
export * from "./SecurityAnomalyService.js";
export * from "./ComplianceControlCheckService.js";
