/**
 * Playground Session Service
 * 
 * Redis-backed transient draft state for the Artifact Builder Playground.
 * Supports rapid experimentation without database overhead.
 * 
 * Features:
 * - Session lifecycle management (create, load, save, commit, discard)
 * - Undo/redo with operation history
 * - Auto-save checkpoints
 * - Conflict resolution
 * - Session expiration
 */

import { createClient, RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { SDUIPageDefinition } from '../sdui/schema';
import {
  PlaygroundSession,
  SessionStatus,
  HistoryOperation,
  AutoSaveCheckpoint,
  CreateSessionOptions,
  UpdateSessionOptions,
  CommitOptions,
  SessionConfig,
  SessionStats,
  DEFAULT_SESSION_CONFIG,
  REDIS_KEYS,
  validateSession,
} from './PlaygroundSessionSchema';

/**
 * Playground Session Service
 */
export class PlaygroundSessionService {
  private client: RedisClientType;
  private connected: boolean = false;
  private config: Required<SessionConfig>;

  constructor(config?: SessionConfig) {
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };

    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    this.client.on('error', (err) => {
      logger.error('Redis client error', err);
      this.connected = false;
    });

    this.client.on('connect', () => {
      logger.info('Playground session service connected to Redis');
      this.connected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Playground session service disconnected from Redis');
      this.connected = false;
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
    }
  }

  /**
   * Create new playground session
   */
  async createSession(options: CreateSessionOptions): Promise<PlaygroundSession> {
    await this.ensureConnected();

    const sessionId = uuidv4();
    const now = new Date().toISOString();
    const config = { ...this.config, ...options.config };

    const session: PlaygroundSession = {
      sessionId,
      userId: options.userId,
      organizationId: options.organizationId,
      artifactId: options.artifactId,
      workflowExecutionId: options.workflowExecutionId,
      status: 'active',
      currentLayout: options.initialLayout,
      initialLayout: options.initialLayout,
      history: [],
      historyIndex: -1,
      checkpoints: [],
      metadata: {
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        expiresAt: new Date(Date.now() + config.ttl * 1000).toISOString(),
        operationCount: 0,
        undoCount: 0,
        redoCount: 0,
        autoSaveEnabled: config.autoSaveEnabled,
        autoSaveInterval: config.autoSaveInterval,
      },
      context: options.context,
    };

    // Save to Redis
    await this.saveSession(session);

    // Add to indexes
    await this.addToIndexes(session);

    logger.info('Created playground session', {
      sessionId,
      userId: options.userId,
      artifactId: options.artifactId,
    });

    return session;
  }

  /**
   * Load session from Redis
   */
  async loadSession(sessionId: string): Promise<PlaygroundSession | null> {
    await this.ensureConnected();

    const key = REDIS_KEYS.session(sessionId);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    try {
      const session = JSON.parse(data) as PlaygroundSession;

      // Validate session
      const validation = validateSession(session);
      if (!validation.valid) {
        logger.error('Invalid session data', {
          sessionId,
          errors: validation.errors,
        });
        return null;
      }

      // Check if expired
      if (new Date(session.metadata.expiresAt) < new Date()) {
        logger.info('Session expired', { sessionId });
        await this.expireSession(sessionId);
        return null;
      }

      // Update last activity
      session.metadata.lastActivityAt = new Date().toISOString();
      await this.saveSession(session);

      return session;
    } catch (error) {
      logger.error('Failed to parse session data', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Save session to Redis
   */
  async saveSession(session: PlaygroundSession): Promise<void> {
    await this.ensureConnected();

    const key = REDIS_KEYS.session(session.sessionId);
    const data = JSON.stringify(session);

    // Calculate TTL
    const expiresAt = new Date(session.metadata.expiresAt);
    const ttl = Math.max(Math.floor((expiresAt.getTime() - Date.now()) / 1000), 60);

    await this.client.setEx(key, ttl, data);
  }

  /**
   * Update session
   */
  async updateSession(
    sessionId: string,
    options: UpdateSessionOptions
  ): Promise<PlaygroundSession | null> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    const now = new Date().toISOString();

    // Update layout
    if (options.layout) {
      session.currentLayout = options.layout;
    }

    // Add operation to history
    if (options.operation) {
      const operation: HistoryOperation = {
        id: uuidv4(),
        timestamp: now,
        ...options.operation,
      };

      // Truncate history if at max size
      if (session.history.length >= this.config.maxHistorySize) {
        session.history.shift();
        session.historyIndex = Math.max(0, session.historyIndex - 1);
      }

      // If we're not at the end of history, truncate forward history
      if (session.historyIndex < session.history.length - 1) {
        session.history = session.history.slice(0, session.historyIndex + 1);
      }

      session.history.push(operation);
      session.historyIndex = session.history.length - 1;
      session.metadata.operationCount++;
    }

    // Update metadata
    if (options.metadata) {
      session.metadata = { ...session.metadata, ...options.metadata };
    }

    // Update context
    if (options.context) {
      session.context = { ...session.context, ...options.context };
    }

    // Create checkpoint
    if (options.createCheckpoint) {
      await this.createCheckpoint(session);
    }

    // Update timestamps
    session.metadata.updatedAt = now;
    session.metadata.lastActivityAt = now;

    await this.saveSession(session);

    return session;
  }

  /**
   * Undo last operation
   */
  async undo(sessionId: string): Promise<PlaygroundSession | null> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    if (session.historyIndex < 0) {
      logger.warn('No operations to undo', { sessionId });
      return session;
    }

    const operation = session.history[session.historyIndex];
    session.currentLayout = operation.before;
    session.historyIndex--;
    session.metadata.undoCount++;
    session.metadata.updatedAt = new Date().toISOString();

    await this.saveSession(session);

    logger.info('Undo operation', {
      sessionId,
      operationId: operation.id,
      newIndex: session.historyIndex,
    });

    return session;
  }

  /**
   * Redo last undone operation
   */
  async redo(sessionId: string): Promise<PlaygroundSession | null> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    if (session.historyIndex >= session.history.length - 1) {
      logger.warn('No operations to redo', { sessionId });
      return session;
    }

    session.historyIndex++;
    const operation = session.history[session.historyIndex];
    session.currentLayout = operation.after;
    session.metadata.redoCount++;
    session.metadata.updatedAt = new Date().toISOString();

    await this.saveSession(session);

    logger.info('Redo operation', {
      sessionId,
      operationId: operation.id,
      newIndex: session.historyIndex,
    });

    return session;
  }

  /**
   * Create checkpoint
   */
  private async createCheckpoint(session: PlaygroundSession): Promise<void> {
    const checkpoint: AutoSaveCheckpoint = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      layout: session.currentLayout,
      operationCount: session.metadata.operationCount,
      description: `Auto-save checkpoint at ${session.metadata.operationCount} operations`,
    };

    // Truncate checkpoints if at max
    if (session.checkpoints.length >= this.config.maxCheckpoints) {
      session.checkpoints.shift();
    }

    session.checkpoints.push(checkpoint);
    session.metadata.lastAutoSaveAt = checkpoint.timestamp;

    logger.debug('Created checkpoint', {
      sessionId: session.sessionId,
      checkpointId: checkpoint.id,
      operationCount: checkpoint.operationCount,
    });
  }

  /**
   * Restore from checkpoint
   */
  async restoreCheckpoint(
    sessionId: string,
    checkpointId: string
  ): Promise<PlaygroundSession | null> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    const checkpoint = session.checkpoints.find((c) => c.id === checkpointId);
    if (!checkpoint) {
      logger.warn('Checkpoint not found', { sessionId, checkpointId });
      return null;
    }

    session.currentLayout = checkpoint.layout;
    session.metadata.updatedAt = new Date().toISOString();

    await this.saveSession(session);

    logger.info('Restored from checkpoint', {
      sessionId,
      checkpointId,
      operationCount: checkpoint.operationCount,
    });

    return session;
  }

  /**
   * Commit session to database
   */
  async commitSession(
    sessionId: string,
    options: CommitOptions = {}
  ): Promise<{ success: boolean; artifactId?: string; error?: string }> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Update status
    session.status = 'committing';
    await this.saveSession(session);

    try {
      let artifactId = session.artifactId;

      // Create or update artifact in database
      if (options.createNew || !artifactId) {
        // Create new artifact
        const { data, error } = await supabase
          .from('workflow_artifacts')
          .insert({
            workflow_execution_id: session.workflowExecutionId,
            artifact_type: 'sdui_layout',
            artifact_data: session.currentLayout,
            metadata: {
              ...options.artifactMetadata,
              sessionId,
              operationCount: session.metadata.operationCount,
              commitMessage: options.message,
            },
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create artifact: ${error.message}`);
        }

        artifactId = data.id;
      } else {
        // Update existing artifact
        const { error } = await supabase
          .from('workflow_artifacts')
          .update({
            artifact_data: session.currentLayout,
            metadata: {
              ...options.artifactMetadata,
              sessionId,
              operationCount: session.metadata.operationCount,
              commitMessage: options.message,
              lastCommitAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', artifactId);

        if (error) {
          throw new Error(`Failed to update artifact: ${error.message}`);
        }
      }

      // Persist to workflow execution if requested
      if (options.persistToWorkflow && session.workflowExecutionId) {
        await supabase
          .from('workflow_execution_logs')
          .insert({
            workflow_execution_id: session.workflowExecutionId,
            event_type: 'artifact_committed',
            event_data: {
              artifactId,
              sessionId,
              operationCount: session.metadata.operationCount,
              message: options.message,
            },
          });
      }

      // Update session status
      session.status = 'committed';
      session.artifactId = artifactId;
      await this.saveSession(session);

      logger.info('Committed session', {
        sessionId,
        artifactId,
        operationCount: session.metadata.operationCount,
      });

      return { success: true, artifactId };
    } catch (error) {
      // Revert status
      session.status = 'active';
      await this.saveSession(session);

      logger.error('Failed to commit session', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Discard session
   */
  async discardSession(sessionId: string): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return;
    }

    session.status = 'discarded';
    await this.saveSession(session);

    // Remove from indexes
    await this.removeFromIndexes(session);

    logger.info('Discarded session', { sessionId });
  }

  /**
   * Expire session
   */
  private async expireSession(sessionId: string): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return;
    }

    session.status = 'expired';
    await this.saveSession(session);

    // Remove from indexes
    await this.removeFromIndexes(session);

    logger.info('Expired session', { sessionId });
  }

  /**
   * Get session statistics
   */
  async getSessionStats(sessionId: string): Promise<SessionStats | null> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    const duration =
      new Date(session.metadata.lastActivityAt).getTime() -
      new Date(session.metadata.createdAt).getTime();

    const operationsByType = session.history.reduce((acc, op) => {
      acc[op.type] = (acc[op.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const changesMade = this.calculateChanges(
      session.initialLayout,
      session.currentLayout
    );

    return {
      sessionId,
      duration,
      totalOperations: session.metadata.operationCount,
      operationsByType,
      undoCount: session.metadata.undoCount,
      redoCount: session.metadata.redoCount,
      checkpointCount: session.checkpoints.length,
      autoSaveCount: session.checkpoints.length,
      changesMade,
      status: session.status,
    };
  }

  /**
   * List user sessions
   */
  async listUserSessions(userId: string): Promise<string[]> {
    await this.ensureConnected();

    const key = REDIS_KEYS.userSessions(userId);
    return this.client.sMembers(key);
  }

  /**
   * List organization sessions
   */
  async listOrgSessions(orgId: string): Promise<string[]> {
    await this.ensureConnected();

    const key = REDIS_KEYS.orgSessions(orgId);
    return this.client.sMembers(key);
  }

  /**
   * Add session to indexes
   */
  private async addToIndexes(session: PlaygroundSession): Promise<void> {
    const pipeline = this.client.multi();

    // User sessions index
    pipeline.sAdd(REDIS_KEYS.userSessions(session.userId), session.sessionId);

    // Organization sessions index
    pipeline.sAdd(REDIS_KEYS.orgSessions(session.organizationId), session.sessionId);

    // Artifact sessions index
    if (session.artifactId) {
      pipeline.sAdd(REDIS_KEYS.artifactSessions(session.artifactId), session.sessionId);
    }

    await pipeline.exec();
  }

  /**
   * Remove session from indexes
   */
  private async removeFromIndexes(session: PlaygroundSession): Promise<void> {
    const pipeline = this.client.multi();

    pipeline.sRem(REDIS_KEYS.userSessions(session.userId), session.sessionId);
    pipeline.sRem(REDIS_KEYS.orgSessions(session.organizationId), session.sessionId);

    if (session.artifactId) {
      pipeline.sRem(REDIS_KEYS.artifactSessions(session.artifactId), session.sessionId);
    }

    await pipeline.exec();
  }

  /**
   * Calculate changes between layouts
   */
  private calculateChanges(
    initial: SDUIPageDefinition,
    current: SDUIPageDefinition
  ): number {
    // Simple diff: count changed sections
    let changes = 0;

    if (initial.sections.length !== current.sections.length) {
      changes += Math.abs(initial.sections.length - current.sections.length);
    }

    const minLength = Math.min(initial.sections.length, current.sections.length);
    for (let i = 0; i < minLength; i++) {
      if (JSON.stringify(initial.sections[i]) !== JSON.stringify(current.sections[i])) {
        changes++;
      }
    }

    return changes;
  }

  /**
   * Ensure Redis connection
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }
}

// Singleton instance
let sessionServiceInstance: PlaygroundSessionService | null = null;

export function getPlaygroundSessionService(
  config?: SessionConfig
): PlaygroundSessionService {
  if (!sessionServiceInstance) {
    sessionServiceInstance = new PlaygroundSessionService(config);
  }
  return sessionServiceInstance;
}

export default PlaygroundSessionService;
