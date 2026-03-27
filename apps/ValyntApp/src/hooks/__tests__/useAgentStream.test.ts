/**
 * useAgentStream — P0 streaming resilience tests
 *
 * Covers:
 * - Dropped connection triggers reconnect with exponential backoff
 * - Reconnect deduplicates messages by event ID
 * - Terminal state (error) is reached after MAX_RECONNECT_ATTEMPTS exhaustion
 * - isReconnecting transitions correctly during backoff
 * - Terminal SSE error (completed/error status) does not trigger reconnect
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentStream } from "../useAgentStream";

// Mirror the constant from the hook so the exhaustion test stays in sync.
const MAX_RECONNECT_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Manual EventSource mock
// ---------------------------------------------------------------------------

interface MockEventSourceInstance {
  url: string;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  close: ReturnType<typeof vi.fn>;
  /** Test helper: emit a message event */
  emit: (data: Record<string, unknown>, id?: string) => void;
  /** Test helper: trigger an error (connection drop) */
  drop: () => void;
}

let lastCreatedSource: MockEventSourceInstance | null = null;
const allCreatedSources: MockEventSourceInstance[] = [];

class MockEventSource implements MockEventSourceInstance {
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    lastCreatedSource = this;
    allCreatedSources.push(this);
  }

  emit(data: Record<string, unknown>, id?: string) {
    const event = new MessageEvent("message", {
      data: JSON.stringify(data),
      lastEventId: id ?? "",
    });
    this.onmessage?.(event);
  }

  drop() {
    this.onerror?.(new Event("error"));
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  lastCreatedSource = null;
  allCreatedSources.length = 0;
  // Replace the global EventSource with our mock
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// Mock the API client so sendMessage's POST doesn't hit the network
const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));
vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: { post: mockPost },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJobResponse(jobId = "job-abc") {
  return {
    success: true,
    data: { data: { jobId, status: "queued", mode: "kafka" } },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAgentStream — streaming resilience", () => {
  it("opens an SSE connection after sendMessage returns a jobId", async () => {
    mockPost.mockResolvedValueOnce(makeJobResponse("job-1"));

    const { result } = renderHook(() => useAgentStream());

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    expect(allCreatedSources).toHaveLength(1);
    expect(allCreatedSources[0].url).toContain("/api/agents/jobs/job-1/stream");
    expect(result.current.isStreaming).toBe(true);
  });

  it("transitions to completed and closes stream on completed event", async () => {
    mockPost.mockResolvedValueOnce(makeJobResponse("job-2"));

    const { result } = renderHook(() => useAgentStream());

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    act(() => {
      lastCreatedSource!.emit({ status: "completed", result: "Agent done." }, "evt-1");
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.messages).toHaveLength(2); // user + assistant
    expect(result.current.messages[1].content).toBe("Agent done.");
    expect(result.current.error).toBeNull();
  });

  it("schedules reconnect on connection drop (not terminal)", async () => {
    mockPost.mockResolvedValueOnce(makeJobResponse("job-3"));

    const { result } = renderHook(() => useAgentStream());

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    // Drop the connection before any terminal event
    act(() => {
      lastCreatedSource!.drop();
    });

    expect(result.current.isReconnecting).toBe(true);
    expect(result.current.reconnectAttempts).toBe(1);
    // No error yet — still within retry budget
    expect(result.current.error).toBeNull();

    // Advance past the first backoff delay (1 s)
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // A second EventSource should have been created for the reconnect
    expect(allCreatedSources).toHaveLength(2);
    expect(result.current.isReconnecting).toBe(false);
    expect(result.current.isStreaming).toBe(true);
  });

  it("includes lastEventId in reconnect URL after receiving events", async () => {
    mockPost.mockResolvedValueOnce(makeJobResponse("job-4"));

    const { result } = renderHook(() => useAgentStream());

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    // Receive a processing event with an ID
    act(() => {
      lastCreatedSource!.emit({ status: "processing" }, "cursor-42");
    });

    // Drop the connection
    act(() => {
      lastCreatedSource!.drop();
    });

    // Advance past backoff
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // Reconnect URL must include the last event ID
    const reconnectSource = allCreatedSources[1];
    expect(reconnectSource.url).toContain("lastEventId=cursor-42");
  });

  it("deduplicates messages on reconnect when server replays events", async () => {
    mockPost.mockResolvedValueOnce(makeJobResponse("job-5"));

    const { result } = renderHook(() => useAgentStream());

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    // Receive a processing event
    act(() => {
      lastCreatedSource!.emit({ status: "processing" }, "evt-1");
    });

    // Drop and reconnect
    act(() => {
      lastCreatedSource!.drop();
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // Server replays the same event ID on reconnect — should be ignored
    act(() => {
      lastCreatedSource!.emit({ status: "processing" }, "evt-1");
    });

    // Then sends the completion with a new ID
    act(() => {
      lastCreatedSource!.emit({ status: "completed", result: "Final answer." }, "evt-2");
    });

    // Only 2 messages: user + assistant (no duplicate processing messages)
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].content).toBe("Final answer.");
  });

  it("surfaces error with jobId after exhausting all reconnect attempts", async () => {
    mockPost.mockResolvedValueOnce(makeJobResponse("job-6"));

    const onError = vi.fn();
    const { result } = renderHook(() => useAgentStream({ onError }));

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    // Each drop schedules a reconnect timer; each timer fires and creates a new
    // EventSource. After MAX_RECONNECT_ATTEMPTS (5) drops, the next scheduleReconnect
    // call sees attempt >= 5 and surfaces the error instead of scheduling another timer.
    //
    // Sequence: drop → schedule(attempt N) → timer fires → openStream → drop → ...
    // The error fires on the (MAX+1)th drop, i.e. after 5 successful reconnects fail.
    for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i++) {
      act(() => {
        lastCreatedSource!.drop();
      });
      const delay = Math.min(1000 * 2 ** i, 30_000);
      await act(async () => {
        vi.advanceTimersByTime(delay + 100);
      });
    }

    // The 6th drop (after the 5th reconnect) should trigger the error
    act(() => {
      lastCreatedSource!.drop();
    });

    // After exhausting retries, the hook should be in error state
    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.message).toContain("job-6");
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isReconnecting).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("does not reconnect after a terminal error event from the server", async () => {
    mockPost.mockResolvedValueOnce(makeJobResponse("job-7"));

    const { result } = renderHook(() => useAgentStream());

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    // Server sends an error status — this is a terminal state
    act(() => {
      lastCreatedSource!.emit({ status: "error", error: "Worker crashed" }, "evt-err");
    });

    // The EventSource closing after a terminal event should not trigger reconnect
    act(() => {
      lastCreatedSource!.drop();
    });

    // No reconnect timer should fire
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Still only 1 EventSource created (no reconnect)
    expect(allCreatedSources).toHaveLength(1);
    expect(result.current.error!.message).toBe("Worker crashed");
    expect(result.current.isReconnecting).toBe(false);
  });

  it("isReconnecting is false after successful completion following a reconnect", async () => {
    mockPost.mockResolvedValueOnce(makeJobResponse("job-8"));

    const { result } = renderHook(() => useAgentStream());

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    // Drop and reconnect
    act(() => {
      lastCreatedSource!.drop();
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current.isReconnecting).toBe(false);

    // Complete on the reconnected stream
    act(() => {
      lastCreatedSource!.emit({ status: "completed", result: "Done." }, "evt-final");
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isReconnecting).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
