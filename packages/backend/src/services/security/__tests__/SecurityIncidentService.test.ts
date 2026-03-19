import { describe, expect, it } from "vitest";

import { SecurityIncidentService } from "../SecurityIncidentService.js";

describe("SecurityIncidentService", () => {
  it("creates incidents and returns newest incidents first when filtering", async () => {
    const service = new SecurityIncidentService();

    const firstIncident = await service.createSecurityIncident(
      "policy_violation",
      "medium",
      "Unexpected policy change",
      "policy-engine",
      ["policy/1"]
    );
    const secondIncident = await service.createSecurityIncident(
      "data_breach",
      "critical",
      "Sensitive export detected",
      "audit-monitor",
      ["dataset/9"]
    );

    const incidents = service.getSecurityIncidents({ severity: "critical" });

    expect(firstIncident.id).toBeDefined();
    expect(secondIncident.id).toBeDefined();
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.description).toBe("Sensitive export detected");
  });
});
