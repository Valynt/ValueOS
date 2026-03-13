import { describe, expect, it, vi } from "vitest";

import { SecurityEventStreamingService } from "../SecurityEventStreamingService.js";

const forwardMock = vi.fn();

vi.mock("../SiemExportForwarderService.js", () => ({
  siemExportForwarderService: {
    forward: forwardMock,
  },
}));

describe("SecurityEventStreamingService", () => {
  it("normalizes events before forwarding to SIEM", async () => {
    forwardMock.mockResolvedValue(undefined);
    const service = new SecurityEventStreamingService();

    await service.stream({
      source: "audit_logs",
      category: "policy",
      eventType: "model_denied",
      tenantId: "tenant-1",
      actorId: "user-1",
      action: "model_denied",
      resourceType: "policy",
      resourceId: "gpt-4",
      outcome: "denied",
      sourceService: "PolicyEnforcement",
      metadata: { reason: "not allowed" },
    });

    expect(forwardMock).toHaveBeenCalledTimes(1);
    const forwardedPayload = forwardMock.mock.calls[0][0];
    expect(forwardedPayload.source).toBe("audit_logs");
    expect(forwardedPayload.tenantId).toBe("tenant-1");
    expect(forwardedPayload.payload).toMatchObject({
      event_category: "policy",
      event_type: "model_denied",
      tenant_id: "tenant-1",
      actor_id: "user-1",
      source_service: "PolicyEnforcement",
      metadata: { reason: "not allowed" },
    });
  });
});
