/**
 * Enterprise Adapter Interface
 * Base interface that all enterprise integrations must implement
 */

export interface SyncOptions {
  lastSyncTime?: Date;
  changes?: any[];
  batchSize?: number;
  dryRun?: boolean;
}

export interface SyncResult {
  status: "success" | "partial" | "failed";
  pullCount: number;
  pushCount: number;
  conflicts: Conflict[];
  errors: SyncError[];
  metadata?: Record<string, any>;
}

export interface Conflict {
  id: string;
  localVersion: any;
  remoteVersion: any;
  timestamp: Date;
  resolvedBy?: "local" | "remote" | "manual";
}

export interface SyncError {
  entityId: string;
  operation: "create" | "update" | "delete";
  error: string;
  retryable: boolean;
}

export interface WebhookHandler {
  (event: WebhookEvent): Promise<void>;
}

export interface WebhookEvent {
  type: string;
  timestamp: Date;
  payload: any;
}

export interface HealthStatus {
  healthy: boolean;
  lastCheck: Date;
  details: {
    authenticated: boolean;
    rateLimitRemaining: number;
    lastSyncTime?: Date;
    errors?: string[];
  };
}

export interface AdapterMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  avgSyncDuration: number;
  apiCallsToday: number;
  rateLimitUtilization: number;
}

/**
 * Base interface for all enterprise adapters
 */
export interface IEnterpriseAdapter {
  // Adapter metadata
  readonly adapterType: string;
  readonly displayName: string;

  // Authentication
  authenticate(): Promise<void>;
  refreshToken(): Promise<void>;
  isAuthenticated(): boolean;

  // Sync operations
  sync(
    direction: "pull" | "push" | "bidirectional",
    options?: SyncOptions
  ): Promise<SyncResult>;

  // CRUD operations
  create(entityType: string, data: any): Promise<any>;
  read(entityType: string, id: string): Promise<any>;
  update(entityType: string, id: string, data: any): Promise<any>;
  delete(entityType: string, id: string): Promise<void>;

  // Batch operations
  batchCreate(entityType: string, data: any[]): Promise<any[]>;
  batchUpdate(
    entityType: string,
    updates: Array<{ id: string; data: any }>
  ): Promise<any[]>;

  // Query operations
  query(entityType: string, filters: any): Promise<any[]>;

  // Real-time updates (optional)
  subscribeToWebhooks?(callback: WebhookHandler): Promise<void>;
  unsubscribeFromWebhooks?(): Promise<void>;

  // Health & monitoring
  healthCheck(): Promise<HealthStatus>;
  getMetrics(): AdapterMetrics;

  // Lifecycle
  disconnect(): Promise<void>;
}

/**
 * Configuration for adapter connections
 */
export interface AdapterConfig {
  // Connection details
  connectionId: string;
  organizationId: string;

  // Authentication credentials (encrypted in storage)
  credentials: {
    type: "oauth" | "api_key" | "basic";
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    username?: string;
    password?: string;
    expiresAt?: Date;
  };

  // Sync configuration
  syncConfig: {
    enabled: boolean;
    direction: "pull" | "push" | "bidirectional";
    schedule: string; // Cron expression
    batchSize: number;
    conflictResolution: "local_wins" | "remote_wins" | "manual";
  };

  // Field mappings
  fieldMappings: Record<string, FieldMapping>;

  // Rate limiting
  rateLimits: {
    maxRequestsPerSecond: number;
    maxRequestsPerDay: number;
    burstAllowance: number;
  };

  // Metadata
  metadata?: Record<string, any>;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformer?: (value: any) => any;
  required: boolean;
  defaultValue?: any;
}

export default IEnterpriseAdapter;
