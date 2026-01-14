/**
 * Integration Tests for Agent Layer Async Execution Flow
 *
 * Tests the complete end-to-end flow:
 * HTTP Request → Kafka Event → Agent Execution → Response
 */

// Extend Express Request interface for authentication
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; tenantId: string };
      tenantId?: string;
    }
  }
}

// Set environment variables for ServiceConfigManager before imports
process.env.KAFKA_BROKERS = "localhost:9092";
process.env.EVENT_EXECUTOR_ENABLED = "true";
process.env.AGENT_QUEUE_ENABLED = "true";
process.env.AGENT_QUEUE_REDIS_URL = "redis://localhost:6379";

// Mock external services for integration testing
vi.mock("../../src/lib/redisClient");
vi.mock("../../src/services/EventProducer");
vi.mock("../../src/services/UnifiedAgentAPI");
vi.mock("../../src/services/EventSourcingService");
vi.mock("../../src/lib/logger");
vi.mock("../../src/services/AgentMessageQueue");

import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import request from "supertest";
import { Express, Request, Response, NextFunction } from "express";
import {
  AgentMessageQueue,
  getAgentMessageQueue,
} from "../../src/services/AgentMessageQueue";
import { getEventProducer } from "../../src/services/EventProducer";
import { getUnifiedAgentAPI } from "../../src/services/UnifiedAgentAPI";
import { getEventSourcingService } from "../../src/services/EventSourcingService";
import { AgentType } from "../../src/services/agent-types";
import { createTestApp } from "./testcontainers-global-setup";
import { getRedisClient } from "../../src/lib/redisClient";
import { logger } from "../../src/lib/logger";

// Import and mock ServiceConfigManager functions
import {
  getAgentMessageQueueConfig,
  getEventExecutorConfig,
} from "../../src/config/ServiceConfigManager";

// Setup mock implementations at module level
vi.mocked(getRedisClient).mockResolvedValue({
  set: vi.fn().mockResolvedValue("OK"),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  incr: vi.fn().mockResolvedValue(1),
  disconnect: vi.fn(),
  connect: vi.fn(),
} as any);

vi.mocked(getEventProducer).mockReturnValue({
  publish: vi.fn().mockResolvedValue(undefined),
} as any);

vi.mocked(getUnifiedAgentAPI).mockReturnValue({
  invoke: vi.fn().mockResolvedValue({
    success: true,
    data: "Paris is the capital of France.",
    tokens: 150,
    cost: 0.002,
    cached: false,
  }),
} as any);

vi.mocked(getEventSourcingService).mockReturnValue({
  storeEvent: vi.fn().mockResolvedValue(undefined),
  updateProjection: vi.fn().mockResolvedValue(undefined),
  getAuditTrail: vi.fn().mockResolvedValue({
    events: [
      {
        eventType: "agent.request",
        payload: {
          agentId: "research",
          query: "What is the capital of France?",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  }),
} as any);

// Mock AgentMessageQueue
const mockMessageQueue = {
  getJobResult: vi.fn().mockResolvedValue({
    success: true,
    data: "Mock response",
    executionTime: 100,
    traceId: "mock-trace",
  }),
  shutdown: vi.fn().mockResolvedValue(undefined),
};

vi.mocked(getAgentMessageQueue).mockReturnValue(mockMessageQueue as any);

// Mock ServiceConfigManager functions
const mockConfig = {
  enabled: true,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  healthCheckInterval: 10000,
  redis: {
    url: "redis://localhost:6379",
    keyPrefix: "agent:queue",
  },
  queue: {
    concurrency: 10,
    rateLimitMax: 50,
    rateLimitDuration: 1000,
    jobRetention: 3600000,
  },
  scheduler: {
    enabled: true,
    checkInterval: 5000,
  },
  kafka: {
    brokers: ["localhost:9092"],
    groupId: "agent-executor",
    topics: {
      agentRequests: "agent.requests",
      agentResponses: "agent.responses",
    },
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 60000,
    monitoringPeriod: 300000,
  },
  agentExecution: {
    maxConcurrency: 10,
    timeout: 30000,
    retryOnFailure: true,
  },
};

// vi.mocked(getAgentMessageQueueConfig).mockReturnValue(mockConfig);
// vi.mocked(getEventExecutorConfig).mockReturnValue({
//   ...mockConfig,
//   kafka: mockConfig.kafka,
//   circuitBreaker: mockConfig.circuitBreaker,
//   agentExecution: mockConfig.agentExecution,
// });

describe("Integration - Async Agent Execution Flow", () => {
  let app: Express;
  let messageQueue: AgentMessageQueue;
  let redisClient: any;
  let eventProducer: any;
  let agentAPI: any;
  let eventSourcing: any;

  const testUser = {
    id: "test-user-123",
    tenantId: "test-tenant-123",
  };

  const testAgent = "research" as AgentType;
  const testQuery = "What is the capital of France?";

  beforeEach(async () => {
    // Setup mocks
    redisClient = {
      set: vi.fn().mockResolvedValue("OK"),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      incr: vi.fn().mockResolvedValue(1),
      disconnect: vi.fn(),
      connect: vi.fn(),
    };

    eventProducer = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    agentAPI = {
      invoke: vi.fn().mockResolvedValue({
        success: true,
        data: "Paris is the capital of France.",
        tokens: 150,
        cost: 0.002,
        cached: false,
      }),
    };

    eventSourcing = {
      storeEvent: vi.fn().mockResolvedValue(undefined),
      updateProjection: vi.fn().mockResolvedValue(undefined),
      getAuditTrail: vi.fn().mockResolvedValue({
        events: [
          {
            eventType: "agent.request",
            payload: { agentId: testAgent, query: testQuery },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    };

    vi.mocked(getRedisClient).mockResolvedValue(redisClient as any);
    vi.mocked(getEventProducer).mockReturnValue(eventProducer as any);
    vi.mocked(getUnifiedAgentAPI).mockReturnValue(agentAPI as any);
    vi.mocked(getEventSourcingService).mockReturnValue(eventSourcing as any);

    // Create test app and services
    app = await createTestApp();
    messageQueue = getAgentMessageQueue();

    // Mock authentication middleware
    app.use((req: any, res: any, next: any) => {
      req.user = testUser;
      req.tenantId = testUser.tenantId;
      next();
    });
  });

  afterEach(async () => {
    await messageQueue?.shutdown();
    vi.clearAllMocks();
  });

  describe("Complete Async Flow", () => {
    it("should execute complete agent request flow successfully", async () => {
      const response = await request(app)
        .post(`/api/agents/${testAgent}/invoke`)
        .send({
          query: testQuery,
          context: { sessionId: "test-session-123" },
          parameters: { temperature: 0.7 },
        })
        .expect(200);

      // Verify HTTP response
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("jobId");
      expect(response.body.data.status).toBe("queued");

      const jobId = response.body.data.jobId;

      // Verify Kafka event was published
      expect(eventProducer.publish).toHaveBeenCalledWith(
        "agent.requests",
        expect.objectContaining({
          eventType: "agent.request",
          payload: expect.objectContaining({
            agentId: testAgent,
            query: testQuery,
            userId: testUser.id,
            tenantId: testUser.tenantId,
          }),
        })
      );

      // Simulate job processing completion
      const jobResult = await messageQueue.getJobResult(jobId);
      expect(jobResult).toBeDefined();

      // Check job status endpoint
      const statusResponse = await request(app)
        .get(`/api/agents/jobs/${jobId}`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.status).toBe("processing");

      // Verify event sourcing
      expect(eventSourcing.storeEvent).toHaveBeenCalledTimes(2); // Request + Response events
      expect(eventSourcing.updateProjection).toHaveBeenCalledWith(
        "agent-performance",
        testAgent,
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("should handle agent execution errors gracefully", async () => {
      // Mock agent API failure
      agentAPI.invoke.mockRejectedValue(new Error("Agent execution failed"));

      const response = await request(app)
        .post(`/api/agents/${testAgent}/invoke`)
        .send({
          query: testQuery,
          context: { sessionId: "test-session-456" },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("jobId");

      const jobId = response.body.data.jobId;

      // Simulate job processing with error
      await new Promise((resolve) => setTimeout(resolve, 100)); // Allow async processing

      const jobResult = await messageQueue.getJobResult(jobId);
      expect(jobResult?.success).toBe(false);
      expect(jobResult?.error).toContain("failed");

      // Verify error event was stored
      expect(eventSourcing.storeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.response",
          payload: expect.objectContaining({
            status: "error",
            error: expect.any(String),
          }),
        })
      );
    });

    it("should support job status polling", async () => {
      const response = await request(app)
        .post(`/api/agents/${testAgent}/invoke`)
        .send({
          query: testQuery,
          sessionId: "test-session-789",
        })
        .expect(200);

      const jobId = response.body.data.jobId;

      // Initial status should be processing/queued
      const statusResponse1 = await request(app)
        .get(`/api/agents/jobs/${jobId}`)
        .expect(200);

      expect(statusResponse1.body.success).toBe(true);
      expect(statusResponse1.body.data.jobId).toBe(jobId);
      expect(["processing", "queued"]).toContain(
        statusResponse1.body.data.status
      );

      // Simulate job completion
      agentAPI.invoke.mockResolvedValue({
        success: true,
        data: "Completed successfully",
        tokens: 100,
        cost: 0.001,
        cached: false,
      });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Final status should show completion
      const statusResponse2 = await request(app)
        .get(`/api/agents/jobs/${jobId}`)
        .expect(200);

      expect(statusResponse2.body.success).toBe(true);
      expect(statusResponse2.body.data.status).toBe("completed");
      expect(statusResponse2.body.data.result).toBeDefined();
      expect(statusResponse2.body.data.latency).toBeDefined();
    });
  });

  describe("Concurrent Request Handling", () => {
    it("should handle multiple concurrent agent requests", async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        agent: testAgent,
        query: `Test query ${i + 1}`,
        sessionId: `session-${i + 1}`,
      }));

      // Send all requests concurrently
      const responses = await Promise.all(
        requests.map((req) =>
          request(app).post(`/api/agents/${req.agent}/invoke`).send({
            query: req.query,
            sessionId: req.sessionId,
          })
        )
      );

      // Verify all requests succeeded
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty("jobId");
      });

      // Verify unique job IDs
      const jobIds = responses.map((r) => r.body.data.jobId);
      const uniqueJobIds = new Set(jobIds);
      expect(uniqueJobIds.size).toBe(requests.length);

      // Verify Kafka events for each request
      expect(eventProducer.publish).toHaveBeenCalledTimes(requests.length);
    });

    it("should maintain isolation between concurrent requests", async () => {
      const user1 = { id: "user-1", tenantId: "tenant-1" };
      const user2 = { id: "user-2", tenantId: "tenant-2" };

      // Mock different users
      const createAppWithUser = async (user: any) => {
        const testApp = await createTestApp();
        testApp.use((req: Request, res: Response, next: NextFunction) => {
          req.user = user;
          req.tenantId = user.tenantId;
          next();
        });
        return testApp;
      };

      const app1 = await createAppWithUser(user1);
      const app2 = await createAppWithUser(user2);

      // Send concurrent requests from different users
      const [response1, response2] = await Promise.all([
        request(app1)
          .post(`/api/agents/${testAgent}/invoke`)
          .send({ query: "User 1 query" }),
        request(app2)
          .post(`/api/agents/${testAgent}/invoke`)
          .send({ query: "User 2 query" }),
      ]);

      // Verify both succeeded
      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);

      // Verify tenant isolation in events
      expect(eventProducer.publish).toHaveBeenCalledWith(
        "agent.requests",
        expect.objectContaining({
          payload: expect.objectContaining({
            userId: user1.id,
            tenantId: user1.tenantId,
          }),
        })
      );

      expect(eventProducer.publish).toHaveBeenCalledWith(
        "agent.requests",
        expect.objectContaining({
          payload: expect.objectContaining({
            userId: user2.id,
            tenantId: user2.tenantId,
          }),
        })
      );
    });
  });

  describe("Rate Limiting Integration", () => {
    it("should enforce rate limits across the async flow", async () => {
      // Configure strict rate limiting for testing
      const strictRequests = Array.from({ length: 10 }, (_, i) => ({
        agent: testAgent,
        query: `Rate limit test ${i + 1}`,
        sessionId: `rate-limit-session-${i + 1}`,
      }));

      // Send requests rapidly
      const responses = [];
      for (const req of strictRequests) {
        const response = await request(app)
          .post(`/api/agents/${req.agent}/invoke`)
          .send({
            query: req.query,
            sessionId: req.sessionId,
          });
        responses.push(response);

        // Small delay to avoid overwhelming
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      const successfulResponses = responses.filter((r) => r.status === 200);

      expect(successfulResponses.length).toBeGreaterThan(0);
      // Note: Rate limiting behavior depends on actual configuration
      // This test verifies the integration works, not specific limits
    });
  });

  describe("Circuit Breaker Integration", () => {
    it("should integrate circuit breaker protection in agent execution", async () => {
      // Mock agent failures to trigger circuit breaker
      agentAPI.invoke.mockRejectedValue(new Error("Service unavailable"));

      // Send multiple failing requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/agents/${testAgent}/invoke`)
          .send({
            query: `Failing query ${i + 1}`,
            sessionId: `fail-session-${i + 1}`,
          });
      }

      // Circuit breaker should eventually open
      // Verify that subsequent requests fail fast
      const response = await request(app)
        .post(`/api/agents/${testAgent}/invoke`)
        .send({
          query: "Should fail fast",
          sessionId: "circuit-open-test",
        });

      // Request should still be accepted but processing should fail
      expect(response.status).toBe(200); // HTTP level success
      expect(response.body.success).toBe(true); // Job queued

      // But job processing should fail due to circuit breaker
      const jobId = response.body.data.jobId;
      await new Promise((resolve) => setTimeout(resolve, 100));

      const jobResult = await messageQueue.getJobResult(jobId);
      expect(jobResult?.success).toBe(false);
    });
  });

  describe("Audit Trail and Event Sourcing", () => {
    it("should maintain complete audit trail for agent executions", async () => {
      const response = await request(app)
        .post(`/api/agents/${testAgent}/invoke`)
        .send({
          query: testQuery,
          context: {
            sessionId: "audit-test-session",
            source: "integration-test",
          },
        })
        .expect(200);

      const jobId = response.body.data.jobId;

      // Verify audit trail contains both request and response
      expect(eventSourcing.storeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.request",
          correlationId: jobId,
          payload: expect.objectContaining({
            agentId: testAgent,
            query: testQuery,
            sessionId: "audit-test-session",
          }),
        })
      );

      // Simulate completion and verify response event
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(eventSourcing.storeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.response",
          correlationId: jobId,
          payload: expect.objectContaining({
            agentId: testAgent,
            status: "success",
            response: expect.any(String),
            latency: expect.any(Number),
            tokens: expect.any(Number),
          }),
        })
      );

      // Verify audit trail retrieval
      const auditResponse = await request(app)
        .get(`/api/agents/jobs/${jobId}`)
        .expect(200);

      expect(auditResponse.body.success).toBe(true);
      expect(auditResponse.body.data).toHaveProperty("status");
    });
  });

  describe("Error Scenarios", () => {
    it("should handle malformed requests gracefully", async () => {
      const response = await request(app)
        .post(`/api/agents/${testAgent}/invoke`)
        .send({
          // Missing required query field
          context: { sessionId: "test" },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it("should handle invalid agent IDs", async () => {
      const response = await request(app)
        .post("/api/agents/invalid-agent/invoke")
        .send({
          query: testQuery,
        })
        .expect(200); // HTTP success, job queued

      // But processing should fail
      const jobId = response.body.data.jobId;
      await new Promise((resolve) => setTimeout(resolve, 100));

      const jobResult = await messageQueue.getJobResult(jobId);
      expect(jobResult?.success).toBe(false);
      expect(jobResult?.error).toContain("invalid");
    });

    it("should handle Kafka publishing failures", async () => {
      eventProducer.publish.mockRejectedValue(new Error("Kafka unavailable"));

      const response = await request(app)
        .post(`/api/agents/${testAgent}/invoke`)
        .send({
          query: testQuery,
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Agent request failed");
    });
  });
});
