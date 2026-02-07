export type WorkflowStatus = "RUNNING" | "PAUSED" | "HALTED" | "COMPLETED" | "FAILED";

export interface WorkflowExecution {
  id: string;
  status: WorkflowStatus;
}

import Redis from "ioredis";

const redis = new Redis();

class WorkflowExecutionStore {
  async setStatus(id: string, status: WorkflowStatus): Promise<void> {
    await redis.set(`workflow:${id}:status`, status);
  }

  async getStatus(id: string): Promise<WorkflowStatus> {
    const status = await redis.get(`workflow:${id}:status`);
    return (status as WorkflowStatus) || "RUNNING";
  }

  async resumeWorkflow(id: string): Promise<void> {
    const currentStatus = await this.getStatus(id);
    if (currentStatus === "PAUSED" || currentStatus === "HALTED") {
      await this.setStatus(id, "RUNNING");
    }
  }

  async markCompleted(id: string): Promise<void> {
    await this.setStatus(id, "COMPLETED");
  }

  async markFailed(id: string): Promise<void> {
    await this.setStatus(id, "FAILED");
  }
}

export const workflowExecutionStore = new WorkflowExecutionStore();
