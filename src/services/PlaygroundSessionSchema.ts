/**
 * Playground Session Schema
 * 
 * Defines the transient draft state for the Artifact Builder Playground.
 * All rapid experimentation happens in Redis, only committed changes go to Postgres.
 */

import { z } from 'zod';
import { SDUIPageDefinition } from '../sdui/schema';
import { AtomicUIAction } from '../sdui/AtomicUIActions';

/**
 * Session status
 */
export type SessionStatus =
  | 'active'      // User is actively editing
  | 'idle'        // No activity for a while
  | 'committing'  // Being committed to database
  | 'committed'   // Successfully committed
  | 'discarded'   // User discarded changes
  | 'expired';    // Session expired

/**
 * Operation type for undo/redo
 */
export type OperationType =
  | 'mutation'      // Atomic UI mutation
  | 'regeneration'  // Full layout regeneration
  | 'user_edit'     // Direct user edit
  | 'agent_action'; // Agent-initiated change

/**
 * Operation in history stack
 */
export interface HistoryOperation {
  /**
   * Unique operation ID
   */
  id: string;

  /**
   * Operation type
   */
  type: OperationType;

  /**
   * Timestamp
   */
  timestamp: string;

  /**
   * Layout state before operation
   */
  before: SDUIPageDefinition;

  /**
   * Layout state after operation
   */
  after: SDUIPageDefinition;

  /**
   * Action that caused the change (for mutations)
   */
  action?: AtomicUIAction;

  /**
   * Human-readable description
   */
  description: string;

  /**
   * User or agent that performed the operation
   */
  actor: {
    type: 'user' | 'agent';
    id: string;
    name?: string;
  };

  /**
   * Metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Auto-save checkpoint
 */
export interface AutoSaveCheckpoint {
  /**
   * Checkpoint ID
   */
  id: string;

  /**
   * Timestamp
   */
  timestamp: string;

  /**
   * Layout state
   */
  layout: SDUIPageDefinition;

  /**
   * Operation count at checkpoint
   */
  operationCount: number;

  /**
   * Description
   */
  description: string;
}

/**
 * Playground session state
 */
export interface PlaygroundSession {
  /**
   * Session ID
   */
  sessionId: string;

  /**
   * User ID
   */
  userId: string;

  /**
   * Organization ID
   */
  organizationId: string;

  /**
   * Artifact ID (if editing existing artifact)
   */
  artifactId?: string;

  /**
   * Workflow execution ID (if part of workflow)
   */
  workflowExecutionId?: string;

  /**
   * Session status
   */
  status: SessionStatus;

  /**
   * Current layout state
   */
  currentLayout: SDUIPageDefinition;

  /**
   * Initial layout (for comparison)
   */
  initialLayout: SDUIPageDefinition;

  /**
   * Operation history (for undo/redo)
   */
  history: HistoryOperation[];

  /**
   * Current position in history (for undo/redo)
   */
  historyIndex: number;

  /**
   * Auto-save checkpoints
   */
  checkpoints: AutoSaveCheckpoint[];

  /**
   * Session metadata
   */
  metadata: {
    /**
     * Session created at
     */
    createdAt: string;

    /**
     * Last updated at
     */
    updatedAt: string;

    /**
     * Last activity at
     */
    lastActivityAt: string;

    /**
     * Session expires at
     */
    expiresAt: string;

    /**
     * Total operations performed
     */
    operationCount: number;

    /**
     * Total undo operations
     */
    undoCount: number;

    /**
     * Total redo operations
     */
    redoCount: number;

    /**
     * Auto-save enabled
     */
    autoSaveEnabled: boolean;

    /**
     * Auto-save interval (ms)
     */
    autoSaveInterval: number;

    /**
     * Last auto-save at
     */
    lastAutoSaveAt?: string;
  };

  /**
   * Session context (additional data)
   */
  context?: Record<string, any>;
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /**
   * Session TTL in seconds (default: 1 hour)
   */
  ttl?: number;

  /**
   * Max history size (default: 50)
   */
  maxHistorySize?: number;

  /**
   * Max checkpoint count (default: 10)
   */
  maxCheckpoints?: number;

  /**
   * Auto-save enabled (default: true)
   */
  autoSaveEnabled?: boolean;

  /**
   * Auto-save interval in ms (default: 30 seconds)
   */
  autoSaveInterval?: number;

  /**
   * Idle timeout in ms (default: 5 minutes)
   */
  idleTimeout?: number;
}

/**
 * Default session configuration
 */
export const DEFAULT_SESSION_CONFIG: Required<SessionConfig> = {
  ttl: 60 * 60, // 1 hour
  maxHistorySize: 50,
  maxCheckpoints: 10,
  autoSaveEnabled: true,
  autoSaveInterval: 30 * 1000, // 30 seconds
  idleTimeout: 5 * 60 * 1000, // 5 minutes
};

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  /**
   * User ID
   */
  userId: string;

  /**
   * Organization ID
   */
  organizationId: string;

  /**
   * Initial layout
   */
  initialLayout: SDUIPageDefinition;

  /**
   * Artifact ID (if editing existing)
   */
  artifactId?: string;

  /**
   * Workflow execution ID (if part of workflow)
   */
  workflowExecutionId?: string;

  /**
   * Session configuration
   */
  config?: SessionConfig;

  /**
   * Additional context
   */
  context?: Record<string, any>;
}

/**
 * Session update options
 */
export interface UpdateSessionOptions {
  /**
   * New layout state
   */
  layout?: SDUIPageDefinition;

  /**
   * Operation to add to history
   */
  operation?: Omit<HistoryOperation, 'id' | 'timestamp'>;

  /**
   * Update metadata
   */
  metadata?: Partial<PlaygroundSession['metadata']>;

  /**
   * Update context
   */
  context?: Record<string, any>;

  /**
   * Create checkpoint
   */
  createCheckpoint?: boolean;
}

/**
 * Commit options
 */
export interface CommitOptions {
  /**
   * Commit message
   */
  message?: string;

  /**
   * Create new artifact or update existing
   */
  createNew?: boolean;

  /**
   * Artifact metadata
   */
  artifactMetadata?: Record<string, any>;

  /**
   * Persist to workflow execution
   */
  persistToWorkflow?: boolean;
}

/**
 * Session statistics
 */
export interface SessionStats {
  /**
   * Session ID
   */
  sessionId: string;

  /**
   * Session duration (ms)
   */
  duration: number;

  /**
   * Total operations
   */
  totalOperations: number;

  /**
   * Operations by type
   */
  operationsByType: Record<OperationType, number>;

  /**
   * Undo/redo count
   */
  undoCount: number;
  redoCount: number;

  /**
   * Checkpoint count
   */
  checkpointCount: number;

  /**
   * Auto-save count
   */
  autoSaveCount: number;

  /**
   * Changes made (diff from initial)
   */
  changesMade: number;

  /**
   * Session status
   */
  status: SessionStatus;
}

/**
 * Zod schemas for validation
 */

export const HistoryOperationSchema = z.object({
  id: z.string(),
  type: z.enum(['mutation', 'regeneration', 'user_edit', 'agent_action']),
  timestamp: z.string(),
  before: z.any(), // SDUIPageDefinition
  after: z.any(), // SDUIPageDefinition
  action: z.any().optional(),
  description: z.string(),
  actor: z.object({
    type: z.enum(['user', 'agent']),
    id: z.string(),
    name: z.string().optional(),
  }),
  metadata: z.record(z.any()).optional(),
});

export const AutoSaveCheckpointSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  layout: z.any(), // SDUIPageDefinition
  operationCount: z.number(),
  description: z.string(),
});

export const PlaygroundSessionSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  artifactId: z.string().optional(),
  workflowExecutionId: z.string().optional(),
  status: z.enum(['active', 'idle', 'committing', 'committed', 'discarded', 'expired']),
  currentLayout: z.any(), // SDUIPageDefinition
  initialLayout: z.any(), // SDUIPageDefinition
  history: z.array(HistoryOperationSchema),
  historyIndex: z.number(),
  checkpoints: z.array(AutoSaveCheckpointSchema),
  metadata: z.object({
    createdAt: z.string(),
    updatedAt: z.string(),
    lastActivityAt: z.string(),
    expiresAt: z.string(),
    operationCount: z.number(),
    undoCount: z.number(),
    redoCount: z.number(),
    autoSaveEnabled: z.boolean(),
    autoSaveInterval: z.number(),
    lastAutoSaveAt: z.string().optional(),
  }),
  context: z.record(z.any()).optional(),
});

/**
 * Validate session data
 */
export function validateSession(data: any): {
  valid: boolean;
  errors: string[];
} {
  try {
    PlaygroundSessionSchema.parse(data);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Redis key patterns
 */
export const REDIS_KEYS = {
  /**
   * Session data key
   */
  session: (sessionId: string) => `playground:session:${sessionId}`,

  /**
   * User sessions index
   */
  userSessions: (userId: string) => `playground:user:${userId}:sessions`,

  /**
   * Organization sessions index
   */
  orgSessions: (orgId: string) => `playground:org:${orgId}:sessions`,

  /**
   * Artifact sessions index
   */
  artifactSessions: (artifactId: string) => `playground:artifact:${artifactId}:sessions`,

  /**
   * Session lock (for concurrent access)
   */
  sessionLock: (sessionId: string) => `playground:lock:${sessionId}`,

  /**
   * Auto-save queue
   */
  autoSaveQueue: () => `playground:autosave:queue`,
};

export default PlaygroundSessionSchema;
