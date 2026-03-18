/**
 * PlaygroundWorkflowAdapter
 *
 * Bridges the playground UI with workflow execution and session management.
 */

import { getAutoSaveWorker } from "./PlaygroundAutoSave.js";

interface Orchestrator {
  executeWorkflow(workflowDef: string, context: unknown): Promise<string>;
}

interface SessionService {
  createSession(params: {
    userId: string;
    organizationId: string;
    workflowExecutionId: string;
    layout: unknown;
    execution: unknown;
  }): Promise<{ sessionId: string; metadata: { autoSaveInterval?: number } }>;
  loadSession(sessionId: string): Promise<unknown>;
}

export interface PlaygroundStartResult {
  sessionId: string;
  workflowExecutionId: string;
}

export class PlaygroundWorkflowAdapter {
  constructor(
    private orchestrator: Orchestrator,
    private sessionService: SessionService
  ) {}

  async startDraftWorkflow(
    workflowDef: string,
    userId: string,
    organizationId: string,
    layout: unknown,
    execution: unknown
  ): Promise<PlaygroundStartResult> {
    const workflowExecutionId = await this.orchestrator.executeWorkflow(
      workflowDef,
      { userId, organizationId, execution }
    );

    const session = await this.sessionService.createSession({
      userId,
      organizationId,
      workflowExecutionId,
      layout,
      execution,
    });

    const autoSaveWorker = getAutoSaveWorker();
    if (session.metadata?.autoSaveInterval) {
      autoSaveWorker.startAutoSave(session.sessionId, session.metadata.autoSaveInterval);
    }

    return {
      sessionId: session.sessionId,
      workflowExecutionId,
    };
  }
}
