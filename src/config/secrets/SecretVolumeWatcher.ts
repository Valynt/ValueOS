/**
 * Secret Volume Watcher
 * 
 * Watches mounted secret volumes for changes and triggers application reload
 * Enables zero-downtime secret rotation in Kubernetes
 * 
 * Sprint 3: Kubernetes Integration
 * Created: 2024-11-29
 */

import { promises as fs, watch, FSWatcher } from 'fs';
import { join } from 'path';
import { logger } from '../../lib/logger';
import { EventEmitter } from 'events';

/**
 * Secret file change event
 */
export interface SecretChangeEvent {
  secretKey: string;
  oldValue?: string;
  newValue: string;
  timestamp: Date;
}

/**
 * Watcher configuration
 */
export interface WatcherConfig {
  mountPath: string;
  pollInterval?: number;
  debounceMs?: number;
  healthCheckInterval?: number;
}

/**
 * Secret volume watcher for Kubernetes CSI driver
 * 
 * Monitors /mnt/secrets for file changes and emits events
 * Triggers graceful application reload on secret rotation
 */
export class SecretVolumeWatcher extends EventEmitter {
  private mountPath: string;
  private pollInterval: number;
  private debounceMs: number;
  private healthCheckInterval: number;
  
  private watcher: FSWatcher | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private secretCache: Map<string, string> = new Map();
  private isWatching: boolean = false;

  constructor(config: WatcherConfig) {
    super();
    
    this.mountPath = config.mountPath;
    this.pollInterval = config.pollInterval || 5000; // 5 seconds
    this.debounceMs = config.debounceMs || 1000; // 1 second
    this.healthCheckInterval = config.healthCheckInterval || 30000; // 30 seconds

    logger.info('Secret volume watcher initialized', {
      mountPath: this.mountPath,
      pollInterval: this.pollInterval,
      debounceMs: this.debounceMs
    });
  }

  /**
   * Start watching the secret volume
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      logger.warn('Secret volume watcher already started');
      return;
    }

    try {
      // Verify mount path exists
      await this.verifyMountPath();

      // Load initial secret values
      await this.loadSecrets();

      // Start watching for changes
      this.startWatching();

      // Start health check
      this.startHealthCheck();

      this.isWatching = true;

      logger.info('Secret volume watcher started successfully', {
        mountPath: this.mountPath,
        secretCount: this.secretCache.size
      });

      this.emit('started');
    } catch (error) {
      logger.error('Failed to start secret volume watcher', error instanceof Error ? error : new Error(String(error)), {
        mountPath: this.mountPath
      });
      throw error;
    }
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (!this.isWatching) {
      return;
    }

    // Stop file watcher
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    // Stop health check
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    this.isWatching = false;

    logger.info('Secret volume watcher stopped');
    this.emit('stopped');
  }

  /**
   * Verify mount path exists and is accessible
   */
  private async verifyMountPath(): Promise<void> {
    try {
      const stats = await fs.stat(this.mountPath);
      
      if (!stats.isDirectory()) {
        throw new Error(`Mount path is not a directory: ${this.mountPath}`);
      }

      // Try to read directory
      await fs.readdir(this.mountPath);

      logger.info('Mount path verified', { mountPath: this.mountPath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn('Mount path does not exist - CSI driver may not be configured', {
          mountPath: this.mountPath
        });
      }
      throw error;
    }
  }

  /**
   * Load all secrets from mount path
   */
  private async loadSecrets(): Promise<void> {
    try {
      const files = await fs.readdir(this.mountPath);

      for (const file of files) {
        // Skip hidden files and directories
        if (file.startsWith('.') || file.startsWith('..')) {
          continue;
        }

        const filePath = join(this.mountPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          const content = await fs.readFile(filePath, 'utf8');
          this.secretCache.set(file, content);
        }
      }

      logger.info('Loaded secrets from mount path', {
        mountPath: this.mountPath,
        secretCount: this.secretCache.size
      });
    } catch (error) {
      logger.error('Failed to load secrets', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Start watching for file changes
   */
  private startWatching(): void {
    try {
      this.watcher = watch(this.mountPath, { recursive: false }, (eventType, filename) => {
        if (!filename) {
          return;
        }

        // Skip hidden files
        if (filename.startsWith('.')) {
          return;
        }

        logger.debug('File change detected', {
          eventType,
          filename,
          mountPath: this.mountPath
        });

        // Debounce file changes
        this.debounceChange(filename);
      });

      logger.info('File watcher started', { mountPath: this.mountPath });
    } catch (error) {
      logger.error('Failed to start file watcher', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Debounce file changes to avoid rapid-fire events
   */
  private debounceChange(filename: string): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(filename);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.handleFileChange(filename);
      this.debounceTimers.delete(filename);
    }, this.debounceMs);

    this.debounceTimers.set(filename, timer);
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(filename: string): Promise<void> {
    try {
      const filePath = join(this.mountPath, filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        // File was deleted
        logger.info('Secret file deleted', { filename });
        this.secretCache.delete(filename);
        this.emit('secret-deleted', { secretKey: filename, timestamp: new Date() });
        return;
      }

      // Read new content
      const newContent = await fs.readFile(filePath, 'utf8');
      const oldContent = this.secretCache.get(filename);

      // Check if content actually changed
      if (oldContent === newContent) {
        logger.debug('Secret content unchanged', { filename });
        return;
      }

      // Update cache
      this.secretCache.set(filename, newContent);

      // Emit change event
      const changeEvent: SecretChangeEvent = {
        secretKey: filename,
        oldValue: oldContent,
        newValue: newContent,
        timestamp: new Date()
      };

      logger.info('Secret changed', {
        secretKey: filename,
        hasOldValue: !!oldContent,
        newValueLength: newContent.length
      });

      this.emit('secret-changed', changeEvent);

      // Check if this is a critical secret that requires reload
      if (this.isCriticalSecret(filename)) {
        logger.warn('Critical secret changed - application reload required', {
          secretKey: filename
        });
        this.emit('reload-required', changeEvent);
      }
    } catch (error) {
      logger.error('Failed to handle file change', error instanceof Error ? error : new Error(String(error)), {
        filename
      });
      this.emit('error', error);
    }
  }

  /**
   * Determine if a secret is critical (requires app reload)
   */
  private isCriticalSecret(secretKey: string): boolean {
    const criticalSecrets = [
      'database-password',
      'database-url',
      'jwt-secret',
      'supabase-service-key'
    ];

    return criticalSecrets.includes(secretKey);
  }

  /**
   * Start health check
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check failed', error instanceof Error ? error : new Error(String(error)));
        this.emit('health-check-failed', error);
      }
    }, this.healthCheckInterval);

    logger.info('Health check started', {
      interval: this.healthCheckInterval
    });
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Verify mount path still accessible
      await fs.access(this.mountPath);

      // Verify can still read secrets
      const files = await fs.readdir(this.mountPath);
      const fileCount = files.filter(f => !f.startsWith('.')).length;

      if (fileCount === 0) {
        logger.warn('No secrets found in mount path', {
          mountPath: this.mountPath
        });
      }

      this.emit('health-check-success', {
        mountPath: this.mountPath,
        secretCount: fileCount,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Health check failed', error instanceof Error ? error : new Error(String(error)), {
        mountPath: this.mountPath
      });
      throw error;
    }
  }

  /**
   * Get current secret value
   */
  getSecret(secretKey: string): string | undefined {
    return this.secretCache.get(secretKey);
  }

  /**
   * Get all secret keys
   */
  getSecretKeys(): string[] {
    return Array.from(this.secretCache.keys());
  }

  /**
   * Check if watching
   */
  isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Get statistics
   */
  getStats(): {
    isWatching: boolean;
    mountPath: string;
    secretCount: number;
    watchedFiles: string[];
  } {
    return {
      isWatching: this.isWatching,
      mountPath: this.mountPath,
      secretCount: this.secretCache.size,
      watchedFiles: Array.from(this.secretCache.keys())
    };
  }
}

/**
 * Create and start secret volume watcher from environment
 */
export function createSecretVolumeWatcher(): SecretVolumeWatcher | null {
  const mountPath = process.env.SECRETS_MOUNT_PATH || '/mnt/secrets';
  const enabled = process.env.SECRETS_VOLUME_WATCH_ENABLED !== 'false';

  if (!enabled) {
    logger.info('Secret volume watching disabled');
    return null;
  }

  const watcher = new SecretVolumeWatcher({
    mountPath,
    pollInterval: parseInt(process.env.SECRETS_WATCH_POLL_INTERVAL || '5000', 10),
    debounceMs: parseInt(process.env.SECRETS_WATCH_DEBOUNCE_MS || '1000', 10),
    healthCheckInterval: parseInt(process.env.SECRETS_HEALTH_CHECK_INTERVAL || '30000', 10)
  });

  // Handle events
  watcher.on('secret-changed', (event: SecretChangeEvent) => {
    logger.info('Secret changed event', {
      secretKey: event.secretKey,
      timestamp: event.timestamp
    });
  });

  watcher.on('reload-required', (event: SecretChangeEvent) => {
    logger.warn('Application reload required due to secret change', {
      secretKey: event.secretKey
    });
    
    // TODO: Implement graceful reload
    // This could:
    // 1. Notify load balancer to stop sending new requests
    // 2. Wait for existing requests to complete
    // 3. Reload configuration
    // 4. Notify load balancer to resume
  });

  watcher.on('error', (error: Error) => {
    logger.error('Secret watcher error', error);
  });

  return watcher;
}

/**
 * Global watcher instance
 */
export let secretVolumeWatcher: SecretVolumeWatcher | null = null;

/**
 * Initialize secret volume watcher
 */
export async function initializeSecretVolumeWatcher(): Promise<void> {
  if (secretVolumeWatcher) {
    logger.warn('Secret volume watcher already initialized');
    return;
  }

  secretVolumeWatcher = createSecretVolumeWatcher();

  if (secretVolumeWatcher) {
    try {
      await secretVolumeWatcher.start();
      logger.info('Secret volume watcher initialized and started');
    } catch (error) {
      logger.error('Failed to start secret volume watcher', error instanceof Error ? error : new Error(String(error)));
      // Don't throw - app can still run without watcher
    }
  }
}

/**
 * Shutdown secret volume watcher
 */
export async function shutdownSecretVolumeWatcher(): Promise<void> {
  if (secretVolumeWatcher) {
    await secretVolumeWatcher.stop();
    secretVolumeWatcher = null;
    logger.info('Secret volume watcher shutdown');
  }
}
