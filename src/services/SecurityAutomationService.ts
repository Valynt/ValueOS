import { SupabaseClient } from "@supabase/supabase-js";
import { TenantAwareService } from "./TenantAwareService";
import { AdvancedThreatDetectionService, SecurityEvent } from "./AdvancedThreatDetectionService";
import { log } from "../lib/logger";
import { auditLogService, AuditLogService } from "./AuditLogService";

export interface SecurityIncident {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "detected" | "investigating" | "contained" | "resolved" | "false_positive";
  incidentType: string;
  affectedResources: string[];
  detectedAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
  threatIndicators: string[];
  riskScore: number;
  impact: {
    usersAffected: number;
    dataCompromised: boolean;
    serviceDisruption: boolean;
  };
}

export interface AutomatedResponse {
  id: string;
  incidentId: string;
  actionType: "alert" | "block" | "quarantine" | "isolate" | "notify" | "remediate";
  description: string;
  status: "pending" | "executing" | "completed" | "failed";
  executedAt?: Date;
  result?: string;
  automated: boolean;
  priority: "low" | "medium" | "high" | "critical";
}

export interface SecurityPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: "access_control" | "data_protection" | "network_security" | "compliance" | "monitoring";
  rules: PolicyRule[];
  enforcement: "prevent" | "detect" | "alert";
  priority: "low" | "medium" | "high" | "critical";
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyRule {
  id: string;
  condition: {
    eventType?: string;
    userAttribute?: string;
    resourceAttribute?: string;
    timeWindow?: number;
    threshold?: number;
  };
  action: {
    type: "allow" | "deny" | "alert" | "quarantine" | "notify";
    parameters?: Record<string, any>;
  };
}

export class SecurityAutomationService extends TenantAwareService {
  private threatDetectionService: AdvancedThreatDetectionService;
  private auditLog: AuditLogService;

  constructor(supabase: SupabaseClient, threatDetectionService: AdvancedThreatDetectionService) {
    super("SecurityAutomationService");
    this.supabase = supabase;
    this.threatDetectionService = threatDetectionService;
    this.auditLog = auditLogService;
  }

  /**
   * Processes security events and triggers automated responses
   * Supports both user-initiated and system-initiated events
   */
  async processSecurityEvent(event: {
    tenantId: string;
    eventType: string;
    userId?: string;
    resourceId?: string;
    details: Record<string, any>;
  }): Promise<{
    incidentCreated: boolean;
    incident?: SecurityIncident;
    responsesTriggered: AutomatedResponse[];
  }> {
    // For system-initiated events (no userId), verify tenant exists instead of user access
    // This allows automated security processing without a user context
    if (event.userId) {
      await this.validateTenantAccess(event.userId, event.tenantId);
    } else {
      // System-initiated event: verify tenant is valid
      const { data: tenant, error } = await this.supabase
        .from("tenants")
        .select("id")
        .eq("id", event.tenantId)
        .eq("status", "active")
        .maybeSingle();

      if (error || !tenant) {
        log.error("System security event for invalid tenant", undefined, {
          tenantId: event.tenantId,
          eventType: event.eventType,
        });
        throw new Error(`Invalid tenant for system security event: ${event.tenantId}`);
      }
    }

    // Analyze the event for threats
    const threatAnalysis = await this.threatDetectionService.analyzeSecurityEvent({
      tenantId: event.tenantId,
      userId: event.userId,
      eventType: event.eventType,
      severity: this.determineSeverity(event),
      source: "security_automation",
      details: event.details,
    });

    let incident: SecurityIncident | undefined;
    let incidentCreated = false;

    // Create incident if threats detected
    if (threatAnalysis.threats.length > 0) {
      const firstThreat = threatAnalysis.threats[0]!;
      incident = await this.createSecurityIncident({
        tenantId: event.tenantId,
        title: this.generateIncidentTitle(firstThreat, event),
        description: `Automated detection: ${threatAnalysis.threats.map((t) => t.name).join(", ")}`,
        severity: firstThreat.severity,
        incidentType: firstThreat.category,
        affectedResources: [event.resourceId || "unknown"],
        threatIndicators: threatAnalysis.threats.map((t) => t.id),
        riskScore: threatAnalysis.riskScore,
      });
      incidentCreated = true;
    }

    // Generate incident response actions
    const responsesTriggered = incident
      ? await this.generateIncidentResponse(threatAnalysis.threats, incident)
      : [];

    // Execute automated responses
    for (const response of responsesTriggered) {
      if (response.automated) {
        await this.executeAutomatedResponse(response);
      }
    }

    // Enforce security policies
    await this.enforceSecurityPolicies(event);

    log.info("Security event processed", {
      tenantId: event.tenantId,
      eventType: event.eventType,
      incidentCreated,
      responsesTriggered: responsesTriggered.length,
      threatCount: threatAnalysis.threats.length,
    });

    return {
      incidentCreated,
      incident,
      responsesTriggered,
    };
  }

  /**
   * Enforces security policies based on the event
   */
  async enforceSecurityPolicies(event: {
    tenantId: string;
    eventType: string;
    userId?: string;
    resourceId?: string;
    details: Record<string, any>;
  }): Promise<{
    policiesApplied: number;
    actionsTaken: AutomatedResponse[];
  }> {
    const policies = await this.getActivePolicies(event.tenantId);
    const actionsTaken: AutomatedResponse[] = [];

    for (const policy of policies) {
      const shouldApply = this.evaluatePolicyRules(policy, event);

      if (shouldApply) {
        const action = await this.executePolicyAction(policy, event);
        if (action) {
          actionsTaken.push(action);
        }
      }
    }

    return {
      policiesApplied: policies.length,
      actionsTaken,
    };
  }

  /**
   * Executes automated remediation for security incidents
   */
  async executeAutomatedRemediation(
    incidentId: string,
    tenantId: string
  ): Promise<{
    actionsCompleted: number;
    successRate: number;
    details: string[];
  }> {
    await this.validateTenantAccess("system", tenantId);

    const incident = await this.queryWithTenantCheck("security_incidents", "system", {
      id: incidentId,
      tenant_id: tenantId,
    });

    if (!incident || incident.length === 0) {
      throw new Error("Incident not found");
    }

    const responses = await this.queryWithTenantCheck("automated_responses", "system", {
      incident_id: incidentId,
      automated: true,
      status: "pending",
    });

    // Transform database results to match TypeScript interface
    const transformedResponses = (responses as any[]).map((r: any) => ({
      ...r,
      incidentId: r.incident_id,
      actionType: r.action_type,
      executedAt: r.executed_at,
    }));

    const details: string[] = [];
    let completed = 0;

    for (const response of responses as AutomatedResponse[]) {
      try {
        await this.executeAutomatedResponse(response);
        completed++;
        details.push(`✅ ${response.actionType}: ${response.description}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        details.push(`❌ ${response.actionType}: ${errorMsg}`);
      }
    }

    const successRate = responses.length > 0 ? (completed / responses.length) * 100 : 100;

    // Update incident status if all automated responses completed
    if (completed === responses.length && responses.length > 0) {
      await this.updateIncidentStatus(incidentId, tenantId, "contained");
    }

    await this.auditLog.logAudit({
      userId: "system",
      userName: "System",
      userEmail: "system@valueos.internal",
      action: "remediation.executed",
      resourceType: "security_incident",
      resourceId: incidentId,
      details: {
        tenantId,
        actionsCompleted: completed,
        successRate,
        totalActions: responses.length,
      },
      status: successRate === 100 ? "success" : "failed",
    });

    return {
      actionsCompleted: completed,
      successRate,
      details,
    };
  }

  /**
   * Creates and manages security policies
   */
  async createSecurityPolicy(
    policy: Omit<SecurityPolicy, "id" | "createdAt" | "updatedAt">
  ): Promise<SecurityPolicy> {
    await this.validateTenantAccess("system", policy.tenantId);

    const newPolicy: SecurityPolicy = {
      ...policy,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.insertWithTenantCheck("security_policies", "system", policy.tenantId, {
      id: newPolicy.id,
      tenant_id: newPolicy.tenantId,
      name: newPolicy.name,
      description: newPolicy.description,
      category: newPolicy.category,
      rules: newPolicy.rules,
      enforcement: newPolicy.enforcement,
      priority: newPolicy.priority,
      enabled: newPolicy.enabled,
      created_at: newPolicy.createdAt,
      updated_at: newPolicy.updatedAt,
    });

    await this.auditLog.logAudit({
      userId: "system",
      userName: "System",
      userEmail: "system@valueos.internal",
      action: "policy.created",
      resourceType: "security_policy",
      resourceId: newPolicy.id,
      details: {
        tenantId: policy.tenantId,
        policyName: policy.name,
        category: policy.category,
      },
      status: "success",
    });

    log.info("Security policy created", {
      policyId: newPolicy.id,
      tenantId: policy.tenantId,
      name: policy.name,
    });

    return newPolicy;
  }

  /**
   * Monitors and reports on security automation effectiveness
   */
  async generateSecurityAutomationReport(
    tenantId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    incidentsDetected: number;
    automatedResponses: number;
    manualInterventions: number;
    falsePositives: number;
    averageResponseTime: number;
    policiesEnforced: number;
    effectiveness: {
      detectionAccuracy: number;
      automationSuccessRate: number;
      incidentResolutionTime: number;
    };
  }> {
    await this.validateTenantAccess("system", tenantId);

    // Get incidents in time range
    const incidents = await this.queryWithTenantCheck("security_incidents", "system", {
      tenant_id: tenantId,
      detected_at: { gte: timeRange.start, lte: timeRange.end },
    });

    // Get automated responses
    const responses = await this.queryWithTenantCheck("automated_responses", "system", {
      tenant_id: tenantId,
      executed_at: { gte: timeRange.start, lte: timeRange.end },
    });

    // Calculate metrics
    const incidentsDetected = incidents.length;
    const automatedResponses = responses.filter((r: any) => r.automated).length;
    const manualInterventions = responses.filter((r: any) => !r.automated).length;
    const falsePositives = incidents.filter((i: any) => i.status === "false_positive").length;

    const responseTimes = responses
      .filter((r: any) => r.executed_at)
      .map((r: any) => new Date(r.executed_at).getTime() - new Date(r.created_at).getTime());

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
        : 0;

    // Get policy enforcement data
    const policies = await this.getActivePolicies(tenantId);
    const policiesEnforced = policies.length;

    // Calculate effectiveness metrics
    const resolvedIncidents = incidents.filter((i: any) => i.status === "resolved");
    const detectionAccuracy =
      incidents.length > 0 ? ((incidents.length - falsePositives) / incidents.length) * 100 : 100;

    const automationSuccessRate =
      responses.length > 0
        ? (responses.filter((r: any) => r.status === "completed").length / responses.length) * 100
        : 100;

    const incidentResolutionTime =
      resolvedIncidents.length > 0
        ? resolvedIncidents.reduce(
            (acc: number, i: any) =>
              acc + (new Date(i.resolvedAt).getTime() - new Date(i.detectedAt).getTime()),
            0
          ) / resolvedIncidents.length
        : 0;

    return {
      incidentsDetected,
      automatedResponses,
      manualInterventions,
      falsePositives,
      averageResponseTime,
      policiesEnforced,
      effectiveness: {
        detectionAccuracy,
        automationSuccessRate,
        incidentResolutionTime,
      },
    };
  }

  // Private helper methods
  private async createSecurityIncident(incidentData: {
    tenantId: string;
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    incidentType: string;
    affectedResources: string[];
    threatIndicators: string[];
    riskScore: number;
  }): Promise<SecurityIncident> {
    const incident: SecurityIncident = {
      id: crypto.randomUUID(),
      tenantId: incidentData.tenantId,
      title: incidentData.title,
      description: incidentData.description,
      severity: incidentData.severity,
      status: "detected",
      incidentType: incidentData.incidentType,
      affectedResources: incidentData.affectedResources,
      detectedAt: new Date(),
      threatIndicators: incidentData.threatIndicators,
      riskScore: incidentData.riskScore,
      impact: {
        usersAffected: 0,
        dataCompromised: false,
        serviceDisruption: false,
      },
    };

    await this.supabase.from("security_incidents").insert({
      id: incident.id,
      tenant_id: incident.tenantId,
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      status: incident.status,
      incident_type: incident.incidentType,
      affected_resources: incident.affectedResources,
      detected_at: incident.detectedAt,
      threat_indicators: incident.threatIndicators,
      risk_score: incident.riskScore,
      impact: incident.impact,
    });

    await this.auditLog.logAudit({
      userId: "system",
      userName: "System",
      userEmail: "system@valueos.internal",
      action: "incident.created",
      resourceType: "security_incident",
      resourceId: incident.id,
      details: {
        tenantId: incident.tenantId,
        severity: incident.severity,
        incidentType: incident.incidentType,
        riskScore: incident.riskScore,
      },
      status: incident.severity === "critical" ? "failed" : "success",
    });

    log.warn("Security incident created", {
      incidentId: incident.id,
      tenantId: incident.tenantId,
      severity: incident.severity,
      title: incident.title,
    });

    return incident;
  }

  private async generateIncidentResponse(
    threats: any[],
    incident: SecurityIncident
  ): Promise<AutomatedResponse[]> {
    const responses: AutomatedResponse[] = [];

    for (const threat of threats) {
      const securityEvent: SecurityEvent = {
        id: incident.id,
        tenantId: incident.tenantId,
        eventType: incident.incidentType,
        severity: incident.severity,
        source: "security_incident",
        details: { incidentTitle: incident.title },
        timestamp: incident.detectedAt,
        riskScore: incident.riskScore,
      };
      const responseActions = await this.threatDetectionService.generateIncidentResponse(
        threat,
        securityEvent
      );

      if (responseActions && responseActions.actions) {
        for (const action of responseActions.actions) {
          const response: AutomatedResponse = {
            id: crypto.randomUUID(),
            incidentId: incident.id,
            actionType: action.type as any,
            description: action.description,
            status: "pending",
            automated: action.automated,
            priority: action.priority as any,
          };

          responses.push(response);

          // Store the response
          await this.supabase.from("automated_responses").insert({
            id: response.id,
            incident_id: response.incidentId,
            action_type: response.actionType,
            description: response.description,
            status: response.status,
            automated: response.automated,
            priority: response.priority,
            created_at: new Date(),
          });
        }
      }
    }

    return responses;
  }

  private async executeAutomatedResponse(response: AutomatedResponse): Promise<void> {
    try {
      response.status = "executing";

      // Update status in database
      await this.supabase
        .from("automated_responses")
        .update({
          status: response.status,
          executed_at: new Date(),
        })
        .eq("id", response.id);

      // Execute the specific action
      switch (response.actionType) {
        case "alert":
          await this.executeAlertAction(response);
          break;
        case "block":
          await this.executeBlockAction(response);
          break;
        case "quarantine":
          await this.executeQuarantineAction(response);
          break;
        case "notify":
          await this.executeNotifyAction(response);
          break;
        default:
          throw new Error(`Unknown action type: ${response.actionType}`);
      }

      response.status = "completed";
      response.result = "Action completed successfully";
    } catch (error) {
      response.status = "failed";
      response.result = `Action failed: ${(error as Error).message}`;

      log.error("Automated response failed", undefined, {
        responseId: response.id,
        incidentId: response.incidentId,
        actionType: response.actionType,
        errorMsg: (error as Error).message,
      });
    }

    // Update final status
    await this.supabase
      .from("automated_responses")
      .update({
        status: response.status,
        result: response.result,
        executed_at: new Date(),
      })
      .eq("id", response.id);
  }

  private async getActivePolicies(tenantId: string): Promise<SecurityPolicy[]> {
    const policies = await this.queryWithTenantCheck("security_policies", "system", {
      tenant_id: tenantId,
      enabled: true,
    });

    return policies.map((p: any) => ({
      id: p.id,
      tenantId: p.tenant_id,
      name: p.name,
      description: p.description,
      category: p.category,
      rules: p.rules,
      enforcement: p.enforcement,
      priority: p.priority,
      enabled: p.enabled,
      createdAt: new Date(p.created_at),
      updatedAt: new Date(p.updated_at),
    }));
  }

  private evaluatePolicyRules(policy: SecurityPolicy, event: any): boolean {
    // Simple rule evaluation - can be extended with more complex logic
    for (const rule of policy.rules) {
      let matches = true;

      if (rule.condition.eventType && rule.condition.eventType !== event.eventType) {
        matches = false;
      }

      if (rule.condition.userAttribute && event.userId) {
        // Check user attribute matching logic
        matches = matches && this.checkUserAttribute(event.userId, rule.condition.userAttribute);
      }

      if (matches) {
        return true;
      }
    }

    return false;
  }

  private async executePolicyAction(
    policy: SecurityPolicy,
    event: any
  ): Promise<AutomatedResponse | null> {
    // Find the matching rule
    const matchingRule = policy.rules.find((_rule) => this.evaluatePolicyRules(policy, event));
    if (!matchingRule) return null;

    const response: AutomatedResponse = {
      id: crypto.randomUUID(),
      incidentId: "policy_enforcement",
      actionType: matchingRule.action.type as any,
      description: `Policy enforcement: ${policy.name} - ${matchingRule.action.type}`,
      status: "pending",
      automated: true,
      priority: policy.priority as any,
    };

    // Execute the action
    await this.executeAutomatedResponse(response);

    return response;
  }

  private async updateIncidentStatus(
    incidentId: string,
    _tenantId: string,
    status: SecurityIncident["status"]
  ): Promise<void> {
    await this.updateWithTenantCheck("security_incidents", "system", incidentId, {
      status,
      resolved_at: status === "resolved" ? new Date() : undefined,
    });
  }

  // Action execution methods
  private async executeAlertAction(response: AutomatedResponse): Promise<void> {
    // Send alert to security team
    log.warn("Security alert triggered", {
      responseId: response.id,
      description: response.description,
    });

    // In a real implementation, this would send emails, Slack notifications, etc.
  }

  private async executeBlockAction(response: AutomatedResponse): Promise<void> {
    // Implement blocking logic (IP block, user suspension, etc.)
    log.warn("Blocking action executed", {
      responseId: response.id,
      description: response.description,
    });
  }

  private async executeQuarantineAction(response: AutomatedResponse): Promise<void> {
    // Implement quarantine logic
    log.warn("Quarantine action executed", {
      responseId: response.id,
      description: response.description,
    });
  }

  private async executeNotifyAction(response: AutomatedResponse): Promise<void> {
    // Send notifications to stakeholders
    log.info("Notification sent", {
      responseId: response.id,
      description: response.description,
    });
  }

  // Utility methods
  private determineSeverity(event: any): "low" | "medium" | "high" | "critical" {
    // Simple severity determination - can be enhanced
    if (event.eventType.includes("brute_force") || event.eventType.includes("exploit")) {
      return "critical";
    }
    if (event.eventType.includes("failed") || event.eventType.includes("suspicious")) {
      return "high";
    }
    return "medium";
  }

  private generateIncidentTitle(threat: any, _event: any): string {
    return `${threat.category.toUpperCase()}: ${threat.name}`;
  }

  private checkUserAttribute(_userId: string, _attribute: string): boolean {
    // Placeholder for user attribute checking
    // In a real implementation, this would check user roles, departments, etc.
    return true;
  }
}
