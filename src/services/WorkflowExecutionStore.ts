export type WorkflowStatus = 'RUNNING' | 'PAUSED' | 'HALTED';

export interface WorkflowExecution {
  id: string;
  status: WorkflowStatus;
}

import Redis from 'ioredis';

const redis = new Redis();

class WorkflowExecutionStore {
  async setStatus(id: string, status: WorkflowStatus): Promise<void> {
    await redis.set(`workflow:${id}:status`, status);
  }

  async getStatus(id: string): Promise<WorkflowStatus> {
    const status = await redis.get(`workflow:${id}:status`);
    return (status as WorkflowStatus) || 'RUNNING';
  }
}

export const workflowExecutionStore = new WorkflowExecutionStore();
