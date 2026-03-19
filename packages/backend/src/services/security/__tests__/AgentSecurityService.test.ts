import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationEngine, createDefaultPermissions, createDefaultPolicies, createDefaultRoles } from "../AuthorizationEngine.js";
import { AgentSecurityService } from "../AgentSecurityService.js";
import { ComplianceReportService } from "../ComplianceReportService.js";
import { CredentialValidator } from "../CredentialValidator.js";
import { SecurityIncidentService } from "../SecurityIncidentService.js";
import type { AuditTrail, SecurityContext } from "../AgentSecurityTypes.js";

class InMemoryAuditTrailService {
  public readonly loggedEvents: Array<Omit<AuditTrail, "id">> = [];

  async logImmediate(event: Omit<AuditTrail, "id">): Promise<string> {
    this.loggedEvents.push(event);
    return `audit-${this.loggedEvents.length}`;
  }

  async query(filters?: {
    eventType?: AuditTrail["eventType"];
    actorId?: string;
    resourceType?: AuditTrail["resourceType"];
    timeRange?: { start: number; end: number };
    limit?: number;
  }): Promise<{ events: AuditTrail[]; total: number; hasMore: boolean }> {
    let events = this.loggedEvents.map((event, index) => ({
      ...event,
      id: `audit-${index + 1}`,
    }));

    if (filters?.eventType) {
      events = events.filter((event) => event.eventType === filters.eventType);
    }
    if (filters?.actorId) {
      events = events.filter((event) => event.actorId === filters.actorId);
    }
    if (filters?.resourceType) {
      events = events.filter((event) => event.resourceType === filters.resourceType);
    }
    if (filters?.timeRange) {
      events = events.filter(
        (event) =>
          event.timestamp >= filters.timeRange!.start && event.timestamp <= filters.timeRange!.end
      );
    }

    events = [...events].sort((a, b) => b.timestamp - a.timestamp);
    if (filters?.limit) {
      events = events.slice(0, filters.limit);
    }

    return { events, total: events.length, hasMore: false };
  }
}

describe("AgentSecurityService refactor boundaries", () => {
  let auditTrailService: InMemoryAuditTrailService;
  let service: AgentSecurityService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-19T12:00:00.000Z"));

    auditTrailService = new InMemoryAuditTrailService();
    service = new AgentSecurityService(
      {
        encryptionEnabled: false,
        sessionTimeout: 60_000,
      },
      {
        credentialValidator: new CredentialValidator({ mfaRequiredForPrivileged: true }),
        authorizationEngine: new AuthorizationEngine({
          permissions: createDefaultPermissions(),
          roles: createDefaultRoles(1_700_000_000_000),
          policies: createDefaultPolicies(),
        }),
        complianceReportService: new ComplianceReportService(),
        incidentService: new SecurityIncidentService(),
        auditTrailService,
        startBackgroundTasks: false,
      }
    );
  });

  it("validates api-key authentication via CredentialValidator", async () => {
    const context = await service.authenticateAgent(
      { apiKey: "ak_12345678901234567890123456789", keyId: "primary" },
      "api_key",
      {
        ipAddress: "10.0.0.5",
        userAgent: "vitest",
        sessionId: "session-1",
        tenantId: "tenant-1",
      }
    );

    expect(context.userId).toBe("agent_primary");
    expect(context.trustLevel).toBe("high");
    expect(context.authenticationMethod.mfaRequired).toBe(false);
    expect(auditTrailService.loggedEvents).toHaveLength(1);
    expect(auditTrailService.loggedEvents[0]?.eventType).toBe("authentication");
    expect(auditTrailService.loggedEvents[0]?.tenantId).toBe("tenant-1");
  });

  it("authorizes actions via AuthorizationEngine role and permission evaluation", async () => {
    const securityContext: SecurityContext = {
      tenantId: "tenant-1",
      userId: "agent_primary",
      agentId: "agent_primary",
      sessionId: "session-1",
      permissions: [],
      roles: ["agent"],
      authenticationMethod: {
        type: "api_key",
        credentials: { apiKey: "ak_12345678901234567890123456789" },
        mfaRequired: false,
      },
      trustLevel: "medium",
      timestamp: Date.now(),
    };

    const setContext = service as unknown as { securityContexts: Map<string, SecurityContext> };
    setContext.securityContexts.set("session-1", securityContext);

    const result = await service.authorizeAction("session-1", "write", "agent/123", {
      ipAddress: "203.0.113.10",
      userAgent: "vitest",
    });

    expect(result.granted).toBe(true);
    expect(result.reason).toBe("Authorized");
    expect(auditTrailService.loggedEvents.at(-1)?.eventType).toBe("authorization");
    expect(auditTrailService.loggedEvents.at(-1)?.outcome).toBe("success");
  });

  it("delegates audit trail reads to the injected audit service", async () => {
    await service.authenticateAgent(
      { apiKey: "ak_12345678901234567890123456789", keyId: "primary" },
      "api_key",
      {
        ipAddress: "198.51.100.10",
        userAgent: "vitest",
        sessionId: "session-2",
        tenantId: "tenant-2",
      }
    );

    const trail = await service.getAuditTrail({ eventType: "authentication", limit: 1 });

    expect(trail).toHaveLength(1);
    expect(trail[0]?.eventType).toBe("authentication");
    expect(trail[0]?.id).toBe("audit-1");
  });

  it("generates compliance reports through the dedicated compliance service", async () => {
    const reports = await service.checkCompliance(["SOC2", "GDPR"], {
      agents: ["agent_primary"],
      policies: ["session_policy"],
    });

    expect(reports).toHaveLength(2);
    expect(reports.map((report) => report.framework)).toEqual(["SOC2", "GDPR"]);
    expect(reports.every((report) => report.status === "compliant")).toBe(true);
  });

  it("creates and retrieves incidents through the incident service", async () => {
    const incidentId = await service.createSecurityIncident(
      "policy_violation",
      "high",
      "Suspicious mutation",
      "runtime",
      ["agent/123"],
      { signal: "manual-test" }
    );

    const incidents = service.getSecurityIncidents({ severity: "high" });

    expect(incidentId).toBeTruthy();
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.id).toBe(incidentId);
    expect(incidents[0]?.timeline[0]?.details).toEqual({ signal: "manual-test" });
    expect(auditTrailService.loggedEvents.at(-1)?.action).toBe("create_incident");
  });
});
