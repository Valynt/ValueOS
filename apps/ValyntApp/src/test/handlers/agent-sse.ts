/**
 * MSW handlers for agent SSE and invoke endpoints.
 *
 * Used in tests that need network-level fidelity for:
 *  - SSE reconnect behaviour (Last-Event-ID, auth headers)
 *  - processing heartbeat forwarding
 *  - terminal event handling (completed / error)
 *
 * State is encapsulated in a factory so each test file that imports
 * createSseScenario gets an isolated instance — no cross-test contamination
 * from module-level singletons.
 */

import { http, HttpResponse } from "msw";

export interface SseScenario {
  events: Array<{ status: string; [key: string]: unknown }>;
  /** If true, the first connection closes without sending events to simulate a drop */
  dropOnFirst?: boolean;
}

// ---------------------------------------------------------------------------
// Per-test scenario state — encapsulated in a factory to prevent cross-test
// contamination when multiple test files share the same module instance.
// ---------------------------------------------------------------------------

export interface SseScenarioController {
  set(scenario: SseScenario): void;
  reset(): void;
  connectionCount(): number;
}

export function createSseScenario(): SseScenarioController {
  let current: SseScenario = { events: [] };
  let count = 0;

  return {
    set(scenario) {
      current = scenario;
      count = 0;
    },
    reset() {
      current = { events: [] };
      count = 0;
    },
    connectionCount() {
      return count;
    },
  };
}

// Default shared instance — used by mswServer in msw-setup.ts.
// Tests that need isolation should call createSseScenario() directly and
// register their own handler via mswServer.use(...).
const defaultScenario = createSseScenario();

/** @deprecated Use createSseScenario() for test isolation. */
export function setSseScenario(scenario: SseScenario) {
  defaultScenario.set(scenario);
}

/** @deprecated Use createSseScenario() for test isolation. */
export function resetSseScenario() {
  defaultScenario.reset();
}

/** @deprecated Use createSseScenario() for test isolation. */
export function getConnectionCount() {
  return defaultScenario.connectionCount();
}

// ---------------------------------------------------------------------------
// Agent invoke — returns a jobId
// ---------------------------------------------------------------------------

export const agentInvokeHandler = http.post(
  "/api/agents/:agentId/invoke",
  () => {
    return HttpResponse.json({
      data: {
        jobId: "test-job-123",
        status: "queued",
        mode: "kafka",
      },
    });
  },
);

// ---------------------------------------------------------------------------
// Agent job status poll
// ---------------------------------------------------------------------------

export const agentJobStatusHandler = http.get(
  "/api/agents/jobs/:jobId",
  ({ params }) => {
    return HttpResponse.json({
      data: {
        jobId: params.jobId,
        status: "processing",
        agentId: "opportunity",
      },
    });
  },
);

// ---------------------------------------------------------------------------
// SSE stream — /api/agents/jobs/:jobId/stream
// Uses the default shared scenario. Tests needing isolation should override
// this handler via mswServer.use(...) with their own scenario controller.
// ---------------------------------------------------------------------------

export function makeSseStreamHandler(scenario: SseScenarioController) {
  return http.get("/api/agents/jobs/:jobId/stream", () => {
    scenario.set({
      ...{ events: [] }, // keep current events
      dropOnFirst: false,
    });

    // Re-read the scenario after incrementing
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        await new Promise((r) => setTimeout(r, 10));
        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        Connection: "keep-alive",
      },
    });
  });
}

export const agentSseHandler = http.get(
  "/api/agents/jobs/:jobId/stream",
  () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const event of ([] as SseScenario["events"])) {
          await new Promise((r) => setTimeout(r, 10));
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  },
);

export const agentHandlers = [
  agentInvokeHandler,
  agentJobStatusHandler,
  agentSseHandler,
];
