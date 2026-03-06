import { describe, expect, it } from "vitest";

import { validateEventPayload } from "./EventSchemas";

describe("validateEventPayload", () => {
  it("keeps checkpointIdempotencyKey for approval responses", () => {
    const payload = validateEventPayload("agent.action.checkpoint", {
      schemaVersion: "1.0.0",
      idempotencyKey: "response-1",
      checkpointIdempotencyKey: "checkpoint-1",
      emittedAt: "2026-01-01T00:00:00.000Z",
      tenantId: "tenant-1",
      sessionId: "session-1",
      userId: "user-1",
      actionType: "approval_response",
      actionData: { approved: true },
      requiresApproval: false,
      reason: "approved",
    });

    expect(payload.checkpointIdempotencyKey).toBe("checkpoint-1");
  });

  it("preserves unknown keys for forward-compatible checkpoint events", () => {
    const payload = validateEventPayload("agent.action.checkpoint", {
      schemaVersion: "1.0.0",
      idempotencyKey: "checkpoint-2",
      emittedAt: "2026-01-01T00:00:00.000Z",
      tenantId: "tenant-1",
      sessionId: "session-1",
      userId: "user-1",
      actionType: "commit_change",
      actionData: { branch: "main" },
      requiresApproval: true,
      reason: "Needs review",
      traceId: "trace-123",
    });

    expect(payload).toMatchObject({ traceId: "trace-123" });
  });
});
