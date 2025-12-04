export type WorkflowStatus = 'RUNNING' | 'PAUSED' | 'HALTED';

export interface WorkflowExecution {
  id: string;
  status: WorkflowStatus;
}

class WorkflowExecutionStore {
  private executions: Map<string, WorkflowStatus> = new Map();

  setStatus(id: string, status: WorkflowStatus): void {
    this.executions.set(id, status);
  }

  getStatus(id: string): WorkflowStatus {
    return this.executions.get(id) || 'RUNNING';
  }
}

export const workflowExecutionStore = new WorkflowExecutionStore();
