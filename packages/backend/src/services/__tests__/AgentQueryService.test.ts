import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimeoutError } from "../../lib/resilience/errors";
import { AgentQueryService } from "../../services/AgentQueryService.js"

vi.mock("../../lib/supabase.js");

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
} as any;

describe("AgentQueryService: Timeout & Abort Handling", () => {
  let service: AgentQueryService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new AgentQueryService(mockSupabase);
    // Mock global fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("should abort request and throw TimeoutError after 30 seconds", async () => {
    // Setup a fetch that never resolves (simulating high latency)
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));

    const queryPromise = service.queryAgent("Test Prompt", { tenantId: "123" });

    // Fast-forward time to 30,001ms
    await vi.advanceTimersByTimeAsync(30001);

    await expect(queryPromise).rejects.toThrow(TimeoutError);
    await expect(queryPromise).rejects.toThrow(
      "The request timed out after 30 seconds."
    );
  });

  it("should pass the AbortSignal to the fetch request", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: "success" }),
    });

    await service.queryAgent("Test Prompt", {});

    const fetchCall = (global.fetch as any).mock.calls[0];
    const options = fetchCall[1];

    expect(options.signal).toBeDefined();
    expect(options.signal instanceof AbortSignal).toBe(true);
  });

  it("should clear timeout if request succeeds before 30s", async () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: "fast-response" }),
    });

    await service.queryAgent("Test Prompt", {});

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
