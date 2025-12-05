/**
 * Playground Auto-Save Worker
 * 
 * Background worker that automatically saves playground sessions at intervals.
 * Prevents data loss and enables recovery from crashes.
 */

import { logger } from '../lib/logger';
import { PlaygroundSessionService } from './PlaygroundSessionService';

/**
 * Auto-save worker
 */
export class PlaygroundAutoSaveWorker {
  private service: PlaygroundSessionService;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private running: boolean = false;

  constructor(service: PlaygroundSessionService) {
    this.service = service;
  }

  /**
   * Start auto-save for a session
   */
  startAutoSave(sessionId: string, intervalMs: number): void {
    // Stop existing interval if any
    this.stopAutoSave(sessionId);

    const interval = setInterval(async () => {
      try {
        await this.autoSave(sessionId);
      } catch (error) {
        logger.error('Auto-save failed', {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, intervalMs);

    this.intervals.set(sessionId, interval);
    this.running = true;

    logger.debug('Started auto-save', { sessionId, intervalMs });
  }

  /**
   * Stop auto-save for a session
   */
  stopAutoSave(sessionId: string): void {
    const interval = this.intervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(sessionId);
      logger.debug('Stopped auto-save', { sessionId });
    }
  }

  /**
   * Stop all auto-save intervals
   */
  stopAll(): void {
    for (const [sessionId, interval] of this.intervals.entries()) {
      clearInterval(interval);
      logger.debug('Stopped auto-save', { sessionId });
    }
    this.intervals.clear();
    this.running = false;
  }

  /**
   * Perform auto-save
   */
  private async autoSave(sessionId: string): Promise<void> {
    const session = await this.service.loadSession(sessionId);
    if (!session) {
      // Session no longer exists, stop auto-save
      this.stopAutoSave(sessionId);
      return;
    }

    // Check if session is still active
    if (session.status !== 'active') {
      this.stopAutoSave(sessionId);
      return;
    }

    // Check if idle
    const lastActivity = new Date(session.metadata.lastActivityAt);
    const idleTime = Date.now() - lastActivity.getTime();
    const idleTimeout = session.metadata.autoSaveInterval * 10; // 10x interval

    if (idleTime > idleTimeout) {
      // Mark as idle
      session.status = 'idle';
      await this.service.saveSession(session);
      this.stopAutoSave(sessionId);
      logger.info('Session marked as idle', { sessionId, idleTime });
      return;
    }

    // Create checkpoint
    await this.service.updateSession(sessionId, {
      createCheckpoint: true,
    });

    logger.debug('Auto-saved session', { sessionId });
  }

  /**
   * Check if auto-save is running for session
   */
  isRunning(sessionId: string): boolean {
    return this.intervals.has(sessionId);
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    return this.intervals.size;
  }
}

/**
 * Conflict resolution strategies
 */
export type ConflictStrategy =
  | 'server_wins'    // Server version takes precedence
  | 'client_wins'    // Client version takes precedence
  | 'merge'          // Attempt to merge changes
  | 'manual';        // Require manual resolution

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  /**
   * Whether conflict was resolved
   */
  resolved: boolean;

  /**
   * Strategy used
   */
  strategy: ConflictStrategy;

  /**
   * Resolved layout (if resolved)
   */
  layout?: any;

  /**
   * Conflicts that require manual resolution
   */
  conflicts?: Array<{
    path: string;
    serverValue: any;
    clientValue: any;
    description: string;
  }>;

  /**
   * Error message (if failed)
   */
  error?: string;
}

/**
 * Conflict resolver
 */
export class ConflictResolver {
  /**
   * Resolve conflict between server and client versions
   */
  async resolve(
    serverLayout: any,
    clientLayout: any,
    strategy: ConflictStrategy = 'merge'
  ): Promise<ConflictResolution> {
    try {
      switch (strategy) {
        case 'server_wins':
          return {
            resolved: true,
            strategy,
            layout: serverLayout,
          };

        case 'client_wins':
          return {
            resolved: true,
            strategy,
            layout: clientLayout,
          };

        case 'merge':
          return this.mergeLayouts(serverLayout, clientLayout);

        case 'manual':
          return {
            resolved: false,
            strategy,
            conflicts: this.detectConflicts(serverLayout, clientLayout),
          };

        default:
          throw new Error(`Unknown strategy: ${strategy}`);
      }
    } catch (error) {
      return {
        resolved: false,
        strategy,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Merge two layouts
   */
  private mergeLayouts(serverLayout: any, clientLayout: any): ConflictResolution {
    // Simple merge strategy: use client layout but preserve server metadata
    const merged = {
      ...clientLayout,
      metadata: {
        ...clientLayout.metadata,
        ...serverLayout.metadata,
        mergedAt: new Date().toISOString(),
      },
    };

    // Detect conflicts
    const conflicts = this.detectConflicts(serverLayout, clientLayout);

    if (conflicts.length > 0) {
      logger.warn('Conflicts detected during merge', {
        conflictCount: conflicts.length,
      });
    }

    return {
      resolved: true,
      strategy: 'merge',
      layout: merged,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  /**
   * Detect conflicts between layouts
   */
  private detectConflicts(
    serverLayout: any,
    clientLayout: any
  ): Array<{
    path: string;
    serverValue: any;
    clientValue: any;
    description: string;
  }> {
    const conflicts: Array<{
      path: string;
      serverValue: any;
      clientValue: any;
      description: string;
    }> = [];

    // Compare sections
    if (serverLayout.sections && clientLayout.sections) {
      const serverSections = serverLayout.sections;
      const clientSections = clientLayout.sections;

      // Check for different section counts
      if (serverSections.length !== clientSections.length) {
        conflicts.push({
          path: 'sections.length',
          serverValue: serverSections.length,
          clientValue: clientSections.length,
          description: 'Different number of sections',
        });
      }

      // Check for modified sections
      const minLength = Math.min(serverSections.length, clientSections.length);
      for (let i = 0; i < minLength; i++) {
        const serverSection = serverSections[i];
        const clientSection = clientSections[i];

        if (JSON.stringify(serverSection) !== JSON.stringify(clientSection)) {
          conflicts.push({
            path: `sections[${i}]`,
            serverValue: serverSection,
            clientValue: clientSection,
            description: `Section ${i} modified`,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if layouts have conflicts
   */
  hasConflicts(serverLayout: any, clientLayout: any): boolean {
    return this.detectConflicts(serverLayout, clientLayout).length > 0;
  }
}

// Singleton instances
let autoSaveWorkerInstance: PlaygroundAutoSaveWorker | null = null;
let conflictResolverInstance: ConflictResolver | null = null;

export function getAutoSaveWorker(
  service: PlaygroundSessionService
): PlaygroundAutoSaveWorker {
  if (!autoSaveWorkerInstance) {
    autoSaveWorkerInstance = new PlaygroundAutoSaveWorker(service);
  }
  return autoSaveWorkerInstance;
}

export function getConflictResolver(): ConflictResolver {
  if (!conflictResolverInstance) {
    conflictResolverInstance = new ConflictResolver();
  }
  return conflictResolverInstance;
}

export default PlaygroundAutoSaveWorker;
