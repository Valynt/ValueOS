/**
 * Service Worker Registration and Offline Support
 *
 * Manages service worker registration, offline detection,
 * and background sync functionality.
 */

import { logger } from '../lib/logger';

export interface OfflineConfig {
  enabled: boolean;
  cacheVersion: string;
  syncEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface SyncQueueItem {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
  retries: number;
}

export interface OfflineStatus {
  isOnline: boolean;
  connectionType: string;
  effectiveType: string;
  offlineQueueLength: number;
  lastSyncTime: number;
}

/**
 * Service Worker Manager
 */
export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: OfflineConfig;
  private offlineQueue: SyncQueueItem[] = [];
  private isOnline = navigator.onLine;
  private syncInProgress = false;

  constructor(config: OfflineConfig = {
    enabled: true,
    cacheVersion: 'v1',
    syncEnabled: true,
    notificationsEnabled: true,
  }) {
    this.config = config;
    this.setupEventListeners();
  }

  /**
   * Register service worker
   */
  async register(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !this.config.enabled) {
      logger.warn('Service Worker not supported or disabled');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      logger.info('Service Worker registered:', this.registration.scope);

      // Wait for service worker to activate
      if (this.registration.active) {
        await this.waitForActivation();
      } else {
        this.registration.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      }

      return true;
    } catch (error) {
      logger.error('Service Worker registration failed:', error);
      return false;
    }
  }

  /**
   * Unregister service worker
   */
  async unregister(): Promise<boolean> {
    if (this.registration) {
      const success = await this.registration.unregister();
      this.registration = null;
      logger.info('Service Worker unregistered:', success);
      return success;
    }
    return false;
  }

  /**
   * Check if service worker is active
   */
  isActive(): boolean {
    return !!(this.registration && this.registration.active);
  }

  /**
   * Get service worker version
   */
  async getVersion(): Promise<string | null> {
    if (!this.registration?.active) {
      return null;
    }

    try {
      const response = await this.registration.active.postMessage({
        type: 'GET_VERSION',
      });

      return new Promise((resolve) => {
        const channel = new MessageChannel();

        channel.port1.onmessage = (event) => {
          resolve(event.data.version);
        };

        this.registration!.active!.postMessage({
          type: 'GET_VERSION',
        }, [channel.port2]);
      });
    } catch (error) {
      logger.error('Failed to get service worker version:', error);
      return null;
    }
  }

  /**
   * Force refresh of service worker
   */
  async forceRefresh(): Promise<void> {
    if (this.registration) {
      await this.registration.update();
    }
  }

  /**
   * Skip waiting for new service worker
   */
  async skipWaiting(): Promise<void> {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Get offline status
   */
  getOfflineStatus(): OfflineStatus {
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    return {
      isOnline: this.isOnline,
      connectionType: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType || 'unknown',
      offlineQueueLength: this.offlineQueue.length,
      lastSyncTime: this.getLastSyncTime(),
    };
  }

  /**
   * Queue request for background sync
   */
  async queueRequest(request: Request): Promise<void> {
    if (!this.config.syncEnabled) {
      return;
    }

    const syncItem: SyncQueueItem = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now(),
      retries: 0,
    };

    this.offlineQueue.push(syncItem);
    await this.saveQueueToStorage();

    logger.info('Request queued for background sync:', request.url);
  }

  /**
   * Process offline queue when back online
   */
  async processQueue(): Promise<void> {
    if (this.syncInProgress || this.offlineQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;

    try {
      const queue = [...this.offlineQueue];
      const processed: number[] = [];

      for (const item of queue) {
        try {
          const response = await fetch(item.url, {
            method: item.method,
            headers: item.headers,
            body: item.body,
          });

          if (response.ok) {
            processed.push(item.id!);
            logger.info('Synced request:', item.url);
          } else {
            item.retries++;
            if (item.retries > 3) {
              processed.push(item.id!);
              logger.error('Max retries exceeded for:', item.url);
            }
          }
        } catch (error) {
          item.retries++;
          if (item.retries > 3) {
            processed.push(item.id!);
            logger.error('Max retries exceeded for:', item.url, error);
          }
        }
      }

      // Remove processed items
      this.offlineQueue = this.offlineQueue.filter(
        item => !processed.includes(item.id!)
      );

      await this.saveQueueToStorage();
      this.setLastSyncTime(Date.now());

      logger.info(`Processed ${processed.length} queued requests`);
    } catch (error) {
      logger.error('Failed to process sync queue:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Clear offline queue
   */
  async clearQueue(): Promise<void> {
    this.offlineQueue = [];
    await this.saveQueueToStorage();
    logger.info('Offline queue cleared');
  }

  private setupEventListeners(): void {
    // Online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      logger.info('Connection restored');
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      logger.info('Connection lost');
    });

    // Service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC_COMPLETE') {
        this.setLastSyncTime(Date.now());
      }
    });
  }

  private async waitForActivation(): Promise<void> {
    if (!this.registration?.installing) {
      return;
    }

    return new Promise((resolve) => {
      this.registration!.installing!.addEventListener('statechange', (event) => {
        if ((event.target as ServiceWorker).state === 'activated') {
          resolve();
        }
      });
    });
  }

  private async saveQueueToStorage(): Promise<void> {
    try {
      localStorage.setItem('valueos-sync-queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      logger.error('Failed to save sync queue:', error);
    }
  }

  private async loadQueueFromStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem('valueos-sync-queue');
      if (stored) {
        this.offlineQueue = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Failed to load sync queue:', error);
    }
  }

  private setLastSyncTime(timestamp: number): void {
    localStorage.setItem('valueos-last-sync', timestamp.toString());
  }

  private getLastSyncTime(): number {
    const stored = localStorage.getItem('valueos-last-sync');
    return stored ? parseInt(stored, 10) : 0;
  }
}

/**
 * React hook for service worker and offline functionality
 */
import { useState, useEffect, useCallback } from 'react';

export function useOfflineSupport(config?: OfflineConfig) {
  const [swManager] = useState(() => new ServiceWorkerManager(config));
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>(
    swManager.getOfflineStatus()
  );
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    const registerSW = async () => {
      const registered = await swManager.register();
      setIsRegistered(registered);
    };

    registerSW();

    // Update status periodically
    const interval = setInterval(() => {
      setOfflineStatus(swManager.getOfflineStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, [swManager]);

  const queueRequest = useCallback(async (request: Request) => {
    await swManager.queueRequest(request);
    setOfflineStatus(swManager.getOfflineStatus());
  }, [swManager]);

  const processQueue = useCallback(async () => {
    await swManager.processQueue();
    setOfflineStatus(swManager.getOfflineStatus());
  }, [swManager]);

  const clearQueue = useCallback(async () => {
    await swManager.clearQueue();
    setOfflineStatus(swManager.getOfflineStatus());
  }, [swManager]);

  const forceRefresh = useCallback(async () => {
    await swManager.forceRefresh();
  }, [swManager]);

  return {
    offlineStatus,
    isRegistered,
    queueRequest,
    processQueue,
    clearQueue,
    forceRefresh,
    isOnline: offlineStatus.isOnline,
    queueLength: offlineStatus.offlineQueueLength,
  };
}

/**
 * Offline-aware fetch wrapper
 */
export function createOfflineFetch(swManager: ServiceWorkerManager) {
  return async function offlineFetch(url: string, options?: RequestInit): Promise<Response> {
    const request = new Request(url, options);

    try {
      const response = await fetch(request);

      if (!response.ok && !swManager.getOfflineStatus().isOnline) {
        // Try to serve from cache
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
      }

      return response;
    } catch (error) {
      if (!swManager.getOfflineStatus().isOnline) {
        // Queue for background sync
        await swManager.queueRequest(request);

        // Try to serve from cache
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
      }

      throw error;
    }
  };
}

/**
 * Offline detection utilities
 */
export const OfflineDetection = {
  /**
   * Check if browser is online
   */
  isOnline(): boolean {
    return navigator.onLine;
  },

  /**
   * Get connection information
   */
  getConnection(): {
    type: string;
    effectiveType: string;
    downlink: number;
    rtt: number;
  } | null {
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    if (!connection) {
      return null;
    }

    return {
      type: connection.type,
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
    };
  },

  /**
   * Monitor connection changes
   */
  onConnectionChange(callback: (status: OfflineStatus) => void): () => void {
    const updateStatus = () => {
      const connection = OfflineDetection.getConnection();
      callback({
        isOnline: navigator.onLine,
        connectionType: connection?.type || 'unknown',
        effectiveType: connection?.effectiveType || 'unknown',
        offlineQueueLength: 0,
        lastSyncTime: 0,
      });
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  },
};
