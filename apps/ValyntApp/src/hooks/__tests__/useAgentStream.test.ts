/**
 * useAgentStream — unit tests
 *
 * Tests hook logic by mocking fetchEventSource directly.
 * The library's reconnect/retry behavior is tested by the library itself;
 * we verify that the hook correctly handles each event type.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";

import { useAgentStream } from "../useAgentStream";

// ---------------------------------------------------------------------------
// Mock fetchEventSource — capture the callbacks and call options so tests
// can invoke them and inspect what was passed to the library.
// ---------------------------------------------------------------------------

type FetchEventSourceCallbacks = {
  onopen?: (res: Response) => Promise<void>;
  onmessage?: (event: { id?: string; data: string; event?: string }) => void;
  onerror?: (err: unknown) => void;
};

type CapturedCall = FetchEventSourceCallbacks & {
  url: string;
  headers?: Record<string, string>;
  fetch?: unknown;
  signal?: AbortSignal;
};

// Use a shared mutable object so the vi.mock factory (which is hoisted) can
// reference it without hitting a temporal dead zone error.
const capture = {
  callbacks: {} as FetchEventSourceCallbacks,
  calls: [] as CapturedCall[],
};

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(
    async (
      url: string,
      opts: FetchEventSourceCallbacks & {
        signal?: AbortSignal;
        headers?: Record<string, string>;
        fetch?: unknown;
      },
    ) => {
      capture.callbacks = opts;
      capture.calls.push({ url, ...opts });
      // Simulate a successful open
      await opts.onopen?.(new Response(null, { status: 200 }));
    },
  ),
}));

// Mock the API client — include fetchRaw so useAgentStream can bind it as
// the fetch override for fetchEventSource (auth header injection).
vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({
      success: true,
      data: { data: { jobId: "test-job-123", status: "queued", mode: "kafka" } },
    }),
    fetchRaw: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
  },
}));

// ---------------------------------------------------------------------------
// Helper — emit an SSE event through the captured callbacks
// ---------------------------------------------------------------------------

function emitEvent(data: Record<string, unknown>, id?: string) {
  capture.callbacks.onmessage?.({ data: JSON.stringify(data), id });
}

beforeEach(() => {
  capture.callbacks = {} as FetchEventSourceCallbacks;
  capture.calls = [];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAgentStream", () => {
  describe("completed event", () => {
    it("calls onMessage and stops streaming when completed event received", async () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useAgentStream({
          context: { sessionId: "s1", agentId: "opportunity", messages: [], isStreaming: false },
          onMessage,
        }),
      );

      await act(async () => {
        await result.current.sendMessage("analyze this");
      });

      act(() => {
        emitEvent({ status: "completed", result: "Analysis complete." });
      });

      await waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));

      const msg = onMessage.mock.calls[0][0];
      expect(msg.role).toBe("assistant");
      expect(msg.content).toBe("Analysis complete.");
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe("processing heartbeats", () => {
    it("calls onProgress for processing events and does not append a message", async () => {
      const onProgress = vi.fn();
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useAgentStream({
          context: { sessionId: "s1", agentId: "opportunity", messages: [], isStreaming: false },
          onProgress,
          onMessage,
        }),
      );

      await act(async () => {
        await result.current.sendMessage("analyze");
      });

      act(() => {
        emitEvent({ status: "processing", agentId: "opportunity", subTask: "Analyzing SEC filings\u2026" });
        emitEvent({ status: "processing", agentId: "opportunity", subTask: "Calculating ROI\u2026" });
        emitEvent({ status: "processing", agentId: "opportunity", subTask: "Generating narrative\u2026" });
        emitEvent({ status: "completed", result: "Done." });
      });

      await waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onProgress.mock.calls[0][0]).toMatchObject({
        status: "processing",
        subTask: "Analyzing SEC filings\u2026",
      });

      const assistantMessages = result.current.messages.filter((m) => m.role === "assistant");
      expect(assistantMessages).toHaveLength(1);
    });

    it("updates onProgress with subTask and agentId fields", async () => {
      const onProgress = vi.fn();
      const { result } = renderHook(() =>
        useAgentStream({
          context: { sessionId: "s1", agentId: "opportunity", messages: [], isStreaming: false },
          onProgress,
        }),
      );

      await act(async () => {
        await result.current.sendMessage("analyze");
      });

      act(() => {
        emitEvent({ status: "processing", agentId: "financial-modeling", subTask: "Running DCF model\u2026" });
      });

      expect(onProgress).toHaveBeenCalledWith({
        status: "processing",
        agentId: "financial-modeling",
        subTask: "Running DCF model\u2026",
        queuedAt: undefined,
      });
    });
  });

  describe("error event", () => {
    it("calls onError and stops streaming on error event", async () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useAgentStream({
          context: { sessionId: "s1", agentId: "opportunity", messages: [], isStreaming: false },
          onError,
        }),
      );

      await act(async () => {
        await result.current.sendMessage("analyze");
      });

      act(() => {
        emitEvent({ status: "error", error: "LLM rate limit exceeded" });
      });

      await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
      expect(onError.mock.calls[0][0].message).toBe("LLM rate limit exceeded");
      expect(result.current.isStreaming).toBe(false);
    });

    it("uses fallback error message when error field is missing", async () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useAgentStream({
          context: { sessionId: "s1", agentId: "opportunity", messages: [], isStreaming: false },
          onError,
        }),
      );

      await act(async () => {
        await result.current.sendMessage("analyze");
      });

      act(() => {
        emitEvent({ status: "error" });
      });

      await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
      expect(onError.mock.calls[0][0].message).toBe("Agent execution failed");
    });
  });

  describe("direct-mode response", () => {
    it("handles direct-mode result without opening SSE stream", async () => {
      const { fetchEventSource } = await import("@microsoft/fetch-event-source");
      const mockFetch = fetchEventSource as Mock;
      mockFetch.mockClear();

      const { apiClient } = await import("@/api/client/unified-api-client");
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        success: true,
        data: { data: { jobId: undefined, result: "Direct answer.", mode: "direct" } },
      } as never);

      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useAgentStream({
          context: { sessionId: "s1", agentId: "opportunity", messages: [], isStreaming: false },
          onMessage,
        }),
      );

      await act(async () => {
        await result.current.sendMessage("quick question");
      });

      await waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));
      expect(onMessage.mock.calls[0][0].content).toBe("Direct answer.");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("closeStream", () => {
    it("aborts the stream and sets isStreaming to false", async () => {
      const { result } = renderHook(() =>
        useAgentStream({
          context: { sessionId: "s1", agentId: "opportunity", messages: [], isStreaming: false },
        }),
      );

      await act(async () => {
        await result.current.sendMessage("analyze");
      });

      expect(result.current.isStreaming).toBe(true);

      act(() => {
        result.current.closeStream();
      });

      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe("malformed SSE frames", () => {
    it("silently ignores non-JSON SSE data", async () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useAgentStream({
          context: { sessionId: "s1", agentId: "opportunity", messages: [], isStreaming: false },
          onError,
        }),
      );

      await act(async () => {
        await result.current.sendMessage("analyze");
      });

      act(() => {
        capture.callbacks.onmessage?.({ data: "not-json-at-all" });
      });

      expect(onError).not.toHaveBeenCalled();
      expect(result.current.isStreaming).toBe(true);
    });
  });

  describe("auth headers", () => {
    it("passes apiClient.fetchRaw as the fetch option so auth headers are applied", async () => {
      const { result } = renderHook(() =>
        useAgentStream({
          context: { sessionId: "s1", agentId: "opportunity", messages: [], isStreaming: false },
        }),
      );

      await act(async () => {
        await result.current.sendMessage("analyze");
      });

      expect(capture.calls).toHaveLength(1);
      // fetchRaw is passed as the fetch override — auth headers are applied
      // inside apiClient.fetchRaw on every connection and reconnect.
      expect(typeof capture.calls[0].fetch).toBe("function");
    });
  });

  describe("Last-Event-ID resumability", () => {
    it("includes Last-Event-ID header on the second openStream call after receiving an event with an id", async () => {
      const { result } = renderHook(() =>
        useAgentStream({
          context: { sessionId: "s1", agentId: "opportunity", messages: [], isStreaming: false },
        }),
      );

      // First stream open
      await act(async () => {
        await result.current.sendMessage("analyze");
      });

      // Receive an event with an id — this should be tracked
      act(() => {
        capture.callbacks.onmessage?.({ data: JSON.stringify({ status: "processing" }), id: "evt-42" });
      });

      // Close and reopen the stream (simulates a reconnect)
      act(() => {
        result.current.closeStream();
      });

      await act(async () => {
        result.current.openStream("test-job-123");
      });

      // Second call should include Last-Event-ID
      expect(capture.calls).toHaveLength(2);
      expect(capture.calls[1].headers?.["Last-Event-ID"]).toBe("evt-42");
    });
  });
});
