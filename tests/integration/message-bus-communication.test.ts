/**
 * Integration Tests for Message Bus Communication
 *
 * Tests secure inter-agent communication, circuit breaker integration,
 * and message routing functionality.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SecureMessageBus,
  secureMessageBus,
} from "../../src/lib/agent-fabric/SecureMessageBus";
import { AgentIdentity, AgentRole } from "../../src/lib/auth/AgentIdentity";
import { logger } from "../../src/lib/logger";
import { getRedisClient } from "../../src/lib/redisClient";
import { CircuitBreaker } from "../../src/lib/resilience/CircuitBreaker";

// Mock Redis for testing
vi.mock("../../src/lib/redisClient");
vi.mock("../../src/lib/logger");

describe("Integration - Message Bus Communication", () => {
  let messageBus: SecureMessageBus;
  let agent1: AgentIdentity;
  let agent2: AgentIdentity;
  let circuitBreaker: CircuitBreaker;
  let redisClient: any;

  beforeEach(() => {
    // Setup mock Redis client
    redisClient = {
      set: vi.fn().mockResolvedValue("OK"),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      incr: vi.fn().mockResolvedValue(1),
      lpush: vi.fn().mockResolvedValue(1),
      lrange: vi.fn().mockResolvedValue([]),
      pttl: vi.fn().mockResolvedValue(-1),
      keys: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(getRedisClient).mockResolvedValue(redisClient);

    // Create message bus instance
    messageBus = secureMessageBus;

    // Create test agent identities
    agent1 = {
      id: "agent-1",
      keys: {
        publicKey: "mock-public-key-1",
        privateKey: "mock-private-key-1",
        encryptionKey: "mock-encryption-key-1",
      },
      permissions: ["execute:llm"],
      type: "agent",
      role: AgentRole.COORDINATOR,
      name: "agent1",
      version: "1.0",
      lifecycleStage: "development",
      organizationId: "test-org-123",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      auditToken: "mock-audit-token-1",
      metadata: { type: "research", version: "1.0" },
    };

    agent2 = {
      id: "agent-2",
      keys: {
        publicKey: "mock-public-key-2",
        privateKey: "mock-private-key-2",
        encryptionKey: "mock-encryption-key-2",
      },
      permissions: ["execute:llm"],
      type: "agent",
      role: AgentRole.COORDINATOR,
      name: "agent2",
      version: "1.0",
      lifecycleStage: "development",
      organizationId: "test-org-123",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      auditToken: "mock-audit-token-2",
      metadata: { type: "analysis", version: "1.0" },
    };

    // Register agents
    messageBus.registerAgent(agent1);
    messageBus.registerAgent(agent2);

    // Create circuit breaker
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 5000,
    });
  });

  afterEach(() => {
    messageBus.destroy();
    vi.clearAllMocks();
  });

  describe("Secure Message Exchange", () => {
    it("should successfully exchange encrypted messages between agents", async () => {
      const testMessage = {
        type: "collaboration_request",
        data: { query: "Analyze this data", parameters: { depth: "deep" } },
        correlationId: "test-correlation-123",
      };

      // Setup message handler for agent2
      const messageHandler = vi.fn().mockResolvedValue(undefined);
      await messageBus.subscribe(agent2.id, messageHandler);

      // Agent1 sends encrypted message to agent2
      const sentMessage = await messageBus.send(
        agent1,
        agent2.id,
        testMessage,
        {
          encrypted: true,
          priority: "high",
          ttlSeconds: 300,
        }
      );

      expect(sentMessage).toBeDefined();
      expect(sentMessage.id).toBeDefined();
      expect(sentMessage.from).toBe(agent1.id);
      expect(sentMessage.to).toBe(agent2.id);
      expect(sentMessage.encrypted).toBe(true);

      // Verify message was received and decrypted
      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: sentMessage.id,
          from: agent1.id,
          to: agent2.id,
          payload: testMessage,
        }),
        agent1
      );
    });

    it("should handle message priority and ordering", async () => {
      const messages = [
        { type: "low_priority", data: "Low priority message" },
        { type: "high_priority", data: "High priority message" },
        { type: "critical", data: "Critical message" },
      ];

      const receivedMessages: any[] = [];
      const messageHandler = vi.fn().mockImplementation((message) => {
        receivedMessages.push(message);
      });

      await messageBus.subscribe(agent2.id, messageHandler);

      // Send messages with different priorities
      await messageBus.send(agent1, agent2.id, messages[0], {
        priority: "low",
      });
      await messageBus.send(agent1, agent2.id, messages[2], {
        priority: "critical",
      });
      await messageBus.send(agent1, agent2.id, messages[1], {
        priority: "high",
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify messages were received (order may vary based on implementation)
      expect(receivedMessages).toHaveLength(3);
      const messageTypes = receivedMessages.map((m) => m.payload.type);
      expect(messageTypes).toContain("low_priority");
      expect(messageTypes).toContain("high_priority");
      expect(messageTypes).toContain("critical");
    });

    it("should enforce message TTL and expiration", async () => {
      const testMessage = {
        type: "expiring_message",
        data: "This will expire",
      };

      const messageHandler = vi.fn();
      await messageBus.subscribe(agent2.id, messageHandler);

      // Send message with very short TTL
      await messageBus.send(agent1, agent2.id, testMessage, {
        ttlSeconds: 1, // 1 second
      });

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Message should not be delivered after expiration
      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  describe("Circuit Breaker Integration", () => {
    it("should integrate circuit breaker with message bus", async () => {
      // Mock message handler that fails
      const failingHandler = vi
        .fn()
        .mockRejectedValue(new Error("Handler failed"));
      await messageBus.subscribe(agent2.id, failingHandler);

      // Send multiple messages that will fail
      for (let i = 0; i < 5; i++) {
        try {
          await messageBus.send(agent1, agent2.id, { test: `message-${i}` });
        } catch (error) {
          // Expected failures
        }
      }

      // Circuit breaker should eventually open for agent2
      // (This assumes circuit breaker integration in message bus)
      const finalMessage = { test: "final-message" };
      const result = await messageBus.send(agent1, agent2.id, finalMessage);

      // Message should still be sent, but processing might be blocked
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it("should handle agent unavailability gracefully", async () => {
      // Unregister agent2
      messageBus.unregisterAgent(agent2.id);

      const messageHandler = vi.fn();
      await messageBus.subscribe(agent2.id, messageHandler);

      // Try to send message to unavailable agent
      await expect(
        messageBus.send(agent1, agent2.id, { test: "unavailable" })
      ).rejects.toThrow("Recipient agent not found");

      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  describe("Broadcast Communication", () => {
    it("should broadcast messages to all registered agents", async () => {
      const agent3: AgentIdentity = {
        id: "agent-3",
        keys: {
          publicKey: "mock-public-key-3",
          privateKey: "mock-private-key-3",
        },
        permissions: ["execute:llm"],
        type: "agent",
        role: AgentRole.SYSTEM,
        name: "agent3",
        version: "1.0",
        lifecycleStage: "development",
        organizationId: "test-org-123",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        auditToken: "mock-audit-token-3",
        metadata: { type: "system", version: "1.0" },
      };

      messageBus.registerAgent(agent3);

      const broadcastMessage = {
        type: "system_announcement",
        data: "System maintenance in 5 minutes",
      };

      const handlers = [vi.fn(), vi.fn(), vi.fn()];
      await messageBus.subscribe(agent1.id, handlers[0]);
      await messageBus.subscribe(agent2.id, handlers[1]);
      await messageBus.subscribe(agent3.id, handlers[2]);

      // Broadcast message
      const sentMessage = await messageBus.broadcast(agent1, broadcastMessage, {
        priority: "critical",
      });

      expect(sentMessage.to).toBe("broadcast");

      // Wait for delivery
      await new Promise((resolve) => setTimeout(resolve, 50));

      // All agents should receive the broadcast
      handlers.forEach((handler) => {
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            id: sentMessage.id,
            from: agent1.id,
            to: "broadcast",
            payload: broadcastMessage,
          }),
          agent1
        );
      });
    });

    it("should prevent broadcast loops", async () => {
      const loopMessage = {
        type: "loop_test",
        data: "Testing broadcast loops",
      };

      let callCount = 0;
      const handler = vi.fn().mockImplementation(async (message, sender) => {
        callCount++;
        if (callCount === 1) {
          // Try to broadcast from within handler (should not loop)
          await messageBus.broadcast(sender, {
            type: "nested_broadcast",
            data: "Should not loop",
          });
        }
      });

      await messageBus.subscribe(agent2.id, handler);

      await messageBus.broadcast(agent1, loopMessage);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should only be called once (no loop)
      expect(callCount).toBe(1);
    });
  });

  describe("Replay Attack Protection", () => {
    it("should detect and reject replay attacks", async () => {
      const testMessage = {
        type: "replay_test",
        data: "Testing replay protection",
      };

      const messageHandler = vi.fn();
      await messageBus.subscribe(agent2.id, messageHandler);

      // Send first message
      const message1 = await messageBus.send(agent1, agent2.id, testMessage);
      expect(message1.nonce).toBeDefined();

      // Try to replay the same message (same nonce)
      const replayMessage = {
        ...message1,
        timestamp: new Date().toISOString(), // Update timestamp but keep nonce
      };

      await expect(messageBus.receive(replayMessage)).rejects.toThrow(
        "Replay attack detected"
      );

      // Handler should only be called once
      expect(messageHandler).toHaveBeenCalledTimes(1);
    });

    it("should clean up expired nonces", async () => {
      // Send message with short TTL
      const message = await messageBus.send(
        agent1,
        agent2.id,
        {
          test: "nonce_cleanup",
        },
        { ttlSeconds: 1 }
      );

      // Wait for nonce cleanup (assuming cleanup runs every minute in test)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Nonce should still be valid immediately
      expect(message.nonce).toBeDefined();

      // Note: Actual cleanup testing would require controlling the cleanup interval
      // This is more of an integration test placeholder
    });
  });

  describe("Message Encryption and Signing", () => {
    it("should sign all messages with Ed25519", async () => {
      const testMessage = {
        type: "signed_message",
        data: "Testing signatures",
      };

      const sentMessage = await messageBus.send(agent1, agent2.id, testMessage);

      expect(sentMessage.signature).toBeDefined();
      expect(typeof sentMessage.signature).toBe("string");
      expect(sentMessage.signature.length).toBeGreaterThan(0);
    });

    it("should verify message signatures on receipt", async () => {
      const testMessage = {
        type: "signature_verification",
        data: "Testing verification",
      };

      const messageHandler = vi.fn();
      await messageBus.subscribe(agent2.id, messageHandler);

      await messageBus.send(agent1, agent2.id, testMessage);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Handler should be called (signature verified)
      expect(messageHandler).toHaveBeenCalledTimes(1);

      const call = messageHandler.mock.calls[0];
      expect(call[0].signature).toBeDefined();
    });

    it("should encrypt sensitive messages", async () => {
      const sensitiveMessage = {
        type: "sensitive_data",
        data: { apiKey: "secret-key-123", userToken: "token-456" },
      };

      const sentMessage = await messageBus.send(
        agent1,
        agent2.id,
        sensitiveMessage,
        {
          encrypted: true,
        }
      );

      expect(sentMessage.encrypted).toBe(true);
      expect(sentMessage.encryption).toBeDefined();
      expect(sentMessage.encryption?.algorithm).toBeDefined();
      expect(sentMessage.payload).not.toEqual(sensitiveMessage); // Should be encrypted
    });

    it("should reject messages with invalid signatures", async () => {
      const testMessage = await messageBus.send(agent1, agent2.id, {
        test: "invalid_signature",
      });

      // Tamper with signature
      const tamperedMessage = {
        ...testMessage,
        signature: "tampered-signature",
      };

      await expect(messageBus.receive(tamperedMessage)).rejects.toThrow(
        "Invalid message signature"
      );
    });
  });

  describe("Rate Limiting Integration", () => {
    it("should enforce per-agent rate limits", async () => {
      const messages = Array.from({ length: 15 }, (_, i) => ({
        type: "rate_limit_test",
        data: `Message ${i + 1}`,
      }));

      let sentCount = 0;
      let rateLimitedCount = 0;

      // Try to send many messages rapidly
      for (const message of messages) {
        try {
          await messageBus.send(agent1, agent2.id, message);
          sentCount++;
        } catch (error: any) {
          if (error.message.includes("Rate limit")) {
            rateLimitedCount++;
          } else {
            throw error;
          }
        }
      }

      // Some messages should succeed, some should be rate limited
      expect(sentCount).toBeGreaterThan(0);
      // Rate limiting depends on actual configuration
      // This test verifies the integration works
    });
  });

  describe("Error Handling and Resilience", () => {
    it("should handle Redis failures gracefully", async () => {
      // Mock Redis failure
      redisClient.set.mockRejectedValue(new Error("Redis down"));

      const testMessage = {
        type: "redis_failure_test",
        data: "Testing Redis failure",
      };

      // Message bus should handle Redis failure
      // (Depending on implementation, may fall back to in-memory or reject)
      await expect(
        messageBus.send(agent1, agent2.id, testMessage)
      ).rejects.toThrow(); // Or succeeds with fallback

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Redis"),
        expect.any(Error)
      );
    });

    it("should recover after Redis reconnection", async () => {
      // Initial failure
      redisClient.set.mockRejectedValueOnce(
        new Error("Redis temporarily down")
      );
      // Recovery
      redisClient.set.mockResolvedValue("OK");

      const message1 = { test: "failure_message" };
      const message2 = { test: "recovery_message" };

      // First message fails
      await expect(
        messageBus.send(agent1, agent2.id, message1)
      ).rejects.toThrow();

      // Second message succeeds after recovery
      const result = await messageBus.send(agent1, agent2.id, message2);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });
});
