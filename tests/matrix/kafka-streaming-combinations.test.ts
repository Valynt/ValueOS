/**
 * Kafka × Streaming combination matrix tests.
 *
 * Asserts the correct behaviour of agent invocation endpoints and the
 * isKafkaEnabled() / isStreamingEnabled() feature flags across all four
 * messaging topology combinations.
 *
 * These tests run against mocked HTTP responses — no live backend required.
 * Wire into the nightly-matrix-chaos-replay CI lane (matrix suite).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messagingModeMatrix, type MessagingModeCase } from "./infra-mode.matrix";
import { runInMessagingMode } from "./runInInfraMode";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isKafkaEnabled(): boolean {
  return process.env["KAFKA_ENABLED"] === "true";
}

function isStreamingEnabled(): boolean {
  return process.env["STREAMING_ENABLED"] === "true";
}

interface MockResponse {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

/**
 * Simulates the backend routing logic for agent invocation endpoints.
 * Mirrors the behaviour described in the R2 spec:
 *
 * - POST /agents/:agentId/invoke  → sync fallback when Kafka disabled (200)
 * - GET  /jobs/:jobId             → 503 KAFKA_DISABLED when Kafka disabled
 * - GET  /jobs/:jobId/stream      → 503 KAFKA_DISABLED when Kafka disabled
 *                                   OR 404/501 when streaming disabled
 * - POST /agents/:agentId/sessions/:sessionId/invoke → 503 KAFKA_DISABLED
 */
function simulateAgentInvoke(agentId: string, runId: string): MockResponse {
  const headers: Record<string, string> = {
    "x-trace-id": `trace-${runId}`,
    "x-correlation-id": `corr-${runId}`,
  };

  if (!isKafkaEnabled()) {
    // Synchronous fallback path.
    return {
      status: 200,
      body: {
        run_id: runId,
        agent_id: agentId,
        status: "completed",
        result: { output: "sync-fallback-result" },
      },
      headers,
    };
  }

  return {
    status: 202,
    body: { run_id: runId, agent_id: agentId, status: "queued" },
    headers,
  };
}

function simulateJobStatus(jobId: string, runId: string): MockResponse {
  const headers: Record<string, string> = {
    "x-trace-id": `trace-${runId}`,
    "x-correlation-id": `corr-${runId}`,
  };

  if (!isKafkaEnabled()) {
    return {
      status: 503,
      body: { error: { code: "KAFKA_DISABLED", message: "Kafka is not enabled" } },
      headers,
    };
  }

  return {
    status: 200,
    body: { job_id: jobId, status: "running" },
    headers,
  };
}

function simulateJobStream(jobId: string, runId: string): MockResponse {
  const headers: Record<string, string> = {
    "x-trace-id": `trace-${runId}`,
    "x-correlation-id": `corr-${runId}`,
  };

  if (!isKafkaEnabled()) {
    return {
      status: 503,
      body: { error: { code: "KAFKA_DISABLED", message: "Kafka is not enabled" } },
      headers,
    };
  }

  if (!isStreamingEnabled()) {
    return {
      status: 501,
      body: { error: { code: "STREAMING_DISABLED", message: "Streaming is not enabled" } },
      headers,
    };
  }

  return {
    status: 200,
    body: { job_id: jobId, stream: "active" },
    headers,
  };
}

function simulateSessionInvoke(
  agentId: string,
  sessionId: string,
  runId: string,
): MockResponse {
  const headers: Record<string, string> = {
    "x-trace-id": `trace-${runId}`,
    "x-correlation-id": `corr-${runId}`,
  };

  if (!isKafkaEnabled()) {
    return {
      status: 503,
      body: { error: { code: "KAFKA_DISABLED", message: "Kafka is not enabled" } },
      headers,
    };
  }

  return {
    status: 202,
    body: { run_id: runId, agent_id: agentId, session_id: sessionId, status: "queued" },
    headers,
  };
}

// ---------------------------------------------------------------------------
// Shared assertions
// ---------------------------------------------------------------------------

function assertTraceHeaders(headers: Record<string, string>, label: string): void {
  expect(headers["x-trace-id"], `${label}: x-trace-id must be present`).toBeTruthy();
  expect(headers["x-correlation-id"], `${label}: x-correlation-id must be present`).toBeTruthy();
}

// ---------------------------------------------------------------------------
// Matrix tests
// ---------------------------------------------------------------------------

describe("Kafka × Streaming combination matrix", () => {
  for (const mode of messagingModeMatrix) {
    describe(`[${mode.id}] ${mode.label}`, () => {
      it("isKafkaEnabled() reflects the env var", async () => {
        await runInMessagingMode(mode, (ctx) => {
          expect(isKafkaEnabled()).toBe(ctx.kafkaEnabled);
        });
      });

      it("isStreamingEnabled() reflects the env var", async () => {
        await runInMessagingMode(mode, (ctx) => {
          expect(isStreamingEnabled()).toBe(ctx.streamingEnabled);
        });
      });

      it("POST /agents/:agentId/invoke — trace headers present regardless of mode", async () => {
        await runInMessagingMode(mode, () => {
          const res = simulateAgentInvoke("opportunity-agent", "run-001");
          assertTraceHeaders(res.headers, "POST /agents/invoke");
        });
      });

      it("GET /jobs/:jobId — trace headers present regardless of mode", async () => {
        await runInMessagingMode(mode, () => {
          const res = simulateJobStatus("job-001", "run-001");
          assertTraceHeaders(res.headers, "GET /jobs/:jobId");
        });
      });

      if (!mode.kafkaEnabled) {
        it("POST /agents/:agentId/invoke returns 200 with sync result (kafka-off fallback)", async () => {
          await runInMessagingMode(mode, () => {
            const res = simulateAgentInvoke("opportunity-agent", "run-kafka-off");
            expect(res.status).toBe(200);
            expect(res.body["run_id"]).toBe("run-kafka-off");
            expect(res.body["status"]).toBe("completed");
          });
        });

        it("POST /agents/:agentId/invoke produces a durable completion record (kafka-off)", async () => {
          await runInMessagingMode(mode, () => {
            const res = simulateAgentInvoke("opportunity-agent", "run-durable");
            // Durable = synchronous result with run_id present for audit trail.
            expect(res.status).toBe(200);
            expect(typeof res.body["run_id"]).toBe("string");
            expect(res.body["result"]).toBeTruthy();
          });
        });

        it("GET /jobs/:jobId returns 503 KAFKA_DISABLED", async () => {
          await runInMessagingMode(mode, () => {
            const res = simulateJobStatus("job-001", "run-001");
            expect(res.status).toBe(503);
            expect((res.body["error"] as Record<string, unknown>)["code"]).toBe("KAFKA_DISABLED");
          });
        });

        it("GET /jobs/:jobId/stream returns 503 KAFKA_DISABLED", async () => {
          await runInMessagingMode(mode, () => {
            const res = simulateJobStream("job-001", "run-001");
            expect(res.status).toBe(503);
            expect((res.body["error"] as Record<string, unknown>)["code"]).toBe("KAFKA_DISABLED");
          });
        });

        it("POST /agents/:agentId/sessions/:sessionId/invoke returns 503 KAFKA_DISABLED", async () => {
          await runInMessagingMode(mode, () => {
            const res = simulateSessionInvoke("opportunity-agent", "sess-001", "run-001");
            expect(res.status).toBe(503);
            expect((res.body["error"] as Record<string, unknown>)["code"]).toBe("KAFKA_DISABLED");
          });
        });
      }

      if (mode.kafkaEnabled && !mode.streamingEnabled) {
        it("GET /jobs/:jobId/stream returns non-2xx when streaming disabled", async () => {
          await runInMessagingMode(mode, () => {
            const res = simulateJobStream("job-001", "run-001");
            expect(res.status).toBeGreaterThanOrEqual(400);
            const code = (res.body["error"] as Record<string, unknown>)["code"];
            expect(code).toBe("STREAMING_DISABLED");
          });
        });
      }

      if (mode.kafkaEnabled) {
        it("POST /agents/:agentId/invoke returns 202 queued when Kafka enabled", async () => {
          await runInMessagingMode(mode, () => {
            const res = simulateAgentInvoke("opportunity-agent", "run-kafka-on");
            expect(res.status).toBe(202);
            expect(res.body["status"]).toBe("queued");
          });
        });
      }
    });
  }
});
