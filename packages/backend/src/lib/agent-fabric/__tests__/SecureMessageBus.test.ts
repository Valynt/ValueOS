import { describe, expect, it, vi } from "vitest";

const { publishMock, startConsumerMock } = vi.hoisted(() => ({
  publishMock: vi.fn().mockResolvedValue("stream-id"),
  startConsumerMock: vi.fn(),
}));

vi.mock("../../../services/messaging/RedisStreamBroker", () => ({
  redisStreamBroker: {
    publish: publishMock,
  },
  RedisStreamBroker: class MockRedisStreamBroker {
    async startConsumer(handler: (event: { name: string; payload: { message: unknown } }) => Promise<void>) {
      return startConsumerMock(handler);
    }
  },
}));

import { createAgentIdentity } from "../../auth/AgentIdentity";
import { SecureMessageBus } from "../SecureMessageBus";

describe("SecureMessageBus tenant isolation", () => {
  it("rejects publish when tenant context is absent", async () => {
    const bus = new SecureMessageBus();

    await expect(
      bus.send("agent-a", "agent-b", { ok: true }, {
        tenantContext: { tenantId: "", organizationId: "" },
      })
    ).rejects.toThrow("Tenant context is required for SecureMessageBus.publish");
  });

  it("resolves sender tenant context from authenticated agent identity", async () => {
    const bus = new SecureMessageBus();
    const senderIdentity = createAgentIdentity("agent-a", "opportunity", "tenant-a");

    const message = await bus.send(senderIdentity, "agent-b", { ok: true }, {
      tenantContext: { tenantId: "tenant-a", organizationId: "tenant-a" },
      metadata: { tenant_id: "tenant-a" },
    });

    expect(message.tenantContext).toEqual({
      tenantId: "tenant-a",
      organizationId: "tenant-a",
    });
  });

  it("blocks mixed-tenant async publish attempts", async () => {
    const bus = new SecureMessageBus();
    const senderIdentity = createAgentIdentity("agent-a", "opportunity", "tenant-a");

    await expect(
      bus.send(senderIdentity, "agent-b", { ok: true }, {
        tenantContext: { tenantId: "tenant-b", organizationId: "tenant-b" },
      })
    ).rejects.toThrow("Tenant context organization does not match resolved sender organization");
  });

  it("rejects consume when broker event tenant context is absent", async () => {
    const bus = new SecureMessageBus();
    bus.configureConsumerGroup("integrity", {
      agentType: "integrity",
      groupSize: 1,
      ackOnStateUpdate: false,
    });

    startConsumerMock.mockImplementationOnce(async (handler) => {
      await expect(
        handler({
          name: "agent_message",
          payload: {
            message: {
              id: "msg-1",
              fromAgentId: "agent-a",
              toAgentId: "agent-b",
              payload: {},
              priority: "normal",
              encrypted: false,
              timestamp: new Date(),
            },
          },
        })
      ).rejects.toThrow("Tenant context is required for SecureMessageBus.consume");
    });

    await bus.startConsumerForAgentType("integrity", vi.fn());
  });
});
