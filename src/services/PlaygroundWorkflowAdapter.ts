/**
 * Playground Workflow Adapter
 * 
 * Integrates Playground sessions with WorkflowOrchestrator.
 * Enables draft mode where rapid experimentation happens in Redis,
 * and only committed changes are persisted to Postgres.
 */

import { logger } from '../lib/logger';
import { WorkflowOrchestrator } from './WorkflowOrchestrator';
import { PlaygroundSessionService } from './PlaygroundSessionService';
import { PlaygroundAutoSaveWorker, getAutoSaveWorker } from './PlaygroundAutoSave';
import { SDUIPageDefinition } from '../sdui/schema';
import { AtomicUIAction } from '../sdui/AtomicUIActions';
import { ComponentMutationService } from './ComponentMutationService';

/**
 * Workflow execution mode
 */
export type ExecutionMode =
  | 'standard'    // Standard mode: write directly to database
  | 'draft';      // Draft mode: use Redis session

/**
 * Playground workflow adapter
 */
export class PlaygroundWorkflowAdapter {
  private orchestrator: WorkflowOrchestrator;
  private sessionService: PlaygroundSessionService;
  private mutationService: ComponentMutationService;
  private autoSaveWorker: PlaygroundAutoSaveWorker;

  constructor(
    orchestrator: WorkflowOrchestrator,
    sessionService: PlaygroundSessionService
  ) {
    this.orchestrator = orchestrator;
    this.sessionService = sessionService;
    this.mutationService = new ComponentMutationService();
    this.autoSaveWorker = getAutoSaveWorker(sessionService);
  }

  /**
   * Start workflow in draft mode
   */
  async startDraftWorkflow(
    workflowDefinitionId: string,
    userId: string,
    organizationId: string,
    initialLayout: SDUIPageDefinition,
    context: Record<string, any> = {}
  ): Promise<{
    sessionId: string;
    workflowExecutionId: string;
  }> {
    // Start workflow execution (writes to database)
    const workflowExecutionId = await this.orchestrator.executeWorkflow(
      workflowDefinitionId,
      {
        ...context,
        mode: 'draft',
        userId,
        organizationId,
      }
    );

    // Create playground session (Redis)
    const session = await this.sessionService.createSession({
      userId,
      organizationId,
      initialLayout,
      workflowExecutionId,
      context: {
        ...context,
        workflowDefinitionId,
      },
    });

    // Start auto-save
    this.autoSaveWorker.startAutoSave(
      session.sessionId,
      session.metadata.autoSaveInterval
    );

    logger.info('Started draft workflow', {
      sessionId: session.sessionId,
      workflowExecutionId,
      userId,
    });

    return {
      sessionId: session.sessionId,
      workflowExecutionId,
    };
  }

  /**
   * Apply user mutation in draft mode
   */
  async applyDraftMutation(
    sessionId: string,
    action: AtomicUIAction,
    actor: { type: 'user' | 'agent'; id: string; name?: string }
  ): Promise<{
    success: boolean;
    layout?: SDUIPageDefinition;
    error?: string;
  }> {
    const session = await this.sessionService.loadSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Apply mutation
    const { layout, result } = await this.mutationService.applyAction(
      session.currentLayout,
      action
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Update session with operation history
    await this.sessionService.updateSession(sessionId, {
      layout,
      operation: {
        type: 'mutation',
        before: session.currentLayout,
        after: layout,
        action,
        description: action.description || 'Mutation applied',
        actor,
      },
    });

    logger.debug('Applied draft mutation', {
      sessionId,
      actionType: action.type,
      affectedComponents: result.affected_components,
    });

    return { success: true, layout };
  }

  /**
   * Apply agent action in draft mode
   */
  async applyAgentAction(
    sessionId: string,
    newLayout: SDUIPageDefinition,
    agentId: string,
    agentName: string,
    description: string
  ): Promise<{
    success: boolean;
    layout?: SDUIPageDefinition;
    error?: string;
  }> {
    const session = await this.sessionService.loadSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Update session with operation history
    await this.sessionService.updateSession(sessionId, {
      layout: newLayout,
      operation: {
        type: 'agent_action',
        before: session.currentLayout,
        after: newLayout,
        description,
        actor: {
          type: 'agent',
          id: agentId,
          name: agentName,
        },
      },
    });

    logger.debug('Applied agent action', {
      sessionId,
      agentId,
      description,
    });

    return { success: true, layout: newLayout };
  }

  /**
   * Commit draft to database
   */
  async commitDraft(
    sessionId: string,
    commitMessage?: string
  ): Promise<{
    success: boolean;
    artifactId?: string;
    workflowExecutionId?: string;
    error?: string;
  }> {
    const session = await this.sessionService.loadSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Stop auto-save
    this.autoSaveWorker.stopAutoSave(sessionId);

    // Commit to database
    const result = await this.sessionService.commitSession(sessionId, {
      message: commitMessage,
      persistToWorkflow: true,
    });

    if (!result.success) {
      // Restart auto-save on failure
      this.autoSaveWorker.startAutoSave(
        sessionId,
        session.metadata.autoSaveInterval
      );
      return result;
    }

    logger.info('Committed draft', {
      sessionId,
      artifactId: result.artifactId,
      workflowExecutionId: session.workflowExecutionId,
      operationCount: session.metadata.operationCount,
    });

    return {
      success: true,
      artifactId: result.artifactId,
      workflowExecutionId: session.workflowExecutionId,
    };
  }

  /**
   * Discard draft
   */
  async discardDraft(sessionId: string): Promise<void> {
    // Stop auto-save
    this.autoSaveWorker.stopAutoSave(sessionId);

    // Discard session
    await this.sessionService.discardSession(sessionId);

    logger.info('Discarded draft', { sessionId });
  }

  /**
   * Undo last operation
   */
  async undo(sessionId: string): Promise<{
    success: boolean;
    layout?: SDUIPageDefinition;
    error?: string;
  }> {
    const session = await this.sessionService.undo(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    return { success: true, layout: session.currentLayout };
  }

  /**
   * Redo last undone operation
   */
  async redo(sessionId: string): Promise<{
    success: boolean;
    layout?: SDUIPageDefinition;
    error?: string;
  }> {
    const session = await this.sessionService.redo(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    return { success: true, layout: session.currentLayout };
  }

  /**
   * Get session history
   */
  async getHistory(sessionId: string): Promise<{
    success: boolean;
    history?: any[];
    currentIndex?: number;
    error?: string;
  }> {
    const session = await this.sessionService.loadSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    return {
      success: true,
      history: session.history,
      currentIndex: session.historyIndex,
    };
  }

  /**
   * Get session statistics
   */
  async getStats(sessionId: string) {
    return this.sessionService.getSessionStats(sessionId);
  }

  /**
   * Resume session (reactivate idle session)
   */
  async resumeSession(sessionId: string): Promise<{
    success: boolean;
    layout?: SDUIPageDefinition;
    error?: string;
  }> {
    const session = await this.sessionService.loadSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'idle') {
      session.status = 'active';
      await this.sessionService.saveSession(session);

      // Restart auto-save
      this.autoSaveWorker.startAutoSave(
        sessionId,
        session.metadata.autoSaveInterval
      );

      logger.info('Resumed session', { sessionId });
    }

    return { success: true, layout: session.currentLayout };
  }

  /**
   * List user's active sessions
   */
  async listUserSessions(userId: string): Promise<string[]> {
    return this.sessionService.listUserSessions(userId);
  }

  /**
   * Check if workflow is in draft mode
   */
  async isDraftMode(workflowExecutionId: string): Promise<boolean> {
    // Check if there's an active session for this workflow
    const session = await this.sessionService.loadSession(workflowExecutionId);
    return session !== null && session.status === 'active';
  }

  /**
   * Get current layout for workflow
   */
  async getCurrentLayout(
    workflowExecutionId: string
  ): Promise<SDUIPageDefinition | null> {
    const session = await this.sessionService.loadSession(workflowExecutionId);
    return session?.currentLayout || null;
  }
}

// Singleton instance
let adapterInstance: PlaygroundWorkflowAdapter | null = null;

export function getPlaygroundWorkflowAdapter(
  orchestrator: WorkflowOrchestrator,
  sessionService: PlaygroundSessionService
): PlaygroundWorkflowAdapter {
  if (!adapterInstance) {
    adapterInstance = new PlaygroundWorkflowAdapter(orchestrator, sessionService);
  }
  return adapterInstance;
}

export default PlaygroundWorkflowAdapter;
