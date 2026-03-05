import { describe, expect, it, vi } from "vitest";

import { HumanCheckpointEventPayload } from "@valueos/sdui";

import { HumanCheckpointBrokerAdapter } from "./HumanCheckpointBrokerAdapter";
import { RedisStreamBroker, StreamEvent } from "./RedisStreamBroker";

function createPayload(overrides: Partial<HumanCheckpointEventPayload> = {}): HumanCheckpointEventPayload {
  return {
    schemaVersion: "1.0.0",
    idempotencyKey: "checkpoint-1",
    emittedAt: "2026-01-01T00:00:00.000Z",
    tenantId: "tenant-1",
    sessionId: "session-1",
    userId: "user-1",
    actionType: "commit_change",
    actionData: { branch: "main" },
    requiresApproval: true,
    reason: "Needs review",
    ...overrides,
  };
}

describe("HumanCheckpointBrokerAdapter", () => {
  it("starts a single consumer and fans out events to active subscribers", async () => {
    let consumerHandler: ((event: StreamEvent<"agent.action.checkpoint">) => Promise<void>) | undefined;

    const startConsumer = vi.fn(async (handler: typeof consumerHandler) => {
      consumerHandler = handler;
    });

    const redisBroker = {
      publish: vi.fn(),
      startConsumer,
    } as unknown as RedisStreamBroker;

    const adapter = new HumanCheckpointBrokerAdapter(redisBroker);
    const handlerA = vi.fn();
    const handlerB = vi.fn();

    const unsubscribeA = adapter.subscribe(handlerA);
    adapter.subscribe(handlerB);

    expect(startConsumer).toHaveBeenCalledTimes(1);

    await consumerHandler?.({
      id: "stream-id-1",
      name: "agent.action.checkpoint",
      payload: createPayload(),
      attempt: 0,
    });

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);

    unsubscribeA();

    await consumerHandler?.({
      id: "stream-id-2",
      name: "agent.action.checkpoint",
      payload: createPayload({ idempotencyKey: "checkpoint-2" }),
      attempt: 0,
    });

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(2);
  });

  it("publishes checkpoint events including tenant/session/idempotency linkage", async () => {
    const publish = vi.fn(async () => "message-id-1");
    const redisBroker = {
      publish,
      startConsumer: vi.fn(),
    } as unknown as RedisStreamBroker;

    const adapter = new HumanCheckpointBrokerAdapter(redisBroker);
    const payload = createPayload({
      requiresApproval: false,
      actionType: "approval_response",
      checkpointIdempotencyKey: "checkpoint-1",
    });

    await adapter.publishCheckpointEvent(payload);

    expect(publish).toHaveBeenCalledWith("agent.action.checkpoint", payload);
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
