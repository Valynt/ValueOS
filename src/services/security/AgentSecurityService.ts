/**
 * Advanced Security & Compliance Service
 *
 * Zero-trust agent authentication, fine-grained permission management,
 * automated compliance checking, and enhanced audit trails for enterprise security.
 */

import { logger } from "../../lib/logger";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

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
  // API Key authentication
  apiKey?: string;
  keyId?: string;

  // OAuth authentication
  accessToken?: string;
  refreshToken?: string;
  scope?: string;

  // Certificate authentication
  certificate?: string;
  privateKey?: string;

  // JWT authentication
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
  value: any;
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
  score: number; // 0-100
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
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: number;
  sessionId: string;
  correlationId: string;
  riskScore: number;
  complianceFlags: string[];
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

// ============================================================================
// Enums
// ============================================================================

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
export type AuditEventType =
  | "authentication"
  | "authorization"
  | "data_access"
  | "configuration_change"
  | "security_event"
  | "compliance_violation";
export type ActorType = "user" | "agent" | "system" | "service";
export type ResourceType = "agent" | "data" | "configuration" | "policy" | "user" | "system";
export type AuditOutcome = "success" | "failure" | "denied" | "error";
export type IncidentType =
  | "unauthorized_access"
  | "data_breach"
  | "malicious_activity"
  | "policy_violation"
  | "system_compromise";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed" | "false_positive";
export type RuleSeverity = "info" | "warning" | "error" | "critical";

// ============================================================================
// Supporting Types
// ============================================================================

export interface TimeRestrictions {
  allowedHours: { start: string; end: string }[];
  allowedDays: number[]; // 0-6 (Sunday-Saturday)
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
  value: any;
}

export interface PolicyAction {
  type: "allow" | "deny" | "log" | "alert" | "quarantine";
  parameters?: Record<string, any>;
}

export interface RuleCondition {
  expression: string;
  parameters?: Record<string, any>;
}

export interface RuleAction {
  type: string;
  parameters?: Record<string, any>;
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
  details: Record<string, any>;
}

export interface IncidentMitigation {
  immediate: string[];
  shortTerm: string[];
  longTerm: string[];
  prevention: string[];
}

// ============================================================================
// AgentSecurityService Implementation
// ============================================================================

export class AgentSecurityService extends EventEmitter {
  private securityContexts = new Map<string, SecurityContext>();
  private permissions = new Map<string, Permission>();
  private roles = new Map<string, Role>();
  private policies = new Map<string, SecurityPolicy>();
  private auditTrail: AuditTrail[] = [];
  private incidents: SecurityIncident[] = [];
  private complianceReports = new Map<string, ComplianceReport>();

  // Security configuration
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    super();

    this.config = {
      zeroTrustEnabled: true,
      mfaRequiredForPrivileged: true,
      sessionTimeout: 3600000, // 1 hour
      maxFailedAttempts: 5,
      lockoutDuration: 900000, // 15 minutes
      auditRetention: 2555, // days (7 years)
      encryptionEnabled: true,
      keyRotationInterval: 86400000, // 24 hours
      complianceCheckInterval: 86400000, // 24 hours
      ...config,
    };

    this.initializeSecurity();
    this.startSecurityTasks();
  }

  /**
   * Authenticate agent with zero-trust principles
   */
  async authenticateAgent(
    credentials: AuthCredentials,
    authType: AuthType,
    context: {
      ipAddress: string;
      userAgent: string;
      sessionId: string;
      tenantId: string;
    }
  ): Promise<SecurityContext> {
    const correlationId = uuidv4();
    const startTime = Date.now();

    try {
      // Validate credentials
      const validationResult = await this.validateCredentials(credentials, authType);

      if (!validationResult.valid) {
        await this.logAuditEvent({
          eventType: "authentication",
          actorId: "unknown",
          actorType: "agent",
          resourceId: "system",
          resourceType: "system",
          action: "authenticate",
          outcome: "failure",
          details: { reason: validationResult.reason, authType },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          timestamp: startTime,
          sessionId: context.sessionId,
          correlationId,
          riskScore: 0.8,
          complianceFlags: ["AUTH_FAILURE"],
        });

        throw new Error(`Authentication failed: ${validationResult.reason}`);
      }

      // Create security context
      const securityContext: SecurityContext = {
        tenantId: context.tenantId,
        userId: validationResult.subject,
        agentId: validationResult.subject,
        sessionId: context.sessionId || "unknown",
        permissions: validationResult.permissions || [],
        roles: validationResult.roles || [],
        authenticationMethod: {
          type: authType,
          credentials,
          mfaRequired: this.isMFARequired(validationResult.roles || []),
          mfaVerified: false,
          certificateInfo: validationResult.certificateInfo,
        },
        trustLevel: this.calculateTrustLevel(validationResult, context),
        timestamp: startTime,
      };

      // Store security context
      this.securityContexts.set(context.sessionId || "unknown", securityContext);

      // Log successful authentication
      await this.logAuditEvent({
        eventType: "authentication",
        actorId: validationResult.subject || "unknown",
        actorType: "agent",
        resourceId: validationResult.subject || "unknown",
        resourceType: "agent",
        action: "authenticate",
        outcome: "success",
        details: { authType, trustLevel: securityContext.trustLevel },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        timestamp: startTime,
        sessionId: context.sessionId || "unknown",
        correlationId,
        riskScore: this.calculateRiskScore(securityContext),
        complianceFlags: [],
      });

      this.emit("agentAuthenticated", { securityContext, correlationId });
      return securityContext;
    } catch (error) {
      this.emit("authenticationError", {
        error: error instanceof Error ? error.message : String(error),
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Authorize agent action with fine-grained permissions
   */
  async authorizeAction(
    sessionId: string,
    action: string,
    resource: string,
    context?: Record<string, any>
  ): Promise<AuthorizationResult> {
    const securityContext = this.securityContexts.get(sessionId);

    if (!securityContext) {
      throw new Error("No security context found for session");
    }

    const correlationId = uuidv4();
    const startTime = Date.now();

    try {
      // Check session validity
      if (!this.isSessionValid(securityContext)) {
        await this.logAuditEvent({
          eventType: "authorization",
          actorId: securityContext.userId,
          actorType: "agent",
          resourceId: resource,
          resourceType: "agent",
          action,
          outcome: "denied",
          details: { reason: "Session expired or invalid" },
          ipAddress: context?.ipAddress || "unknown",
          userAgent: context?.userAgent || "unknown",
          timestamp: startTime,
          sessionId,
          correlationId,
          riskScore: 0.7,
          complianceFlags: ["SESSION_INVALID"],
        });

        throw new Error("Session expired or invalid");
      }

      // Check permissions
      const permissionCheck = await this.checkPermissions(
        securityContext,
        action,
        resource,
        context
      );

      // Apply security policies
      const policyCheck = await this.applySecurityPolicies(
        securityContext,
        action,
        resource,
        context
      );

      const authorized = permissionCheck.granted && policyCheck.allowed;

      // Log authorization attempt
      await this.logAuditEvent({
        eventType: "authorization",
        actorId: securityContext.userId,
        actorType: "agent",
        resourceId: resource,
        resourceType: "agent",
        action,
        outcome: authorized ? "success" : "denied",
        details: {
          permissionCheck,
          policyCheck,
          trustLevel: securityContext.trustLevel,
        },
        ipAddress: context?.ipAddress || "unknown",
        userAgent: context?.userAgent || "unknown",
        timestamp: startTime,
        sessionId,
        correlationId,
        riskScore: this.calculateRiskScore(securityContext),
        complianceFlags: authorized ? [] : ["ACCESS_DENIED"],
      });

      const result: AuthorizationResult = {
        granted: authorized,
        reason: authorized ? "Authorized" : permissionCheck.reason || policyCheck.reason,
        conditions: policyCheck.conditions,
        requiresMFA: policyCheck.requiresMFA,
        riskScore: this.calculateRiskScore(securityContext),
      };

      this.emit("actionAuthorized", {
        securityContext,
        action,
        resource,
        result,
        correlationId,
      });

      return result;
    } catch (error) {
      this.emit("authorizationError", {
        error: error instanceof Error ? error.message : String(error),
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Perform automated compliance checking
   */
  async checkCompliance(
    frameworks: ComplianceFramework[],
    scope?: {
      agents?: string[];
      policies?: string[];
      timeRange?: { start: number; end: number };
    }
  ): Promise<ComplianceReport[]> {
    const reports: ComplianceReport[] = [];

    for (const framework of frameworks) {
      const report = await this.generateComplianceReport(framework, scope);
      reports.push(report);
    }

    this.emit("complianceChecked", { frameworks, reports });
    return reports;
  }

  /**
   * Create and manage security incidents
   */
  async createSecurityIncident(
    type: IncidentType,
    severity: IncidentSeverity,
    description: string,
    source: string,
    affectedResources: string[],
    context?: Record<string, any>
  ): Promise<string> {
    const incidentId = uuidv4();
    const now = Date.now();

    const incident: SecurityIncident = {
      id: incidentId,
      type,
      severity,
      status: "open",
      description,
      source,
      affectedResources,
      timeline: [
        {
          timestamp: now,
          type: "incident_created",
          description: "Security incident created",
          details: context || {},
        },
      ],
      mitigation: {
        immediate: [],
        shortTerm: [],
        longTerm: [],
        prevention: [],
      },
      reportedAt: now,
    };

    this.incidents.push(incident);

    // Log security incident
    await this.logAuditEvent({
      eventType: "security_event",
      actorId: "system",
      actorType: "system",
      resourceId: incidentId,
      resourceType: "system",
      action: "create_incident",
      outcome: "success",
      details: { type, severity, description },
      ipAddress: "system",
      userAgent: "system",
      timestamp: now,
      sessionId: "system",
      correlationId: incidentId,
      riskScore: this.calculateIncidentRisk(severity),
      complianceFlags: ["SECURITY_INCIDENT"],
    });

    this.emit("securityIncident", { incident });
    return incidentId;
  }

  /**
   * Get security context for session
   */
  getSecurityContext(sessionId: string): SecurityContext | null {
    return this.securityContexts.get(sessionId) || null;
  }

  /**
   * Revoke security context
   */
  async revokeSecurityContext(sessionId: string, reason: string): Promise<void> {
    const context = this.securityContexts.get(sessionId);

    if (context) {
      await this.logAuditEvent({
        eventType: "authentication",
        actorId: context.userId,
        actorType: "agent",
        resourceId: "session",
        resourceType: "session" as ResourceType,
        action: "revoke",
        outcome: "success",
        details: { reason },
        ipAddress: "system",
        userAgent: "system",
        timestamp: Date.now(),
        sessionId,
        correlationId: uuidv4(),
        riskScore: 0.3,
        complianceFlags: [],
      });

      this.securityContexts.delete(sessionId);
      this.emit("securityContextRevoked", { sessionId, reason });
    }
  }

  /**
   * Get audit trail
   */
  getAuditTrail(filters?: {
    eventType?: AuditEventType;
    actorId?: string;
    resourceType?: ResourceType;
    timeRange?: { start: number; end: number };
    limit?: number;
  }): AuditTrail[] {
    let trail = this.auditTrail;

    // Apply filters
    if (filters) {
      if (filters.eventType) {
        trail = trail.filter((entry) => entry.eventType === filters.eventType);
      }
      if (filters.actorId) {
        trail = trail.filter((entry) => entry.actorId === filters.actorId);
      }
      if (filters.resourceType) {
        trail = trail.filter((entry) => entry.resourceType === filters.resourceType);
      }
      if (filters.timeRange) {
        trail = trail.filter(
          (entry) =>
            entry.timestamp >= filters.timeRange!.start && entry.timestamp <= filters.timeRange!.end
        );
      }
    }

    // Sort by timestamp (newest first)
    trail.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    if (filters?.limit) {
      trail = trail.slice(0, filters.limit);
    }

    return trail;
  }

  /**
   * Get security incidents
   */
  getSecurityIncidents(filters?: {
    type?: IncidentType;
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    timeRange?: { start: number; end: number };
  }): SecurityIncident[] {
    let incidents = this.incidents;

    if (filters) {
      if (filters.type) {
        incidents = incidents.filter((inc) => inc.type === filters.type);
      }
      if (filters.severity) {
        incidents = incidents.filter((inc) => inc.severity === filters.severity);
      }
      if (filters.status) {
        incidents = incidents.filter((inc) => inc.status === filters.status);
      }
      if (filters.timeRange) {
        incidents = incidents.filter(
          (inc) =>
            inc.reportedAt >= filters.timeRange!.start && inc.reportedAt <= filters.timeRange!.end
        );
      }
    }

    return incidents.sort((a, b) => b.reportedAt - a.reportedAt);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private initializeSecurity(): void {
    // Initialize default permissions
    this.initializeDefaultPermissions();

    // Initialize default roles
    this.initializeDefaultRoles();

    // Initialize default policies
    this.initializeDefaultPolicies();

    logger.info("Security service initialized", {
      zeroTrustEnabled: this.config.zeroTrustEnabled,
      mfaRequired: this.config.mfaRequiredForPrivileged,
    });
  }

  private startSecurityTasks(): void {
    // Session cleanup
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Every minute

    // Compliance checking
    setInterval(() => {
      this.performComplianceChecks();
    }, this.config.complianceCheckInterval);

    // Key rotation
    if (this.config.encryptionEnabled) {
      setInterval(() => {
        this.rotateEncryptionKeys();
      }, this.config.keyRotationInterval);
    }
  }

  private async validateCredentials(
    credentials: AuthCredentials,
    authType: AuthType
  ): Promise<CredentialValidationResult> {
    // In a real implementation, this would validate against various auth providers
    switch (authType) {
      case "api_key":
        return this.validateApiKey(credentials.apiKey!, credentials.keyId);
      case "jwt":
        return this.validateJWT(credentials.jwt!, credentials.claims);
      case "certificate":
        return this.validateCertificate(credentials.certificate!, credentials.privateKey);
      case "oauth":
        return this.validateOAuth(credentials.accessToken!, credentials.refreshToken);
      default:
        return { valid: false, reason: "Unsupported authentication type" };
    }
  }

  private async validateApiKey(
    apiKey: string,
    keyId?: string
  ): Promise<CredentialValidationResult> {
    // Mock validation - in reality would check against database or auth service
    if (apiKey && apiKey.startsWith("ak_") && apiKey.length === 32) {
      return {
        valid: true,
        subject: "agent_" + keyId || "unknown",
        permissions: ["read", "write"],
        roles: ["agent"],
      };
    }

    return { valid: false, reason: "Invalid API key" };
  }

  private async validateJWT(
    token: string,
    claims?: JWTClaims
  ): Promise<CredentialValidationResult> {
    try {
      // Mock JWT validation - in reality would verify signature and claims
      const parts = token.split(".");
      if (parts.length !== 3) {
        return { valid: false, reason: "Invalid JWT format" };
      }

      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

      if (payload.exp && payload.exp < Date.now() / 1000) {
        return { valid: false, reason: "JWT expired" };
      }

      return {
        valid: true,
        subject: payload.sub || "unknown",
        permissions: payload.scope?.split(" ") || [],
        roles: payload.roles || [],
      };
    } catch (error) {
      return { valid: false, reason: "JWT parsing error" };
    }
  }

  private async validateCertificate(
    certificate: string,
    privateKey?: string
  ): Promise<CredentialValidationResult> {
    try {
      // Mock certificate validation - in reality would verify against CA
      const certInfo = this.parseCertificate(certificate);

      if (certInfo.notAfter < new Date()) {
        return { valid: false, reason: "Certificate expired" };
      }

      return {
        valid: true,
        subject: certInfo.subject,
        permissions: ["certificate_authenticated"],
        roles: ["certified_agent"],
        certificateInfo: certInfo,
      };
    } catch (error) {
      return { valid: false, reason: "Certificate validation error" };
    }
  }

  private async validateOAuth(
    accessToken: string,
    refreshToken?: string
  ): Promise<CredentialValidationResult> {
    // Mock OAuth validation - in reality would validate against OAuth provider
    if (accessToken && accessToken.startsWith("oauth_")) {
      return {
        valid: true,
        subject: "oauth_user",
        permissions: ["oauth_authenticated"],
        roles: ["oauth_agent"],
      };
    }

    return { valid: false, reason: "Invalid OAuth token" };
  }

  private parseCertificate(certificate: string): CertificateInfo {
    // Mock certificate parsing - in reality would use proper certificate library
    return {
      subject: "CN=agent,O=ValueOS",
      issuer: "CN=ValueOS CA",
      serialNumber: "123456",
      notBefore: new Date("2024-01-01"),
      notAfter: new Date("2025-01-01"),
      fingerprint: certificate ? crypto.createHash("sha256").update(certificate).digest("hex") : "",
      keyUsage: ["digitalSignature", "keyEncipherment"],
    };
  }

  private calculateTrustLevel(validation: CredentialValidationResult, context: any): TrustLevel {
    let trustLevel: TrustLevel = "low";

    // Base trust from authentication method
    if (validation.certificateInfo) {
      trustLevel = "high";
    } else if (validation.roles.includes("admin")) {
      trustLevel = "privileged";
    } else if (validation.roles.includes("agent")) {
      trustLevel = "medium";
    }

    // Adjust based on context factors
    if (context.ipAddress.startsWith("192.168.") || context.ipAddress.startsWith("10.")) {
      // Internal network - increase trust
      if (trustLevel === "low") trustLevel = "medium";
      else if (trustLevel === "medium") trustLevel = "high";
    }

    return trustLevel;
  }

  private isMFARequired(roles: string[]): boolean {
    return (
      this.config.mfaRequiredForPrivileged &&
      roles.some((role) => ["admin", "privileged", "certified_agent"].includes(role))
    );
  }

  private isSessionValid(context: SecurityContext): boolean {
    const now = Date.now();
    const sessionAge = now - context.timestamp;

    return sessionAge < this.config.sessionTimeout;
  }

  private async checkPermissions(
    context: SecurityContext,
    action: string,
    resource: string,
    requestContext?: Record<string, any>
  ): Promise<PermissionCheckResult> {
    // Check direct permissions
    for (const permissionName of context.permissions) {
      const permission = this.permissions.get(permissionName);

      if (permission && this.matchesPermission(permission, action, resource, requestContext)) {
        return { granted: true, reason: "Permission granted" };
      }
    }

    // Check role-based permissions
    for (const roleName of context.roles) {
      const role = this.roles.get(roleName);

      if (role) {
        for (const permissionName of role.permissions) {
          const permission = this.permissions.get(permissionName);

          if (permission && this.matchesPermission(permission, action, resource, requestContext)) {
            return { granted: true, reason: `Permission granted via role: ${roleName}` };
          }
        }
      }
    }

    return { granted: false, reason: "Insufficient permissions" };
  }

  private matchesPermission(
    permission: Permission,
    action: string,
    resource: string,
    context?: Record<string, any>
  ): boolean {
    // Check action match
    if (permission.action !== "*" && permission.action !== action) {
      return false;
    }

    // Check resource match
    if (
      permission.resource !== "*" &&
      !resource.match(new RegExp(permission.resource.replace("*", ".*")))
    ) {
      return false;
    }

    // Check conditions
    if (permission.conditions) {
      for (const condition of permission.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }

    return true;
  }

  private evaluateCondition(
    condition: PermissionCondition,
    context?: Record<string, any>
  ): boolean {
    if (!context) return true;

    const value = context[condition.type];

    switch (condition.operator) {
      case "equals":
        return value === condition.value;
      case "not_equals":
        return value !== condition.value;
      case "contains":
        return typeof value === "string" && value.includes(condition.value);
      case "not_contains":
        return typeof value === "string" && !value.includes(condition.value);
      case "greater_than":
        return Number(value) > Number(condition.value);
      case "less_than":
        return Number(value) < Number(condition.value);
      case "in":
        return Array.isArray(condition.value) && condition.value.includes(value);
      case "not_in":
        return Array.isArray(condition.value) && !condition.value.includes(value);
      default:
        return true;
    }
  }

  private async applySecurityPolicies(
    context: SecurityContext,
    action: string,
    resource: string,
    requestContext?: Record<string, any>
  ): Promise<PolicyCheckResult> {
    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      const policyResult = await this.evaluatePolicy(
        policy,
        context,
        action,
        resource,
        requestContext
      );

      if (!policyResult.allowed) {
        return policyResult;
      }
    }

    return { allowed: true, conditions: [] };
  }

  private async evaluatePolicy(
    policy: SecurityPolicy,
    context: SecurityContext,
    action: string,
    resource: string,
    requestContext?: Record<string, any>
  ): Promise<PolicyCheckResult> {
    // Mock policy evaluation - in reality would have sophisticated rule engine
    for (const rule of policy.rules) {
      if (!rule.enabled) continue;

      // Simple rule matching - in reality would use proper rule engine
      if (rule.action.type === "deny") {
        return {
          allowed: false,
          reason: `Policy violation: ${rule.name}`,
          conditions: [],
          requiresMFA: false,
        };
      }
    }

    return { allowed: true, conditions: [] };
  }

  private calculateRiskScore(context: SecurityContext): number {
    let score = 0.1; // Base score

    // Trust level impact
    const trustScores = {
      untrusted: 0.8,
      low: 0.6,
      medium: 0.4,
      high: 0.2,
      privileged: 0.1,
    };
    score += trustScores[context.trustLevel] || 0.5;

    // Role impact
    if (context.roles.includes("admin")) score += 0.2;
    if (context.roles.includes("privileged")) score += 0.1;

    // Permission count impact
    score += Math.min(0.2, context.permissions.length * 0.01);

    return Math.min(1.0, score);
  }

  private calculateIncidentRisk(severity: IncidentSeverity): number {
    const riskScores = {
      low: 0.2,
      medium: 0.4,
      high: 0.7,
      critical: 0.9,
    };
    return riskScores[severity];
  }

  private async logAuditEvent(event: Omit<AuditTrail, "id">): Promise<void> {
    const auditEntry: AuditTrail = {
      ...event,
      id: uuidv4(),
    };

    this.auditTrail.push(auditEntry);

    // Maintain audit trail size
    if (this.auditTrail.length > 100000) {
      this.auditTrail = this.auditTrail.slice(-50000); // Keep last 50k
    }

    this.emit("auditEvent", auditEntry);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, context] of this.securityContexts.entries()) {
      if (now - context.timestamp > this.config.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.securityContexts.delete(sessionId);
      this.emit("sessionExpired", { sessionId });
    }

    if (expiredSessions.length > 0) {
      logger.info("Cleaned up expired sessions", { count: expiredSessions.length });
    }
  }

  private async performComplianceChecks(): Promise<void> {
    const frameworks: ComplianceFramework[] = ["SOC2", "GDPR", "ISO27001"];

    try {
      await this.checkCompliance(frameworks);
    } catch (error) {
      logger.error("Compliance check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async rotateEncryptionKeys(): Promise<void> {
    // Mock key rotation - in reality would implement proper key management
    logger.info("Encryption keys rotated");
    this.emit("keysRotated");
  }

  private async generateComplianceReport(
    framework: ComplianceFramework,
    scope?: any
  ): Promise<ComplianceReport> {
    // Mock compliance report generation
    const report: ComplianceReport = {
      id: uuidv4(),
      framework,
      status: "compliant",
      score: 85,
      findings: [],
      recommendations: [],
      generatedAt: Date.now(),
      nextReviewDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    this.complianceReports.set(report.id, report);
    return report;
  }

  private initializeDefaultPermissions(): void {
    const defaultPermissions: Permission[] = [
      {
        id: "agent_read",
        name: "Agent Read Access",
        description: "Read access to agent resources",
        resource: "agent/*",
        action: "read",
        riskLevel: "low",
        auditRequired: false,
        mfaRequired: false,
      },
      {
        id: "agent_write",
        name: "Agent Write Access",
        description: "Write access to agent resources",
        resource: "agent/*",
        action: "write",
        riskLevel: "medium",
        auditRequired: true,
        mfaRequired: false,
      },
      {
        id: "agent_admin",
        name: "Agent Administration",
        description: "Full administrative access to agents",
        resource: "agent/*",
        action: "*",
        riskLevel: "high",
        auditRequired: true,
        mfaRequired: true,
      },
    ];

    for (const permission of defaultPermissions) {
      this.permissions.set(permission.id, permission);
    }
  }

  private initializeDefaultRoles(): void {
    const defaultRoles: Role[] = [
      {
        id: "agent",
        name: "Agent",
        description: "Basic agent role",
        permissions: ["agent_read", "agent_write"],
        priority: 1,
        systemRole: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: "admin",
        name: "Administrator",
        description: "System administrator",
        permissions: ["agent_read", "agent_write", "agent_admin"],
        priority: 10,
        systemRole: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    for (const role of defaultRoles) {
      this.roles.set(role.id, role);
    }
  }

  private initializeDefaultPolicies(): void {
    const defaultPolicies: SecurityPolicy[] = [
      {
        id: "session_policy",
        name: "Session Management Policy",
        description: "Controls session duration and validation",
        type: "access_control",
        rules: [],
        enabled: true,
        priority: 1,
        conditions: [],
        actions: [],
        complianceFrameworks: ["SOC2", "ISO27001"],
      },
    ];

    for (const policy of defaultPolicies) {
      this.policies.set(policy.id, policy);
    }
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

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
  conditions?: any[];
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
  conditions?: any[];
  requiresMFA?: boolean;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let agentSecurityServiceInstance: AgentSecurityService | null = null;

export function getAgentSecurityService(config?: Partial<SecurityConfig>): AgentSecurityService {
  if (!agentSecurityServiceInstance) {
    agentSecurityServiceInstance = new AgentSecurityService(config);
  }
  return agentSecurityServiceInstance;
}
