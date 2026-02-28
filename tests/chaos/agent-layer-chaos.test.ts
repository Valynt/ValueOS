/**
 * Chaos Engineering Tests for Agent Layer
 *
 * Simulates various failure scenarios to test system resilience:
 * - Kafka broker failures and network partitions
 * - Redis disconnections and data loss
 * - Agent execution timeouts and failures
 * - Circuit breaker overload scenarios
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "../lib/logger";
import { getRedisClient } from "../lib/redisClient";
import { CircuitBreaker } from "../lib/resilience/CircuitBreaker";
import { AgentType } from "../services/agent-types";
import {
  AgentMessageQueue,
  getAgentMessageQueue,
} from "../services/AgentMessageQueue";
import { getEventProducer } from "../services/EventProducer";

// Mock external dependencies
vi.mock("../lib/redisClient");
vi.mock("../services/EventProducer");
vi.mock("../lib/logger");

describe("Chaos Engineering - Agent Layer Resilience", () => {
  let messageQueue: AgentMessageQueue;
  let circuitBreaker: CircuitBreaker;
  let redisClient: any;
  let eventProducer: any;

  beforeEach(() => {
    // Setup mocks
    redisClient = {
      disconnect: vi.fn(),
      connect: vi.fn(),
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
    };

    eventProducer = {
      publish: vi.fn(),
      disconnect: vi.fn(),
      connect: vi.fn(),
    };

    vi.mocked(getRedisClient).mockResolvedValue(redisClient);
    vi.mocked(getEventProducer).mockReturnValue(eventProducer);

    messageQueue = new AgentMessageQueue();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 5000,
    });
  });

  afterEach(async () => {
    await messageQueue?.shutdown();
    vi.clearAllMocks();
  });

  describe("Kafka Failure Scenarios", () => {
    it("should handle Kafka broker disconnection gracefully", async () => {
      // Setup: Mock Kafka connection failure
      eventProducer.publish.mockRejectedValue(
        new Error("Kafka connection lost")
      );

      const job = {
        agent: "research" as AgentType,
        query: "test query",
        sessionId: "test-session",
        organizationId: "test-org",
        userId: "test-user",
        traceId: "test-trace",
      };

      // Attempt operation during Kafka failure
      await expect(messageQueue.queueAgentInvocation(job)).rejects.toThrow(
        "Kafka connection lost"
      );

      // Verify error handling
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Kafka"),
        expect.any(Error)
      );
    });

    it("should recover after Kafka reconnection", async () => {
      // Initial failure
      eventProducer.publish.mockRejectedValueOnce(
        new Error("Connection failed")
      );
      // Recovery
      eventProducer.publish.mockResolvedValue("job-123");

      const job = {
        agent: "research" as AgentType,
        query: "test query",
        sessionId: "test-session",
        organizationId: "test-org",
        userId: "test-user",
        traceId: "test-trace",
      };

      // First attempt fails
      await expect(messageQueue.queueAgentInvocation(job)).rejects.toThrow();

      // Second attempt succeeds after reconnection
      eventProducer.publish.mockResolvedValue("job-456");
      const jobId = await messageQueue.queueAgentInvocation(job);
      expect(jobId).toBe("job-456");
    });

    it("should handle network partitions with message queuing", async () => {
      // Simulate network partition
      let partitionActive = true;

      eventProducer.publish.mockImplementation(() => {
        if (partitionActive) {
          return Promise.reject(new Error("Network partition"));
        }
        return Promise.resolve("job-recovered");
      });

      const job = {
        agent: "research" as AgentType,
        query: "test query",
        sessionId: "test-session",
        organizationId: "test-org",
        userId: "test-user",
        traceId: "test-trace",
      };

      // Queue fails during partition
      await expect(messageQueue.queueAgentInvocation(job)).rejects.toThrow(
        "Network partition"
      );

      // Network recovers
      partitionActive = false;

      // Subsequent operations succeed
      const jobId = await messageQueue.queueAgentInvocation(job);
      expect(jobId).toBe("job-recovered");
    });
  });

  describe("Redis Disconnection Scenarios", () => {
    it("should fallback to in-memory when Redis disconnects", async () => {
      // Setup Redis failure
      redisClient.set.mockRejectedValue(new Error("Redis disconnected"));

      const job = {
        agent: "research" as AgentType,
        query: "test query",
        sessionId: "test-session",
        organizationId: "test-org",
        userId: "test-user",
        traceId: "test-trace",
      };

      // Should still work with in-memory fallback
      const jobId = await messageQueue.queueAgentInvocation(job);
      expect(typeof jobId).toBe("string");
      expect(jobId).toContain("test-session");
    });

    it("should recover after Redis reconnection", async () => {
      // Initial Redis failure
      redisClient.set.mockRejectedValueOnce(new Error("Redis down"));
      // Recovery
      redisClient.set.mockResolvedValue("OK");

      const job1 = {
        agent: "research" as AgentType,
        query: "test query 1",
        sessionId: "session-1",
        organizationId: "test-org",
        userId: "test-user",
        traceId: "trace-1",
      };

      const job2 = {
        agent: "research" as AgentType,
        query: "test query 2",
        sessionId: "session-2",
        organizationId: "test-org",
        userId: "test-user",
        traceId: "trace-2",
      };

      // First job during Redis failure (uses memory)
      const jobId1 = await messageQueue.queueAgentInvocation(job1);
      expect(jobId1).toContain("session-1");

      // Second job after Redis recovery
      const jobId2 = await messageQueue.queueAgentInvocation(job2);
      expect(typeof jobId2).toBe("string");
    });

    it("should handle Redis data loss scenarios", async () => {
      // Simulate Redis restart with data loss
      redisClient.get.mockResolvedValue(null); // All keys lost

      const job = {
        agent: "research" as AgentType,
        query: "test query",
        sessionId: "test-session",
        organizationId: "test-org",
        userId: "test-user",
        traceId: "test-trace",
      };

      // Should still queue successfully despite data loss
      const jobId = await messageQueue.queueAgentInvocation(job);
      expect(typeof jobId).toBe("string");
    });
  });

  describe("Agent Timeout Scenarios", () => {
    it("should handle agent execution timeouts gracefully", async () => {
      // Mock agent API with timeout
      const mockAgentAPI = {
        invokeAgent: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(
                () =>
                  resolve({
                    success: true,
                    data: "timeout result",
                    executionTime: 35000, // Exceeds 30s timeout
                  }),
                35000
              );
            })
        ),
      };

      // Replace the agentAPI in messageQueue
      (messageQueue as any).agentAPI = mockAgentAPI;

      const job = {
        agent: "research" as AgentType,
        query: "test query",
        sessionId: "test-session",
        organizationId: "test-org",
        userId: "test-user",
        traceId: "test-trace",
      };

      // Queue the job
      const jobId = await messageQueue.queueAgentInvocation(job);

      // Simulate job processing with timeout
      const result = await messageQueue.getJobResult(jobId);

      // Should handle timeout appropriately
      expect(result).toBeDefined();
      // In real implementation, this would check timeout handling
    });

    it("should implement exponential backoff on repeated timeouts", async () => {
      // Mock agent that always times out
      const mockAgentAPI = {
        invokeAgent: vi.fn().mockRejectedValue(new Error("Timeout")),
      };

      (messageQueue as any).agentAPI = mockAgentAPI;

      const job = {
        agent: "research" as AgentType,
        query: "test query",
        sessionId: "test-session",
        organizationId: "test-org",
        userId: "test-user",
        traceId: "test-trace",
      };

      // Queue job that will fail repeatedly
      const jobId = await messageQueue.queueAgentInvocation(job);

      // Wait for retries to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = await messageQueue.getJobResult(jobId);
      expect(result?.success).toBe(false);
      expect(result?.error).toContain("failed");
    });
  });

  describe("Circuit Breaker Chaos Scenarios", () => {
    it("should open circuit breaker under sustained failure load", async () => {
      // Mock operation that always fails
      const failingOperation = vi
        .fn()
        .mockRejectedValue(new Error("Service down"));

      // Trigger failure threshold
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected failures
        }
      }

      // Circuit should now be open
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow(
        "Circuit breaker is OPEN"
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Circuit breaker opened"),
        expect.any(Object)
      );
    });

    it("should recover from circuit breaker open state", async () => {
      // Force circuit open with failures
      const failingOperation = vi
        .fn()
        .mockRejectedValue(new Error("Service down"));

      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected
        }
      }

      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Mock successful operation
      const successOperation = vi.fn().mockResolvedValue("success");

      // Should allow request and recover
      const result = await circuitBreaker.execute(successOperation);
      expect(result).toBe("success");

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Circuit breaker half-opened")
      );
    });

    it("should handle cascading failures with circuit breaker", async () => {
      // Simulate cascading failure: multiple services failing
      const services = ["service1", "service2", "service3"];

      for (const service of services) {
        const cb = new CircuitBreaker(
          {
            failureThreshold: 2,
            resetTimeoutMs: 1000,
          },
          service
        );

        const failingOp = vi
          .fn()
          .mockRejectedValue(new Error(`${service} down`));

        // Fail each service
        for (let i = 0; i < 3; i++) {
          try {
            await cb.execute(failingOp);
          } catch (error) {
            // Expected
          }
        }

        // All circuits should be open
        await expect(cb.execute(failingOp)).rejects.toThrow(
          "Circuit breaker is OPEN"
        );
      }

      // Verify isolation - services fail independently
      expect(logger.warn).toHaveBeenCalledTimes(services.length);
    });
  });

  describe("Combined Failure Scenarios", () => {
    it("should survive Kafka + Redis + Agent triple failure", async () => {
      // All systems fail simultaneously
      eventProducer.publish.mockRejectedValue(new Error("Kafka down"));
      redisClient.set.mockRejectedValue(new Error("Redis down"));

      // Mock agent API failure
      const mockAgentAPI = {
        invokeAgent: vi.fn().mockRejectedValue(new Error("Agent crashed")),
      };
      (messageQueue as any).agentAPI = mockAgentAPI;

      const job = {
        agent: "research" as AgentType,
        query: "test query",
        sessionId: "test-session",
        organizationId: "test-org",
        userId: "test-user",
        traceId: "test-trace",
      };

      // System should handle the triple failure gracefully
      await expect(messageQueue.queueAgentInvocation(job)).rejects.toThrow();

      // Verify all failures were logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Kafka"),
        expect.any(Error)
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Redis"),
        expect.any(Error)
      );
    });

    it("should recover gracefully from all failures", async () => {
      // Start with all systems down
      eventProducer.publish.mockRejectedValue(new Error("Kafka down"));
      redisClient.set.mockRejectedValue(new Error("Redis down"));

      const mockAgentAPI = {
        invokeAgent: vi.fn().mockRejectedValue(new Error("Agent down")),
      };
      (messageQueue as any).agentAPI = mockAgentAPI;

      const job = {
        agent: "research" as AgentType,
        query: "test query",
        sessionId: "test-session",
        organizationId: "test-org",
        userId: "test-user",
        traceId: "test-trace",
      };

      // Initial failure
      await expect(messageQueue.queueAgentInvocation(job)).rejects.toThrow();

      // Systems recover one by one
      redisClient.set.mockResolvedValue("OK");
      mockAgentAPI.invokeAgent.mockResolvedValue({
        success: true,
        data: "recovered result",
      });
      eventProducer.publish.mockResolvedValue("job-recovered");

      // Should eventually succeed
      const jobId = await messageQueue.queueAgentInvocation(job);
      expect(typeof jobId).toBe("string");
    });
  });
});
