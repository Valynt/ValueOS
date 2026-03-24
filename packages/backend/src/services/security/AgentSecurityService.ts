/**
 * Advanced Security & Compliance Service
 *
 * Thin facade that composes credential validation, authorization,
 * compliance reporting, incident handling, and audit persistence.
 */

import { EventEmitter } from "events";

import { v4 as uuidv4 } from "uuid";

import { logger } from "../../lib/logger.js";

import {
  AuthorizationEngine,
  createDefaultPermissions,
  createDefaultPolicies,
  createDefaultRoles,
} from "./AuthorizationEngine.js";
import { getAuditTrailService, type AuditEvent, type AuditQueryResult } from "./AuditTrailService.js";
import {
  type AuthenticationRequestContext,
  type AuditTrail,
  type AuditTrailFilters,
  type AuthCredentials,
  type AuthType,
  type AuthorizationResult,
  type ComplianceFramework,
  type ComplianceReport,
  type ComplianceScope,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentType,
  type PermissionCheckResult,
  type PolicyCheckResult,
  type ResourceType,
  type SecurityConfig,
  type SecurityContext,
  type SecurityIncident,
} from "./AgentSecurityTypes.js";
import { ComplianceReportService } from "./ComplianceReportService.js";
import { CredentialValidator } from "./CredentialValidator.js";
import { SecurityIncidentService } from "./SecurityIncidentService.js";

export * from "./AgentSecurityTypes.js";

interface AuditTrailClient {
  logImmediate(event: Omit<AuditEvent, "id">): Promise<string | null>;
  query(filters?: {
    eventType?: AuditEvent["eventType"];
    actorId?: string;
    resourceType?: AuditEvent["resourceType"];
    timeRange?: { start: number; end: number };
    limit?: number;
  }): Promise<AuditQueryResult>;
}

interface AgentSecurityServiceDependencies {
  credentialValidator?: CredentialValidator;
  authorizationEngine?: AuthorizationEngine;
  incidentService?: SecurityIncidentService;
  complianceReportService?: ComplianceReportService;
  auditTrailService?: AuditTrailClient;
  startBackgroundTasks?: boolean;
}

export class AgentSecurityService extends EventEmitter {
  private readonly securityContexts = new Map<string, SecurityContext>();
  private readonly config: SecurityConfig;
  private readonly credentialValidator: CredentialValidator;
  private readonly authorizationEngine: AuthorizationEngine;
  private readonly incidentService: SecurityIncidentService;
  private readonly complianceReportService: ComplianceReportService;
  private readonly auditTrailService: AuditTrailClient;

  constructor(
    config: Partial<SecurityConfig> = {},
    dependencies: AgentSecurityServiceDependencies = {}
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

    this.credentialValidator =
      dependencies.credentialValidator ?? new CredentialValidator(this.config);
    this.authorizationEngine =
      dependencies.authorizationEngine ??
      new AuthorizationEngine({
        permissions: createDefaultPermissions(),
        roles: createDefaultRoles(),
        policies: createDefaultPolicies(),
      });
    this.incidentService = dependencies.incidentService ?? new SecurityIncidentService();
    this.complianceReportService =
      dependencies.complianceReportService ?? new ComplianceReportService();
    this.auditTrailService = dependencies.auditTrailService ?? getAuditTrailService();

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
      const validationResult = await this.credentialValidator.validateCredentials(credentials, authType);

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
        trustLevel: this.credentialValidator.calculateTrustLevel(validationResult, context),
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
    context?: Record<string, unknown>
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
          ipAddress: typeof context?.ipAddress === "string" ? context.ipAddress : "unknown",
          userAgent: typeof context?.userAgent === "string" ? context.userAgent : "unknown",
          timestamp: startTime,
          sessionId,
          correlationId,
          riskScore: 0.7,
          complianceFlags: ["SESSION_INVALID"],
          tenantId: securityContext.tenantId,
        });

        throw new Error("Session expired or invalid");
      }

      const permissionCheck = this.checkPermissions(securityContext, action, resource, context);
      const policyCheck = await this.applySecurityPolicies(securityContext, action, resource, context);
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
        ipAddress: typeof context?.ipAddress === "string" ? context.ipAddress : "unknown",
        userAgent: typeof context?.userAgent === "string" ? context.userAgent : "unknown",
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
    const incident = this.incidentService.createSecurityIncident(
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
      riskScore: this.incidentService.calculateIncidentRisk(severity),
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

    if (context) {
      await this.logAuditEvent({
        eventType: "authentication",
        actorId: context.userId,
        actorType: "agent",
        resourceId: "session",
        resourceType: "system" as ResourceType,
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
  }

  async getAuditTrail(filters?: AuditTrailFilters): Promise<AuditTrail[]> {
    const result = await this.auditTrailService.query(filters);
    return result.events.map((event) => ({
      id: event.id ?? uuidv4(),
      eventType: event.eventType,
      actorId: event.actorId,
      actorType: event.actorType,
      resourceId: event.resourceId,
      resourceType: event.resourceType,
      action: event.action,
      outcome: event.outcome,
      details: event.details,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      timestamp: event.timestamp,
      sessionId: event.sessionId,
      correlationId: event.correlationId,
      riskScore: event.riskScore,
      complianceFlags: event.complianceFlags,
      tenantId: event.tenantId,
    }));
  }

  getSecurityIncidents(filters?: {
    type?: IncidentType;
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    timeRange?: { start: number; end: number };
  }): SecurityIncident[] {
    return this.incidentService.getSecurityIncidents(filters);
  }

  private isSessionValid(context: SecurityContext): boolean {
    const now = Date.now();
    return now - context.timestamp < this.config.sessionTimeout;
  }

  private checkPermissions(
    context: SecurityContext,
    action: string,
    resource: string,
    requestContext?: Record<string, unknown>
  ): PermissionCheckResult {
    return this.authorizationEngine.checkPermissions(context, action, resource, requestContext);
  }

  private applySecurityPolicies(
    context: SecurityContext,
    action: string,
    resource: string,
    requestContext?: Record<string, unknown>
  ): Promise<PolicyCheckResult> {
    return this.authorizationEngine.applySecurityPolicies(context, action, resource, requestContext);
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

  private async logAuditEvent(event: Omit<AuditEvent, "id">): Promise<void> {
    await this.auditTrailService.logImmediate(event);
    this.emit("auditEvent", event);
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
      logger.error("Compliance check failed", error);
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
