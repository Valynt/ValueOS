import { describe, expect, it, vi } from "vitest";

import { AgentSecurityService } from "../AgentSecurityService.js";
import type { AgentSecurityAuditStore } from "../AgentSecurityService.js";
import { ComplianceReportService } from "../ComplianceReportService.js";
import { CredentialValidator } from "../CredentialValidator.js";
import { SecurityIncidentService } from "../SecurityIncidentService.js";

describe("AgentSecurityService", () => {
  it("delegates audit writes and audit trail reads to the injected audit store", async () => {
    const auditStore: AgentSecurityAuditStore = {
      log: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([
        {
          id: "audit-1",
          eventType: "authorization",
          actorId: "user-1",
          actorType: "agent",
          resourceId: "agent/123",
          resourceType: "agent",
          action: "write",
          outcome: "success",
          details: {},
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
          timestamp: 10,
          sessionId: "session-1",
          correlationId: "corr-1",
          riskScore: 0.2,
          complianceFlags: [],
          tenantId: "tenant-1",
        },
      ]),
    };
    const service = new AgentSecurityService(
      { encryptionEnabled: false },
      {
        auditStore,
        credentialValidator: new CredentialValidator({ mfaRequiredForPrivileged: true }),
        complianceReportService: new ComplianceReportService(),
        securityIncidentService: new SecurityIncidentService(),
        startBackgroundTasks: false,
      }
    );

    await service.authenticateAgent(
      { apiKey: "ak_12345678901234567890123456789", keyId: "alpha" },
      "api_key",
      {
        ipAddress: "10.0.0.2",
        userAgent: "vitest",
        sessionId: "session-1",
        tenantId: "tenant-1",
      }
    );

    const trail = await service.getAuditTrail({ actorId: "user-1", limit: 5 });

    expect(auditStore.log).toHaveBeenCalled();
    expect(auditStore.query).toHaveBeenCalledWith({ actorId: "user-1", limit: 5 });
    expect(trail[0]?.id).toBe("audit-1");
  });

  it("creates incidents through the incident service and emits an audit event", async () => {
    const auditStore: AgentSecurityAuditStore = {
      log: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    };
    const service = new AgentSecurityService(
      { encryptionEnabled: false },
      {
        auditStore,
        credentialValidator: new CredentialValidator({ mfaRequiredForPrivileged: true }),
        complianceReportService: new ComplianceReportService(),
        securityIncidentService: new SecurityIncidentService(),
        startBackgroundTasks: false,
      }
    );

    const incidentId = await service.createSecurityIncident(
      "malicious_activity",
      "high",
      "Suspicious command execution",
      "runtime",
      ["agent/99"]
    );

    expect(incidentId).toBeTruthy();
    expect(service.getSecurityIncidents()).toHaveLength(1);
    expect(auditStore.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "security_event",
        action: "create_incident",
        resourceId: incidentId,
      })
    );
  });
});
