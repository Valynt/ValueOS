import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCounterInc = vi.fn();
const mockGaugeSet = vi.fn();
const mockHistogramObserve = vi.fn();

vi.mock("../lib/observability/index.js", () => ({
  createCounter: vi.fn(() => ({ inc: mockCounterInc, add: vi.fn() })),
  createObservableGauge: vi.fn(() => ({ set: mockGaugeSet })),
  createHistogram: vi.fn(() => ({ observe: mockHistogramObserve, record: vi.fn() })),
}));

// queueMetrics uses require() for the histogram — mock the module resolution
vi.mock("../lib/observability/index.js", () => ({
  createCounter: vi.fn(() => ({ inc: mockCounterInc, add: vi.fn() })),
  createObservableGauge: vi.fn(() => ({ set: mockGaugeSet })),
  createHistogram: vi.fn(() => ({ observe: mockHistogramObserve, record: vi.fn() })),
}));

import { attachQueueMetrics, getQueueHealth } from "./queueMetrics.js";

import type { Job, Queue, Worker } from "bullmq";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWorker(): Worker & { _listeners: Map<string, ((...args: unknown[]) => void)[]> } {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    _listeners: listeners,
    on(event: string, cb: (...args: unknown[]) => void) {
      const existing = listeners.get(event) ?? [];
      listeners.set(event, [...existing, cb]);
      return this;
    },
    emit(event: string, ...args: unknown[]) {
      (listeners.get(event) ?? []).forEach((cb) => cb(...args));
    },
  } as unknown as Worker & { _listeners: Map<string, ((...args: unknown[]) => void)[]> };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    attemptsMade: 1,
    processedOn: Date.now() - 500,
    finishedOn: Date.now(),
    data: { caseId: "case-1", orgId: "org-1" },
    ...overrides,
  } as unknown as Job;
}

function makeQueue(counts: Record<string, number> = {}): Queue {
  return {
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      ...counts,
    }),
  } as unknown as Queue;
}

// ─── attachQueueMetrics ───────────────────────────────────────────────────────

describe("attachQueueMetrics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("increments completed counter when job completes", () => {
    const worker = makeWorker();
    attachQueueMetrics(worker, "crm-sync");

    (worker as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit(
      "completed",
      makeJob(),
    );

    expect(mockCounterInc).toHaveBeenCalledWith({ queue: "crm-sync", status: "completed" });
  });

  it("records job duration histogram on completion", () => {
    const worker = makeWorker();
    attachQueueMetrics(worker, "crm-sync");

    const job = makeJob({ processedOn: Date.now() - 2000, finishedOn: Date.now() });
    (worker as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit("completed", job);

    expect(mockHistogramObserve).toHaveBeenCalledWith(
      { queue: "crm-sync" },
      expect.any(Number),
    );
    const duration = mockHistogramObserve.mock.calls[0][1] as number;
    expect(duration).toBeGreaterThan(0);
  });

  it("increments failed counter and records lastFailedAt on failure", () => {
    const worker = makeWorker();
    attachQueueMetrics(worker, "crm-sync");

    (worker as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit(
      "failed",
      makeJob(),
      new Error("timeout"),
    );

    expect(mockCounterInc).toHaveBeenCalledWith({ queue: "crm-sync", status: "failed" });
  });

  it("increments stalled counter on stall event", () => {
    const worker = makeWorker();
    attachQueueMetrics(worker, "crm-sync");

    (worker as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit(
      "stalled",
      "job-99",
    );

    expect(mockCounterInc).toHaveBeenCalledWith({ queue: "crm-sync" });
  });

  it("increments active counter on active event", () => {
    const worker = makeWorker();
    attachQueueMetrics(worker, "crm-sync");

    (worker as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit(
      "active",
      makeJob(),
    );

    expect(mockCounterInc).toHaveBeenCalledWith({ queue: "crm-sync", status: "active" });
  });
});

// ─── getQueueHealth ───────────────────────────────────────────────────────────

describe("getQueueHealth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns job counts from queue.getJobCounts", async () => {
    const queue = makeQueue({ waiting: 5, active: 2, delayed: 1, failed: 3, completed: 100 });

    const result = await getQueueHealth(queue, "crm-sync");

    expect(result.waiting).toBe(5);
    expect(result.active).toBe(2);
    expect(result.delayed).toBe(1);
    expect(result.failed).toBe(3);
    expect(result.completed).toBe(100);
    expect(result.queue).toBe("crm-sync");
  });

  it("emits consumer lag gauge as waiting + delayed", async () => {
    const queue = makeQueue({ waiting: 4, delayed: 3 });

    await getQueueHealth(queue, "crm-sync");

    expect(mockGaugeSet).toHaveBeenCalledWith(7);
  });

  it("returns zeros and does not throw when Redis is unavailable", async () => {
    const queue = {
      getJobCounts: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    } as unknown as Queue;

    const result = await getQueueHealth(queue, "crm-sync");

    expect(result.waiting).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.queue).toBe("crm-sync");
  });

  it("includes lastFailedAt after a failure event was recorded", async () => {
    // Simulate a prior failure being recorded via attachQueueMetrics
    const worker = makeWorker();
    attachQueueMetrics(worker, "crm-webhook");
    (worker as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit(
      "failed",
      makeJob(),
      new Error("oops"),
    );

    const queue = makeQueue();
    const result = await getQueueHealth(queue, "crm-webhook");

    expect(result.lastFailedAt).not.toBeNull();
  });
});
