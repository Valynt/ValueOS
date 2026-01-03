/**
 * TypeScript Types for Documentation API
 * 
 * Defines types and interfaces for documentation-code mapping system.
 */

// ============================================================================
// Core Types
// ============================================================================

export type DocCategory = 'overview' | 'user-guide' | 'developer-guide' | 'api-reference';

export type MappingType = 'file' | 'directory' | 'function' | 'class' | 'component';

export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

// ============================================================================
// Documentation Section
// ============================================================================

export interface DocMapping {
  type: MappingType;
  path: string;
  description?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface DocSection {
  id: string;
  title: string;
  path: string;
  category: DocCategory;
  version: string;
  lastUpdated: string;
  mappings: DocMapping[];
  metadata?: {
    author?: string;
    reviewers?: string[];
    tags?: string[];
    relatedSections?: string[];
  };
}

export interface DocSectionCreate {
  title: string;
  path: string;
  category: DocCategory;
  mappings: DocMapping[];
  metadata?: DocSection['metadata'];
}

export interface DocSectionUpdate {
  title?: string;
  path?: string;
  category?: DocCategory;
  mappings?: DocMapping[];
  metadata?: DocSection['metadata'];
}

// ============================================================================
// Code Mapping
// ============================================================================

export interface CodeMapping {
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  docSections: string[];
  lastSync: string;
  changeDetected: boolean;
  changeType?: ChangeType;
  metadata?: {
    language?: string;
    framework?: string;
    dependencies?: string[];
  };
}

export interface CodeMappingCreate {
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  docSections: string[];
  metadata?: CodeMapping['metadata'];
}

export interface CodeMappingUpdate {
  docSections?: string[];
  changeDetected?: boolean;
  changeType?: ChangeType;
  metadata?: CodeMapping['metadata'];
}

// ============================================================================
// Change Detection
// ============================================================================

export interface FileChange {
  path: string;
  type: ChangeType;
  timestamp: string;
  diff?: {
    additions: number;
    deletions: number;
    changes: number;
  };
}

export interface ChangeDetectionRequest {
  files: string[] | FileChange[];
  since?: string;
  includeMetadata?: boolean;
}

export interface ChangeDetectionResponse {
  changedFiles: number;
  affectedMappings: number;
  affectedSections: number;
  sections: DocSection[];
  mappings?: CodeMapping[];
  recommendations?: UpdateRecommendation[];
}

export interface UpdateRecommendation {
  sectionId: string;
  sectionTitle: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggestedChanges?: string[];
  affectedFiles: string[];
}

// ============================================================================
// Sync Operations
// ============================================================================

export interface SyncRequest {
  sectionId?: string;
  filePath?: string;
  version?: string;
  notes?: string;
}

export interface SyncResponse {
  synced: boolean;
  timestamp: string;
  sectionsUpdated?: number;
  mappingsUpdated?: number;
}

export interface BulkSyncRequest {
  sections?: string[];
  files?: string[];
  version?: string;
}

// ============================================================================
// Health & Status
// ============================================================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  sections: number;
  mappings: number;
  outdated: number;
  coverage: string;
  lastSync?: string;
  issues?: HealthIssue[];
}

export interface HealthIssue {
  type: 'missing-mapping' | 'outdated-doc' | 'broken-link' | 'orphaned-section';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedItems: string[];
}

// ============================================================================
// Search & Query
// ============================================================================

export interface SearchQuery {
  query?: string;
  category?: DocCategory;
  tags?: string[];
  outdatedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

// ============================================================================
// Agent Integration Types
// ============================================================================

export interface AgentContext {
  agentId: string;
  agentType: 'documentation' | 'code-review' | 'sync' | 'analysis';
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AgentTask {
  id: string;
  type: 'update-docs' | 'detect-changes' | 'sync-mappings' | 'generate-report';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  context: AgentContext;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AgentTaskCreate {
  type: AgentTask['type'];
  context: AgentContext;
  input: Record<string, any>;
}

export interface AgentTaskUpdate {
  status?: AgentTask['status'];
  output?: Record<string, any>;
  error?: string;
}

// ============================================================================
// Version Control Integration
// ============================================================================

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  files: string[];
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface VersionInfo {
  version: string;
  commit?: string;
  branch?: string;
  timestamp: string;
  changes?: GitDiff[];
}

// ============================================================================
// Analytics & Metrics
// ============================================================================

export interface DocMetrics {
  totalSections: number;
  totalMappings: number;
  outdatedSections: number;
  coveragePercentage: number;
  lastUpdateTimestamp: string;
  updateFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  categoryBreakdown: Record<DocCategory, number>;
}

export interface UsageMetrics {
  views: number;
  searches: number;
  apiCalls: number;
  period: 'hour' | 'day' | 'week' | 'month';
  timestamp: string;
}

// ============================================================================
// Configuration
// ============================================================================

export interface DocApiConfig {
  baseUrl: string;
  apiVersion: string;
  timeout: number;
  retryAttempts: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  webhooks?: {
    enabled: boolean;
    url: string;
    events: string[];
  };
}

// ============================================================================
// Webhook Events
// ============================================================================

export interface WebhookEvent {
  id: string;
  type: 'section.created' | 'section.updated' | 'section.deleted' | 
        'mapping.created' | 'mapping.updated' | 'change.detected' | 'sync.completed';
  timestamp: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface WebhookPayload {
  event: WebhookEvent;
  signature: string;
  timestamp: string;
}

// ============================================================================
// Export All Types
// ============================================================================

export type {
  // Re-export for convenience
  DocSection as Section,
  CodeMapping as Mapping,
  ChangeDetectionResponse as ChangeDetection,
  UpdateRecommendation as Recommendation,
  HealthStatus as Health,
  SearchResult as SearchResults,
  ApiResponse as Response,
  AgentTask as Task
};
