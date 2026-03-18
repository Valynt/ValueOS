import { beforeEach, describe, expect, it, vi } from "vitest";

import { securityAuditService } from "../post-v1/SecurityAuditService.js";
import {
  mapAuditPayloadToLegacyShape,
  requiredAuditPayloadSchema,
} from "../security/auditPayloadContract.js";

const insertMock = vi.fn();

vi.mock("../../lib/supabase.js", () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      insert: insertMock,
    }),
  }),
}));

describe("audit payload contract", () => {
  beforeEach(() => {
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
  });

  it("accepts the required canonical payload shape", () => {
    const parsed = requiredAuditPayloadSchema.parse({
      actor: "user@example.com",
      action_type: "update",
      resource_type: "opportunity",
      resource_id: "opp-1",
      request_path: "/api/opportunities/opp-1",
      ip_address: "127.0.0.1",
      user_agent: "vitest",
      outcome: "success",
      status_code: 200,
      timestamp: new Date().toISOString(),
      correlation_id: "req-1",
    });

    expect(parsed.action_type).toBe("update");
    expect(parsed.resource_type).toBe("opportunity");
  });

  it("rejects payloads missing required contract fields", () => {
    expect(() =>
      requiredAuditPayloadSchema.parse({
        actor: "user@example.com",
        action_type: "update",
      })
    ).toThrow();
  });

  it("writes canonical fields once and preserves legacy mapper shape", async () => {
    await securityAuditService.logRequestEvent({
      correlation_id: "req-22",
      actor: "user@example.com",
      action_type: "delete",
      resource_type: "workflow",
      resource_id: "wf-22",
      request_path: "/api/workflows/wf-22",
      ip_address: "127.0.0.1",
      user_agent: "vitest",
      outcome: "failed",
      status_code: 403,
      timestamp: new Date().toISOString(),
      userId: "user-1",
      eventData: {
        message: "denied",
        ip_address: "duplicate-should-be-removed",
      },
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    const inserted = insertMock.mock.calls[0]?.[0] as {
      event_data: Record<string, unknown>;
      ip_address: string;
    };
    expect(inserted.ip_address).toBe("127.0.0.1");
    expect(inserted.event_data.ip_address).toBeUndefined();
    expect(inserted.event_data.legacy).toEqual(
      mapAuditPayloadToLegacyShape({
        actor: "user@example.com",
        action_type: "delete",
        resource_type: "workflow",
        resource_id: "wf-22",
        request_path: "/api/workflows/wf-22",
        ip_address: "127.0.0.1",
        user_agent: "vitest",
        outcome: "failed",
        status_code: 403,
        timestamp: (inserted.event_data.legacy as { timestamp: string }).timestamp,
        correlation_id: "req-22",
      })
    );
  });
});
