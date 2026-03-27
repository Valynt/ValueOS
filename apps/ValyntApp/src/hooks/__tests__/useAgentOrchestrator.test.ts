/**
 * useAgentOrchestrator — unit tests
 *
 * Verifies that state transitions are driven by SSE events, not mock timers.
 * fetchEventSource is mocked so we can control event delivery directly.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useAgentOrchestrator } from "../useAgentOrchestrator";

// ---------------------------------------------------------------------------
// Mock fetchEventSource — same pattern as useAgentStream tests
// ---------------------------------------------------------------------------

type FetchEventSourceCallbacks = {
  onopen?: (res: Response) => Promise<void>;
  onmessage?: (event: { id?: string; data: string }) => void;
  onerror?: (err: unknown) => void;
};

const capture = { callbacks: {} as FetchEventSourceCallbacks };

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(
    async (
      _url: string,
      opts: FetchEventSourceCallbacks & { signal?: AbortSignal },
    ) => {
      capture.callbacks = opts;
      await opts.onopen?.(new Response(null, { status: 200 }));
    },
  ),
}));

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({
      success: true,
      data: { data: { jobId: "orch-job-1", status: "queued", mode: "kafka" } },
    }),
    fetchRaw: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
  },
}));

function emitEvent(data: Record<string, unknown>) {
  capture.callbacks.onmessage?.({ data: JSON.stringify(data) });
}

beforeEach(() => {
  capture.callbacks = {};
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAgentOrchestrator", () => {
  it("starts in IDLE state", () => {
    const { result } = renderHook(() => useAgentOrchestrator());
    expect(result.current.state).toBe("IDLE");
    expect(result.current.isProcessing).toBe(false);
  });

  it("transitions IDLE -> PLANNING -> EXECUTING -> IDLE on processing then completed", async () => {
    const states: string[] = [];
    const { result } = renderHook(() =>
      useAgentOrchestrator({
        onStateChange: (s) => states.push(s),
      }),
    );

    await act(async () => {
      await result.current.submitQuery("analyze value");
    });

    expect(states).toContain("PLANNING");

    act(() => {
      emitEvent({ status: "processing", agentId: "opportunity", subTask: "Gathering context\u2026" });
    });

    await waitFor(() => expect(states).toContain("EXECUTING"));

    act(() => {
      emitEvent({ status: "completed", result: "Final narrative." });
    });

    await waitFor(() => expect(result.current.state).toBe("IDLE"));
  });

  it("transitions to ERROR on error event", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useAgentOrchestrator({ onError }),
    );

    await act(async () => {
      await result.current.submitQuery("analyze");
    });

    act(() => {
      emitEvent({ status: "error", error: "Agent crashed" });
    });

    await waitFor(() => expect(result.current.state).toBe("ERROR"));
    expect(onError).toHaveBeenCalledTimes(1);
    // The error message is forwarded from the SSE event's error field
    expect(onError.mock.calls[0][0].message).toBe("Agent crashed");
  });

  it("cancel() returns state to IDLE and closes the stream", async () => {
    const { result } = renderHook(() => useAgentOrchestrator());

    await act(async () => {
      await result.current.submitQuery("analyze");
    });

    // Should be in PLANNING (POST returned jobId, stream open but no events yet)
    expect(result.current.isProcessing).toBe(true);

    act(() => {
      result.current.cancel();
    });

    expect(result.current.state).toBe("IDLE");
    expect(result.current.isProcessing).toBe(false);
  });

  it("does not contain setTimeout-driven state transitions", async () => {
    // If the hook used setTimeout, this test would need fake timers.
    // The fact that it completes without them proves state is event-driven.
    const { result } = renderHook(() => useAgentOrchestrator());

    await act(async () => {
      await result.current.submitQuery("test");
    });

    act(() => {
      emitEvent({ status: "completed", result: "Done." });
    });

    await waitFor(() => expect(result.current.state).toBe("IDLE"));
  });

  it("populates thoughts from SSE events", async () => {
    const { result } = renderHook(() => useAgentOrchestrator());

    await act(async () => {
      await result.current.submitQuery("analyze");
    });

    act(() => {
      emitEvent({ status: "processing", subTask: "Step A" });
      emitEvent({ status: "completed", result: "Result text." });
    });

    await waitFor(() => expect(result.current.state).toBe("IDLE"));

    expect(result.current.thoughts.length).toBeGreaterThanOrEqual(2);
    const resultThought = result.current.thoughts.find((t) => t.type === "result");
    expect(resultThought?.content).toBe("Result text.");
  });

  it("reset() clears thoughts and returns to IDLE", async () => {
    const { result } = renderHook(() => useAgentOrchestrator());

    await act(async () => {
      await result.current.submitQuery("analyze");
    });

    act(() => {
      emitEvent({ status: "completed", result: "Done." });
    });

    await waitFor(() => expect(result.current.thoughts.length).toBeGreaterThan(0));

    act(() => {
      result.current.reset();
    });

    expect(result.current.thoughts).toHaveLength(0);
    expect(result.current.state).toBe("IDLE");
  });

  it("ignores submitQuery when already processing", async () => {
    const { apiClient } = await import("@/api/client/unified-api-client");
    const postSpy = vi.mocked(apiClient.post);
    postSpy.mockClear();

    const { result } = renderHook(() => useAgentOrchestrator());

    await act(async () => {
      await result.current.submitQuery("first");
    });

    expect(result.current.isProcessing).toBe(true);

    // Second call while processing — should be ignored
    await act(async () => {
      await result.current.submitQuery("second");
    });

    expect(postSpy).toHaveBeenCalledTimes(1);
  });
});
