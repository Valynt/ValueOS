import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { secureMessageBus } from "../../../lib/agent-fabric/SecureMessageBus";
import { AgentIdentity } from "../../../lib/auth/AgentIdentity";

// Mock uuid
vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("test-uuid-1234"),
}));

// Mock secureMessageBus
vi.mock("../../../lib/agent-fabric/SecureMessageBus", () => ({
  secureMessageBus: {
    send: vi.fn().mockResolvedValue({ id: "mock-msg-id" }),
    subscribe: vi.fn(),
  },
}));

// Mock the global logger from @shared/lib/logger
vi.mock("@shared/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withContext: vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    })
  },
  createLogger: vi.fn()
}));

import { AgentMessageBroker, AgentRegistration, getAgentMessageBroker } from "../AgentMessageBroker";

describe("AgentMessageBroker", () => {
  let broker: AgentMessageBroker;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance by replacing it using dynamic import or directly
    // Reset the internal instance by re-instantiating. Since we can't easily reset the exported singleton var directly in pure TS without reflection:
    // We will just create a new instance for tests where we need a clean slate.
    broker = new AgentMessageBroker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getAgentMessageBroker", () => {
    it("should return an instance of AgentMessageBroker", () => {
      const instance = getAgentMessageBroker();
      expect(instance).toBeInstanceOf(AgentMessageBroker);
    });

    it("should return the exact same instance on multiple calls (singleton)", () => {
      const instance1 = getAgentMessageBroker();
      const instance2 = getAgentMessageBroker();
      expect(instance1).toBe(instance2);
    });
  });

  describe("Agent Registration", () => {
    let mockRegistration: AgentRegistration;

    beforeEach(() => {
      mockRegistration = {
        agentId: "test-agent-1",
        agentType: "test-type",
        agentInstance: {} as any, // Mocking BaseAgent
        identity: {
          agent_id: "test-agent-1",
          agent_type: "test-type",
          organization_id: "org-1",
          permissions: [],
          issued_at: "",
          expires_at: "",
        },
      };
    });

    it("should register an agent and update registry state", () => {
      broker.registerAgent(mockRegistration);

      expect(broker.isAgentRegistered("test-agent-1")).toBe(true);
      expect(broker.getAgent("test-agent-1")).toBe(mockRegistration);
      expect(broker.getRegisteredAgents()).toContain(mockRegistration);
    });

    it("should unregister an agent", () => {
      broker.registerAgent(mockRegistration);
      expect(broker.isAgentRegistered("test-agent-1")).toBe(true);

      broker.unregisterAgent("test-agent-1");
      expect(broker.isAgentRegistered("test-agent-1")).toBe(false);
      expect(broker.getAgent("test-agent-1")).toBeUndefined();
    });

    it("should handle unregistering non-existent agent gracefully", () => {
      expect(() => broker.unregisterAgent("non-existent")).not.toThrow();
    });
  });

  describe("Message Sending", () => {
    let mockSender: AgentRegistration;
    let mockRecipient: AgentRegistration;

    beforeEach(() => {
      mockSender = {
        agentId: "sender-1",
        agentType: "type-1",
        agentInstance: {} as any,
        identity: {
          agent_id: "sender-1",
          agent_type: "type-1",
          organization_id: "org-1",
          permissions: [],
          issued_at: "",
          expires_at: "",
        },
      };

      mockRecipient = {
        agentId: "recipient-1",
        agentType: "type-2",
        agentInstance: {} as any,
        identity: {
          agent_id: "recipient-1",
          agent_type: "type-2",
          organization_id: "org-1",
          permissions: [],
          issued_at: "",
          expires_at: "",
        },
      };

      broker.registerAgent(mockSender);
      broker.registerAgent(mockRecipient);
      vi.useFakeTimers();
    });

    it("should reject message if recipient is not registered", async () => {
      const response = await broker.sendMessage({
        fromAgentId: "sender-1",
        toAgentId: "non-existent",
        payload: { test: true },
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain("Recipient agent not found: non-existent");
    });

    it("should reject message if sender is not registered", async () => {
      const response = await broker.sendMessage({
        fromAgentId: "non-existent",
        toAgentId: "recipient-1",
        payload: { test: true },
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain("Sender agent not found: non-existent");
    });

    it("should handle timeout when no response is received", async () => {
      const sendPromise = broker.sendMessage({
        fromAgentId: "sender-1",
        toAgentId: "recipient-1",
        payload: { test: true },
        timeoutMs: 1000,
      });

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(1100);

      const response = await sendPromise;
      expect(response.success).toBe(false);
      expect(response.error).toContain("Message timeout after 1000ms");
    });

    it("should successfully send a message and resolve when response is received", async () => {
      // Setup the subscribe callback capture so we can simulate the response
      const subscribeHandler = (vi.mocked(secureMessageBus.subscribe).mock.calls.find(call => call[0] === "message-broker") as any)?.[1];

      const sendPromise = broker.sendMessage({
        fromAgentId: "sender-1",
        toAgentId: "recipient-1",
        payload: { test: true },
        correlationId: "custom-corr-id",
      });

      // Assert it calls secureMessageBus.send
      expect(secureMessageBus.send).toHaveBeenCalledWith(
        mockSender.identity,
        "recipient-1",
        { test: true },
        expect.objectContaining({
          correlationId: "custom-corr-id",
          replyTo: "sender-1",
        })
      );

      // Simulate incoming response matching correlationId
      await subscribeHandler({
        id: "response-id",
        fromAgentId: "recipient-1",
        toAgentId: "sender-1",
        tenantContext: { tenantId: "org-1", organizationId: "org-1" },
        payload: { success: true },
        priority: "normal",
        encrypted: false,
        correlationId: "custom-corr-id",
        timestamp: new Date()
      }, mockRecipient.identity);

      const response = await sendPromise;
      expect(response.success).toBe(true);
      expect(response.response).toEqual({ success: true });
    });

    describe("sendToAgent (Simplified interface)", () => {
      it("should return typed data on success", async () => {
        // Mock sendMessage to return success response
        vi.spyOn(broker, "sendMessage").mockResolvedValue({
          success: true,
          response: { customData: "123" },
          deliveryTime: 10,
        });

        const result = await broker.sendToAgent<{ customData: string }>(
          "sender-1",
          "recipient-1",
          { payload: true }
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ customData: "123" });
      });

      it("should return error on failure", async () => {
        // Mock sendMessage to return failed response
        vi.spyOn(broker, "sendMessage").mockResolvedValue({
          success: false,
          error: "Some failure",
          deliveryTime: 10,
        });

        const result = await broker.sendToAgent(
          "sender-1",
          "recipient-1",
          { payload: true }
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Some failure");
        expect(result.data).toBeUndefined();
      });
    });
  });

  describe("Statistics", () => {
    it("should return valid initial statistics", () => {
      const stats = broker.getStats();
      expect(stats).toEqual({
        registeredAgents: 0,
        pendingMessages: 0,
        queuedMessages: 0,
        activeConnections: 0, // Mock connection pool is 0 initially
      });
    });

    it("should update stats when an agent is registered", () => {
      broker.registerAgent({
        agentId: "stat-agent-1",
        agentType: "type-1",
        agentInstance: {} as any,
        identity: {} as any,
      });

      const stats = broker.getStats();
      expect(stats.registeredAgents).toBe(1);
    });
  });

  describe("Message Handling", () => {
    let mockRecipient: AgentRegistration;
    let subscribeHandler: (message: any, sender: any) => Promise<void>;

    beforeEach(() => {
      mockRecipient = {
        agentId: "handling-recipient",
        agentType: "type-handle",
        agentInstance: {
          handleIncomingMessage: vi.fn().mockResolvedValue(undefined),
        } as any,
        identity: {
          agent_id: "handling-recipient",
          agent_type: "type-handle",
          organization_id: "org-1",
          permissions: [],
          issued_at: "",
          expires_at: "",
        },
      };

      broker.registerAgent(mockRecipient);

      // Extract the bound handler
      const calls = vi.mocked(secureMessageBus.subscribe).mock.calls;
      subscribeHandler = calls.find(call => call[0] === "message-broker")?.[1] as any;
    });

    it("should route incoming message to recipient agent's handleIncomingMessage", async () => {
      await subscribeHandler({
        id: "msg-123",
        to: "handling-recipient",
        from: "external-sender",
        tenantContext: { tenantId: "org-1", organizationId: "org-1" },
        payload: { action: "do-work" },
      }, { agent_id: "external-sender" });

      expect(mockRecipient.agentInstance.handleIncomingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: "msg-123", to: "handling-recipient" }),
        expect.objectContaining({ agent_id: "external-sender" })
      );
    });

    it("should gracefully handle messages to unknown recipients", async () => {
      // Missing recipient won't throw because it's caught and logged as a warning
      await expect(subscribeHandler({
        id: "msg-456",
        to: "unknown-recipient",
        from: "external-sender",
        tenantContext: { tenantId: "org-1", organizationId: "org-1" },
        payload: { action: "fail" },
      }, { agent_id: "external-sender" })).resolves.not.toThrow();
    });

    it("should gracefully handle missing handleIncomingMessage on recipient agent instance", async () => {
      broker.registerAgent({
        ...mockRecipient,
        agentId: "no-handler-recipient",
        agentInstance: {} as any, // Missing handler
      });

      await expect(subscribeHandler({
        id: "msg-789",
        to: "no-handler-recipient",
        from: "external-sender",
        tenantContext: { tenantId: "org-1", organizationId: "org-1" },
        payload: { action: "fail" },
      }, { agent_id: "external-sender" })).resolves.not.toThrow();
    });
  });
});
