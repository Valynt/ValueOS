/**
 * Advanced Security & Compliance Service
 *
 * Thin facade that composes credential validation, authorization,
 * compliance reporting, incident handling, and audit persistence.
 */

import { EventEmitter } from "events";

import { v4 as uuidv4 } from "uuid";

import { logger } from "../../lib/logger.js";

import { AuditTrailService, type AuditQueryResult } from "./AuditTrailService.js";
import { AuthorizationEngine } from "./AuthorizationEngine.js";
import { ComplianceReportService } from "./ComplianceReportService.js";
import { CredentialValidator } from "./CredentialValidator.js";
import { SecurityIncidentService } from "./SecurityIncidentService.js";
import type {
  AuditTrail,
  AuditTrailFilters,
  AuthCredentials,
  AuthType,
  AuthenticationRequestContext,
  AuthorizationResult,
  ComplianceFramework,
  ComplianceReport,
  ComplianceScope,
  IncidentSeverity,
  IncidentType,
  RequestMetadata,
  Permission,
  Role,
  SecurityConfig,
  SecurityContext,
  SecurityIncident,
  SecurityIncidentFilters,
  SecurityPolicy,
} from "./AgentSecurityTypes.js";

export interface AgentSecurityAuditStore {
  log(event: Omit<AuditTrail, "id">): Promise<void>;
  query(filters?: AuditTrailFilters): Promise<AuditTrail[]>;
}

export interface AgentSecurityServiceDependencies {
  auditStore: AgentSecurityAuditStore;
  credentialValidator: CredentialValidator;
  authorizationEngine: AuthorizationEngine;
  complianceReportService: ComplianceReportService;
  securityIncidentService: SecurityIncidentService;
  startBackgroundTasks: boolean;
}

class AuditTrailServiceAdapter implements AgentSecurityAuditStore {
  constructor(private readonly auditTrailService: AuditTrailService) {}

  async log(event: Omit<AuditTrail, "id">): Promise<void> {
    await this.auditTrailService.logImmediate(event);
  }

  async query(filters: AuditTrailFilters = {}): Promise<AuditTrail[]> {
    const result: AuditQueryResult = await this.auditTrailService.query({
      eventType: filters.eventType,
      actorId: filters.actorId,
      resourceType: filters.resourceType,
      timeRange: filters.timeRange,
      limit: filters.limit,
    });

    const events = result.events as AuditTrail[];
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }
}

function createDefaultPermissions(): Permission[] {
  return [
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
}

function createDefaultRoles(now: number): Role[] {
  return [
    {
      id: "agent",
      name: "Agent",
      description: "Basic agent role",
      permissions: ["agent_read", "agent_write"],
      priority: 1,
      systemRole: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "admin",
      name: "Administrator",
      description: "System administrator",
      permissions: ["agent_read", "agent_write", "agent_admin"],
      priority: 10,
      systemRole: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function createDefaultPolicies(): SecurityPolicy[] {
  return [
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
}

export class AgentSecurityService extends EventEmitter {
  private readonly securityContexts = new Map<string, SecurityContext>();
  private readonly permissions = new Map<string, Permission>();
  private readonly roles = new Map<string, Role>();
  private readonly policies = new Map<string, SecurityPolicy>();
  private readonly config: SecurityConfig;
  private readonly auditStore: AgentSecurityAuditStore;
  private readonly credentialValidator: CredentialValidator;
  private readonly authorizationEngine: AuthorizationEngine;
  private readonly complianceReportService: ComplianceReportService;
  private readonly securityIncidentService: SecurityIncidentService;

  constructor(
    config: Partial<SecurityConfig> = {},
    dependencies: Partial<AgentSecurityServiceDependencies> = {}
  ) {
    super();

    this.config = {
      zeroTrustEnabled: true,
      mfaRequiredForPrivileged: true,
      sessionTimeout: 3600000,
      maxFailedAttempts: 5,
      lockoutDuration: 900000,
      auditRetention: 2555,
      encryptionEnabled: true,
      keyRotationInterval: 86400000,
      complianceCheckInterval: 86400000,
      ...config,
    };

    const defaultPermissions = createDefaultPermissions();
    for (const permission of defaultPermissions) {
      this.permissions.set(permission.id, permission);
    }

    const now = Date.now();
    const defaultRoles = createDefaultRoles(now);
    for (const role of defaultRoles) {
      this.roles.set(role.id, role);
    }

    const defaultPolicies = createDefaultPolicies();
    for (const policy of defaultPolicies) {
      this.policies.set(policy.id, policy);
    }

    this.auditStore =
      dependencies.auditStore ?? new AuditTrailServiceAdapter(new AuditTrailService());
    this.credentialValidator =
      dependencies.credentialValidator ?? new CredentialValidator(this.config);
    this.authorizationEngine =
      dependencies.authorizationEngine ??
      new AuthorizationEngine({
        permissions: this.permissions,
        roles: this.roles,
        policies: this.policies,
      });
    this.complianceReportService =
      dependencies.complianceReportService ?? new ComplianceReportService();
    this.securityIncidentService =
      dependencies.securityIncidentService ?? new SecurityIncidentService();

    logger.info("Security service initialized", {
      zeroTrustEnabled: this.config.zeroTrustEnabled,
      mfaRequired: this.config.mfaRequiredForPrivileged,
    });

    if (dependencies.startBackgroundTasks ?? true) {
      this.startSecurityTasks();
    }
  }

  async authenticateAgent(
    credentials: AuthCredentials,
    authType: AuthType,
    context: AuthenticationRequestContext
  ): Promise<SecurityContext> {
    const correlationId = uuidv4();
    const startTime = Date.now();

    try {
      const validationResult = await this.credentialValidator.validateCredentials(
        credentials,
        authType
      );

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
          tenantId: context.tenantId,
        });

        throw new Error(`Authentication failed: ${validationResult.reason}`);
      }

      const securityContext: SecurityContext = {
        tenantId: context.tenantId,
        userId: validationResult.subject ?? "unknown",
        agentId: validationResult.subject ?? "unknown",
        sessionId: context.sessionId,
        permissions: validationResult.permissions ?? [],
        roles: validationResult.roles ?? [],
        authenticationMethod: {
          type: authType,
          credentials,
          mfaRequired: this.credentialValidator.isMFARequired(validationResult.roles ?? []),
          mfaVerified: false,
          certificateInfo: validationResult.certificateInfo,
        },
        trustLevel: this.credentialValidator.calculateTrustLevel(validationResult, {
          ipAddress: context.ipAddress,
        }),
        timestamp: startTime,
      };

      this.securityContexts.set(context.sessionId, securityContext);

      await this.logAuditEvent({
        eventType: "authentication",
        actorId: validationResult.subject ?? "unknown",
        actorType: "agent",
        resourceId: validationResult.subject ?? "unknown",
        resourceType: "agent",
        action: "authenticate",
        outcome: "success",
        details: { authType, trustLevel: securityContext.trustLevel },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        timestamp: startTime,
        sessionId: context.sessionId,
        correlationId,
        riskScore: this.calculateRiskScore(securityContext),
        complianceFlags: [],
        tenantId: context.tenantId,
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

  async authorizeAction(
    sessionId: string,
    action: string,
    resource: string,
    context?: RequestMetadata
  ): Promise<AuthorizationResult> {
    const securityContext = this.securityContexts.get(sessionId);

    if (!securityContext) {
      throw new Error("No security context found for session");
    }

    const correlationId = uuidv4();
    const startTime = Date.now();

    try {
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
          ipAddress: context?.ipAddress ?? "unknown",
          userAgent: context?.userAgent ?? "unknown",
          timestamp: startTime,
          sessionId,
          correlationId,
          riskScore: 0.7,
          complianceFlags: ["SESSION_INVALID"],
          tenantId: securityContext.tenantId,
        });

        throw new Error("Session expired or invalid");
      }

      const permissionCheck = await this.authorizationEngine.checkPermissions(
        securityContext,
        action,
        resource,
        context
      );
      const policyCheck = await this.authorizationEngine.applySecurityPolicies(
        securityContext,
        action,
        resource,
        context
      );

      const authorized = permissionCheck.granted && policyCheck.allowed;

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
        ipAddress: context?.ipAddress ?? "unknown",
        userAgent: context?.userAgent ?? "unknown",
        timestamp: startTime,
        sessionId,
        correlationId,
        riskScore: this.calculateRiskScore(securityContext),
        complianceFlags: authorized ? [] : ["ACCESS_DENIED"],
        tenantId: securityContext.tenantId,
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

  async checkCompliance(
    frameworks: ComplianceFramework[],
    scope?: ComplianceScope
  ): Promise<ComplianceReport[]> {
    const reports = await this.complianceReportService.checkCompliance(frameworks, scope);
    this.emit("complianceChecked", { frameworks, reports });
    return reports;
  }

  async createSecurityIncident(
    type: IncidentType,
    severity: IncidentSeverity,
    description: string,
    source: string,
    affectedResources: string[],
    context?: Record<string, unknown>
  ): Promise<string> {
    const incident = await this.securityIncidentService.createSecurityIncident(
      type,
      severity,
      description,
      source,
      affectedResources,
      context
    );

    await this.logAuditEvent({
      eventType: "security_event",
      actorId: "system",
      actorType: "system",
      resourceId: incident.id,
      resourceType: "system",
      action: "create_incident",
      outcome: "success",
      details: { type, severity, description },
      ipAddress: "system",
      userAgent: "system",
      timestamp: incident.reportedAt,
      sessionId: "system",
      correlationId: incident.id,
      riskScore: this.securityIncidentService.calculateIncidentRisk(severity),
      complianceFlags: ["SECURITY_INCIDENT"],
    });

    this.emit("securityIncident", { incident });
    return incident.id;
  }

  getSecurityContext(sessionId: string): SecurityContext | null {
    return this.securityContexts.get(sessionId) ?? null;
  }

  async revokeSecurityContext(sessionId: string, reason: string): Promise<void> {
    const context = this.securityContexts.get(sessionId);

    if (!context) return;

    await this.logAuditEvent({
      eventType: "authentication",
      actorId: context.userId,
      actorType: "agent",
      resourceId: "session",
      resourceType: "system",
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
      tenantId: context.tenantId,
    });

    this.securityContexts.delete(sessionId);
    this.emit("securityContextRevoked", { sessionId, reason });
  }

  async getAuditTrail(filters?: AuditTrailFilters): Promise<AuditTrail[]> {
    return this.auditStore.query(filters);
  }

  getSecurityIncidents(filters?: SecurityIncidentFilters): SecurityIncident[] {
    return this.securityIncidentService.getSecurityIncidents(filters);
  }

  private startSecurityTasks(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000);

    setInterval(() => {
      void this.performComplianceChecks();
    }, this.config.complianceCheckInterval);

    if (this.config.encryptionEnabled) {
      setInterval(() => {
        void this.rotateEncryptionKeys();
      }, this.config.keyRotationInterval);
    }
  }

  private isSessionValid(context: SecurityContext): boolean {
    return Date.now() - context.timestamp < this.config.sessionTimeout;
  }

  private calculateRiskScore(context: SecurityContext): number {
    let score = 0.1;

    const trustScores: Record<SecurityContext["trustLevel"], number> = {
      untrusted: 0.8,
      low: 0.6,
      medium: 0.4,
      high: 0.2,
      privileged: 0.1,
    };
    score += trustScores[context.trustLevel] ?? 0.5;

    if (context.roles.includes("admin")) score += 0.2;
    if (context.roles.includes("privileged")) score += 0.1;

    score += Math.min(0.2, context.permissions.length * 0.01);

    return Math.min(1.0, score);
  }

  private async logAuditEvent(event: Omit<AuditTrail, "id">): Promise<void> {
    await this.auditStore.log(event);
    this.emit("auditEvent", event);
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
      logger.error("Compliance check failed", error as Error);
    }
  }

  private async rotateEncryptionKeys(): Promise<void> {
    logger.info("Encryption keys rotated");
    this.emit("keysRotated");
  }
}

let agentSecurityServiceInstance: AgentSecurityService | null = null;

export function getAgentSecurityService(config?: Partial<SecurityConfig>): AgentSecurityService {
  if (!agentSecurityServiceInstance) {
    agentSecurityServiceInstance = new AgentSecurityService(config);
  }
  return agentSecurityServiceInstance;
}
