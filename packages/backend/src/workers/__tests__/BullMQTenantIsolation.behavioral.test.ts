/**
 * BullMQ queue tenant-isolation behavioral tests.
 *
 * Proves that:
 * 1. BullMQ jobs preserve tenant context (organizationId) in job data
 * 2. Cross-tenant job visibility fails — tenant A cannot see tenant B's jobs
 * 3. Job processing runs with the correct tenant context
 * 4. Queue operations (add, getJobs) are scoped by tenant
 * 5. Failed jobs in DLQ retain tenant identity for audit
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Minimal BullMQ-like in-memory queue for behavioral testing
// ---------------------------------------------------------------------------

interface BullMQJobData {
  organizationId: string;
  tenantId: string;
  traceId: string;
  [key: string]: unknown;
}

interface BullMQJob {
  id: string;
  name: string;
  data: BullMQJobData;
  attemptsMade: number;
  failedReason?: string;
  finishedOn?: number;
  processedOn?: number;
  timestamp: number;
}

class InMemoryBullMQQueue {
  private jobs = new Map<string, BullMQJob>();
  private jobCounter = 0;

  async add(name: string, data: BullMQJobData): Promise<BullMQJob> {
    this.jobCounter += 1;
    const job: BullMQJob = {
      id: `job-${this.jobCounter}`,
      name,
      data,
      attemptsMade: 0,
      timestamp: Date.now(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async getJob(id: string): Promise<BullMQJob | undefined> {
    return this.jobs.get(id);
  }

  async getJobs(_types?: string[]): Promise<BullMQJob[]> {
    return [...this.jobs.values()];
  }

  async getJobsByTenant(organizationId: string): Promise<BullMQJob[]> {
    return [...this.jobs.values()].filter(
      (j) => j.data.organizationId === organizationId
    );
  }

  async removeJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  // Simulate job processing with tenant context
  async processJob(
    id: string,
    processor: (job: BullMQJob) => Promise<unknown>
  ): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Job ${id} not found`);

    job.processedOn = Date.now();
    job.attemptsMade += 1;

    try {
      await processor(job);
      job.finishedOn = Date.now();
    } catch (err) {
      job.failedReason = (err as Error).message;
      throw err;
    }
  }

  clear(): void {
    this.jobs.clear();
    this.jobCounter = 0;
  }
}

// ---------------------------------------------------------------------------
// Tenant context storage (simulates AsyncLocalStorage pattern used in backend)
// ---------------------------------------------------------------------------

interface TenantContext {
  organizationId: string;
  tenantId: string;
  userId: string;
}

class TenantContextStorage {
  private store = new Map<string, TenantContext>();

  async run<T>(context: TenantContext, fn: () => Promise<T>): Promise<T> {
    const key = this.currentKey();
    this.store.set(key, context);
    try {
      return await fn();
    } finally {
      this.store.delete(key);
    }
  }

  get(): TenantContext | undefined {
    return this.store.get(this.currentKey());
  }

  private currentKey(): string {
    // In real implementation this uses AsyncLocalStorage
    return "default";
  }
}

const tenantContextStorage = new TenantContextStorage();

// ---------------------------------------------------------------------------
// Queue service that enforces tenant context
// ---------------------------------------------------------------------------

class TenantScopedQueueService {
  constructor(
    private readonly queue: InMemoryBullMQQueue,
    private readonly contextStorage: TenantContextStorage
  ) {}

  async addJob(name: string, payload: Omit<BullMQJobData, "organizationId" | "tenantId" | "traceId">): Promise<BullMQJob> {
    const ctx = this.contextStorage.get();
    if (!ctx) {
      throw new Error("Cannot add job without tenant context. Ensure tenantContextMiddleware runs first.");
    }

    return this.queue.add(name, {
      ...payload,
      organizationId: ctx.organizationId,
      tenantId: ctx.tenantId,
      traceId: `trace-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    });
  }

  async getTenantJobs(): Promise<BullMQJob[]> {
    const ctx = this.contextStorage.get();
    if (!ctx) {
      throw new Error("Cannot get jobs without tenant context.");
    }
    return this.queue.getJobsByTenant(ctx.organizationId);
  }

  async getJobById(jobId: string): Promise<BullMQJob | undefined> {
    const ctx = this.contextStorage.get();
    if (!ctx) {
      throw new Error("Cannot get job without tenant context.");
    }

    const job = await this.queue.getJob(jobId);
    if (!job) return undefined;

    // Tenant isolation: reject if job belongs to different tenant
    if (job.data.organizationId !== ctx.organizationId) {
      return undefined; // Return undefined, not 403 — caller cannot distinguish
    }

    return job;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BullMQ queue tenant-isolation behavioral tests", () => {
  let queue: InMemoryBullMQQueue;
  let service: TenantScopedQueueService;

  const tenantA: TenantContext = {
    organizationId: "org-tenant-a",
    tenantId: "tenant-a",
    userId: "user-a",
  };

  const tenantB: TenantContext = {
    organizationId: "org-tenant-b",
    tenantId: "tenant-b",
    userId: "user-b",
  };

  beforeEach(() => {
    queue = new InMemoryBullMQQueue();
    service = new TenantScopedQueueService(queue, tenantContextStorage);
  });

  afterEach(() => {
    queue.clear();
    vi.restoreAllMocks();
  });

  // ── 1. Jobs preserve tenant context ──────────────────────────────────────

  describe("jobs preserve tenant context", () => {
    it("includes organizationId from tenant context in job data", async () => {
      await tenantContextStorage.run(tenantA, async () => {
        const job = await service.addJob("workflow-run", { workflowId: "wf-1" });
        expect(job.data.organizationId).toBe(tenantA.organizationId);
        expect(job.data.tenantId).toBe(tenantA.tenantId);
      });
    });

    it("includes a unique traceId for each job", async () => {
      await tenantContextStorage.run(tenantA, async () => {
        const job1 = await service.addJob("workflow-run", { workflowId: "wf-1" });
        const job2 = await service.addJob("workflow-run", { workflowId: "wf-1" });
        expect(job1.data.traceId).toBeTruthy();
        expect(job2.data.traceId).toBeTruthy();
        expect(job1.data.traceId).not.toBe(job2.data.traceId);
      });
    });
  });

  // ── 2. Cross-tenant job visibility fails ─────────────────────────────────

  describe("cross-tenant job visibility fails", () => {
    it("tenant A cannot see tenant B's jobs", async () => {
      // Create a job for tenant B
      await tenantContextStorage.run(tenantB, async () => {
        await service.addJob("workflow-run", { workflowId: "wf-2" });
      });

      // Tenant A tries to get jobs — should see none
      await tenantContextStorage.run(tenantA, async () => {
        const jobs = await service.getTenantJobs();
        expect(jobs).toHaveLength(0);
      });
    });

    it("tenant A cannot get tenant B's job by ID", async () => {
      // Create a job for tenant B and capture its ID
      let bJobId: string | undefined;
      await tenantContextStorage.run(tenantB, async () => {
        const job = await service.addJob("workflow-run", { workflowId: "wf-3" });
        bJobId = job.id;
      });

      // Tenant A tries to get the job by ID — should return undefined
      await tenantContextStorage.run(tenantA, async () => {
        const job = await service.getJobById(bJobId!);
        expect(job).toBeUndefined();
      });
    });

    it("tenant B cannot see tenant A's jobs", async () => {
      await tenantContextStorage.run(tenantA, async () => {
        await service.addJob("workflow-run", { workflowId: "wf-4" });
      });

      await tenantContextStorage.run(tenantB, async () => {
        const jobs = await service.getTenantJobs();
        expect(jobs).toHaveLength(0);
      });
    });
  });

  // ── 3. Job processing runs with correct tenant context ───────────────────

  describe("job processing runs with correct tenant context", () => {
    it("processor receives job with correct organizationId", async () => {
      let processedOrgId: string | undefined;

      await tenantContextStorage.run(tenantA, async () => {
        const job = await service.addJob("workflow-run", { workflowId: "wf-5" });
        await queue.processJob(job.id, async (j) => {
          processedOrgId = j.data.organizationId;
        });
      });

      expect(processedOrgId).toBe(tenantA.organizationId);
    });

    it("failed job retains tenant identity for audit", async () => {
      let failedJob: BullMQJob | undefined;

      await tenantContextStorage.run(tenantB, async () => {
        const job = await service.addJob("workflow-run", { workflowId: "wf-6" });
        try {
          await queue.processJob(job.id, async () => {
            throw new Error("Simulated failure");
          });
        } catch {
          // Expected
        }
        failedJob = await queue.getJob(job.id);
      });

      expect(failedJob).toBeDefined();
      expect(failedJob?.data.organizationId).toBe(tenantB.organizationId);
      expect(failedJob?.failedReason).toBe("Simulated failure");
    });
  });

  // ── 4. Queue operations require tenant context ───────────────────────────

  describe("queue operations require tenant context", () => {
    it("addJob throws without tenant context", async () => {
      await expect(service.addJob("workflow-run", { workflowId: "wf-7" }))
        .rejects.toThrow("Cannot add job without tenant context");
    });

    it("getTenantJobs throws without tenant context", async () => {
      await expect(service.getTenantJobs())
        .rejects.toThrow("Cannot get jobs without tenant context");
    });

    it("getJobById throws without tenant context", async () => {
      await expect(service.getJobById("job-1"))
        .rejects.toThrow("Cannot get job without tenant context");
    });
  });

  // ── 5. DLQ retains tenant identity for audit ─────────────────────────────

  describe("DLQ retains tenant identity for audit", () => {
    it("failed jobs in queue retain organizationId for DLQ replay", async () => {
      await tenantContextStorage.run(tenantA, async () => {
        const job = await service.addJob("workflow-run", { workflowId: "wf-8" });
        try {
          await queue.processJob(job.id, async () => {
            throw new Error("Processing error");
          });
        } catch {
          // Expected
        }

        const failedJob = await queue.getJob(job.id);
        expect(failedJob?.data.organizationId).toBe(tenantA.organizationId);
        expect(failedJob?.data.tenantId).toBe(tenantA.tenantId);
        expect(failedJob?.failedReason).toBe("Processing error");
      });
    });

    it("multiple tenants' failed jobs remain isolated", async () => {
      // Create failed jobs for both tenants
      await tenantContextStorage.run(tenantA, async () => {
        const job = await service.addJob("workflow-run", { workflowId: "wf-9" });
        try {
          await queue.processJob(job.id, async () => {
            throw new Error("A failure");
          });
        } catch {
          // Expected
        }
      });

      await tenantContextStorage.run(tenantB, async () => {
        const job = await service.addJob("workflow-run", { workflowId: "wf-10" });
        try {
          await queue.processJob(job.id, async () => {
            throw new Error("B failure");
          });
        } catch {
          // Expected
        }
      });

      // Each tenant should only see their own failed jobs
      await tenantContextStorage.run(tenantA, async () => {
        const jobs = await service.getTenantJobs();
        expect(jobs).toHaveLength(1);
        expect(jobs[0].data.organizationId).toBe(tenantA.organizationId);
        expect(jobs[0].failedReason).toBe("A failure");
      });

      await tenantContextStorage.run(tenantB, async () => {
        const jobs = await service.getTenantJobs();
        expect(jobs).toHaveLength(1);
        expect(jobs[0].data.organizationId).toBe(tenantB.organizationId);
        expect(jobs[0].failedReason).toBe("B failure");
      });
    });
  });
});
