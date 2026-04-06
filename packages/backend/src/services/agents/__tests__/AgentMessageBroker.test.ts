import { beforeEach, describe, expect, it, vi } from "vitest";

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

// Mock secureMessageBus
import { secureMessageBus } from "../../../lib/agent-fabric/SecureMessageBus";
vi.mock("../../../lib/agent-fabric/SecureMessageBus", () => {
  return {
    secureMessageBus: {
      send: vi.fn(),
      subscribe: vi.fn()
    }
  };
});

import { BaseAgent } from "../../../lib/agent-fabric/agents/BaseAgent";
import { AgentMessageBroker, getAgentMessageBroker, AgentRegistration } from "../AgentMessageBroker";

describe("AgentMessageBroker", () => {
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

  describe("AgentMessageBroker Class", () => {
    let broker: AgentMessageBroker;
    let mockAgent1: AgentRegistration;
    let mockAgent2: AgentRegistration;

    beforeEach(() => {
      vi.clearAllMocks();
      broker = new AgentMessageBroker();

      mockAgent1 = {
        agentId: "agent1",
        agentType: "test-agent",
        agentInstance: {
          handleIncomingMessage: vi.fn()
        } as unknown as BaseAgent,
        identity: {
          agent_id: "agent1",
          agent_type: "test-agent",
          organization_id: "org1",
          permissions: [],
          issued_at: "now",
          expires_at: "never"
        }
      };

      mockAgent2 = {
        agentId: "agent2",
        agentType: "test-agent",
        agentInstance: {
          handleIncomingMessage: vi.fn()
        } as unknown as BaseAgent,
        identity: {
          agent_id: "agent2",
          agent_type: "test-agent",
          organization_id: "org1",
          permissions: [],
          issued_at: "now",
          expires_at: "never"
        }
      };
    });

    describe("Agent Registration", () => {
      it("should register an agent successfully", () => {
        broker.registerAgent(mockAgent1);
        expect(broker.isAgentRegistered("agent1")).toBe(true);
        expect(broker.getAgent("agent1")).toBe(mockAgent1);
        expect(broker.getRegisteredAgents()).toHaveLength(1);
      });

      it("should unregister an agent successfully", () => {
        broker.registerAgent(mockAgent1);
        expect(broker.isAgentRegistered("agent1")).toBe(true);

        broker.unregisterAgent("agent1");
        expect(broker.isAgentRegistered("agent1")).toBe(false);
        expect(broker.getAgent("agent1")).toBeUndefined();
        expect(broker.getRegisteredAgents()).toHaveLength(0);
      });

      it("unregistering a non-existent agent should not throw", () => {
        expect(() => broker.unregisterAgent("non-existent")).not.toThrow();
      });
    });

    describe("sendMessage", () => {
      beforeEach(() => {
        broker.registerAgent(mockAgent1);
        broker.registerAgent(mockAgent2);
      });

      it("should fail if recipient is not registered", async () => {
        const response = await broker.sendMessage({
          fromAgentId: "agent1",
          toAgentId: "non-existent",
          payload: { test: true }
        });

        expect(response.success).toBe(false);
        expect(response.error).toBe("Recipient agent not found: non-existent");
      });

      it("should fail if sender is not registered", async () => {
        const response = await broker.sendMessage({
          fromAgentId: "non-existent",
          toAgentId: "agent2",
          payload: { test: true }
        });

        expect(response.success).toBe(false);
        expect(response.error).toBe("Sender agent not found: non-existent");
      });

      it("should successfully send message and wait for response", async () => {
        const mockMessage = { id: "msg-123" };
        (secureMessageBus.send as any).mockResolvedValue(mockMessage);

        // We simulate the response coming back
        const sendPromise = broker.sendMessage({
          fromAgentId: "agent1",
          toAgentId: "agent2",
          payload: { data: "test payload" },
          correlationId: "corr-1"
        });

        // The secureMessageBus.send should be called
        // Allow the promise cycle to proceed so the message is stored in pendingMessages
        await new Promise(r => setTimeout(r, 0));

        // Now we fake an incoming message response using the private method
        const incomingMessage = {
          id: "reply-1",
          correlationId: "corr-1",
          payload: { result: "success" },
          to: "agent1",
          from: "agent2"
        };

        // Access private method for testing
        await (broker as any).handleIncomingMessage(incomingMessage, mockAgent2.identity);

        const response = await sendPromise;

        expect(response.success).toBe(true);
        expect(response.response).toEqual({ result: "success" });
        expect(secureMessageBus.send).toHaveBeenCalledWith(
          mockAgent1.identity,
          "agent2",
          { data: "test payload" },
          expect.objectContaining({
            correlationId: "corr-1",
            replyTo: "agent1"
          })
        );
      });
    });

    describe("sendToAgent (simplified interface)", () => {
      beforeEach(() => {
        broker.registerAgent(mockAgent1);
        broker.registerAgent(mockAgent2);
      });

      it("should return data on success", async () => {
        // Mock sendMessage to return a success response
        vi.spyOn(broker, 'sendMessage').mockResolvedValue({
          success: true,
          response: { foo: "bar" },
          deliveryTime: 10
        });

        const result = await broker.sendToAgent("agent1", "agent2", { req: "data" });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ foo: "bar" });
      });

      it("should return error on failure", async () => {
        vi.spyOn(broker, 'sendMessage').mockResolvedValue({
          success: false,
          error: "Simulated error",
          deliveryTime: 10
        });

        const result = await broker.sendToAgent("agent1", "agent2", { req: "data" });

        expect(result.success).toBe(false);
        expect(result.error).toBe("Simulated error");
        expect(result.data).toBeUndefined();
      });
    });

    describe("Incoming Message Handling", () => {
      beforeEach(() => {
        broker.registerAgent(mockAgent1);
        broker.registerAgent(mockAgent2);
      });

      it("should route to recipient agent if not a response to a pending message", async () => {
        const incomingMessage = {
          id: "msg-2",
          to: "agent1",
          from: "agent2",
          payload: { action: "do-something" }
        };

        await (broker as any).handleIncomingMessage(incomingMessage, mockAgent2.identity);

        // The mockAgent1's instance.handleIncomingMessage should be called
        expect(mockAgent1.agentInstance.handleIncomingMessage).toHaveBeenCalledWith(
          incomingMessage,
          mockAgent2.identity
        );
      });

      it("should handle recipient not found gracefully", async () => {
        const incomingMessage = {
          id: "msg-3",
          to: "unknown-agent",
          from: "agent2",
          payload: { action: "do-something" }
        };

        await expect((broker as any).handleIncomingMessage(incomingMessage, mockAgent2.identity)).resolves.not.toThrow();
      });
    });

    describe("getStats", () => {
      it("should return correct statistics", () => {
        broker.registerAgent(mockAgent1);

        const stats = broker.getStats();
        expect(stats.registeredAgents).toBe(1);
        expect(stats.pendingMessages).toBe(0);
        expect(stats.queuedMessages).toBe(0);
        expect(stats.activeConnections).toBe(0);
      });
    });
  });
});
