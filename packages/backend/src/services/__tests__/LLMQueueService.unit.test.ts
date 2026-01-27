import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock bullmq & ioredis to avoid external dependencies
vi.mock("bullmq", async () => {
  const actual = await vi.importActual<any>("bullmq");
  class FakeQueue {
    name: string;
    jobs: any[] = [];
    constructor(name: string) {
      this.name = name;
    }
    async add(jobName: string, data: any, __opts?: any) {
      const job = { id: `${this.jobs.length + 1}`, name: jobName, data };
      this.jobs.push(job);
      return job;
    }
    async getWaitingCount() {
      return 1;
    }
    async getActiveCount() {
      return 0;
    }
    async getCompletedCount() {
      return 0;
    }
    async getFailedCount() {
      return 0;
    }
    async getDelayedCount() {
      return 0;
    }
    async getJob(id: string) {
      return this.jobs.find((j) => j.id === id);
    }
  }
  return {
    ...(actual as any),
    Queue: FakeQueue,
    Worker: class {
      constructor() {}
      on() {}
      close() {}
    },
    QueueEvents: class {
      on() {}
      close() {}
    },
  };
});

vi.mock("ioredis", () => ({
  default: class {
    constructor() {}
  },
}));

import { LLMQueueService } from "../MessageQueue.js"

describe("LLMQueueService (unit)", () => {
  let queue: LLMQueueService;

  beforeEach(() => {
    queue = new LLMQueueService();
  });

  it("should add a job and return a job id", async () => {
    const job = await queue.addJob(
      { type: "custom_prompt", userId: "user-1", prompt: "Hello" } as any,
      { jobId: "job-1" },
    );
    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
  });

  it("should return job status as not_found when job does not exist", async () => {
    const status = await queue.getJobStatus("nonexistent");
    expect(status.status).toBe("not_found");
  });

  it("should expose metrics getters", async () => {
    const m = await queue.getMetrics();
    expect(typeof m.waiting).toBe("number");
    expect(typeof m.queueDepth).toBe("number");
  });
});
