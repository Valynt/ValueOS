/**
 * Artifacts Service
 * 
 * Client-side service for persisting and retrieving artifacts.
 * Connects the agent UI to the backend artifacts API.
 */

import { api } from './api/client';

import type { Artifact, ArtifactContent } from '@/features/workspace/agent/types';
import { analyticsClient } from '@/lib/analyticsClient';

// ============================================================================
// Types
// ============================================================================

export type ArtifactType =
  | 'value_model'
  | 'financial_projection'
  | 'benchmark_comparison'
  | 'executive_summary'
  | 'pain_point_analysis'
  | 'assumption_set'
  | 'narrative'
  | 'chart'
  | 'table';

export type ArtifactStatus =
  | 'draft'
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'superseded';

export interface CreateArtifactRequest {
  valueCaseId?: string;
  type: ArtifactType;
  title: string;
  status?: ArtifactStatus;
  content: ArtifactContent;
  sourceUrl?: string;
  agentRunId?: string;
  checkpointId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateArtifactRequest {
  title?: string;
  status?: ArtifactStatus;
  content?: ArtifactContent;
  metadata?: Record<string, unknown>;
}

export interface ListArtifactsQuery {
  valueCaseId?: string;
  type?: ArtifactType;
  status?: ArtifactStatus;
  search?: string;
  sortBy?: 'created_at' | 'updated_at' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PersistedArtifact {
  id: string;
  tenantId: string;
  valueCaseId?: string;
  type: ArtifactType;
  title: string;
  status: ArtifactStatus;
  content: ArtifactContent;
  sourceUrl?: string;
  agentRunId?: string;
  checkpointId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  requestId?: string;
}

export interface ApiResponse<T> {
  data: T;
  requestId?: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

const API_BASE = '/v1/artifacts';

/**
 * Artifacts service for client-side usage
 */
class ArtifactsService {
  /**
   * Create a new artifact
   */
  async create(request: CreateArtifactRequest): Promise<PersistedArtifact> {
    const response = await api.post<ApiResponse<PersistedArtifact>>(API_BASE, request);
    analyticsClient.trackWorkflowEvent('asset_created', 'artifact', {
      artifact_type: request.type,
      value_case_id: request.valueCaseId,
      artifact_id: response.data.id,
    });
    return response.data;
  }

  /**
   * Create multiple artifacts at once
   */
  async createBatch(
    valueCaseId: string | undefined,
    artifacts: Omit<CreateArtifactRequest, 'valueCaseId'>[]
  ): Promise<PersistedArtifact[]> {
    const response = await api.post<ApiResponse<PersistedArtifact[]>>(
      `${API_BASE}/batch`,
      { valueCaseId, artifacts }
    );
    analyticsClient.trackWorkflowEvent('asset_created', 'artifact', {
      artifact_count: artifacts.length,
      value_case_id: valueCaseId,
      artifact_types: artifacts.map((artifact) => artifact.type),
    });
    return response.data;
  }

  /**
   * Get an artifact by ID
   */
  async getById(artifactId: string): Promise<PersistedArtifact> {
    const response = await api.get<ApiResponse<PersistedArtifact>>(`${API_BASE}/${artifactId}`);
    return response.data;
  }

  /**
   * Get all artifacts for a value case
   */
  async getByValueCase(caseId: string): Promise<PersistedArtifact[]> {
    const response = await api.get<ApiResponse<PersistedArtifact[]>>(`${API_BASE}/case/${caseId}`);
    return response.data;
  }

  /**
   * List artifacts with pagination and filtering
   */
  async list(query: ListArtifactsQuery = {}): Promise<PaginatedResponse<PersistedArtifact>> {
    const params: Record<string, string | number | boolean | undefined> = {};
    
    if (query.valueCaseId) params.valueCaseId = query.valueCaseId;
    if (query.type) params.type = query.type;
    if (query.status) params.status = query.status;
    if (query.search) params.search = query.search;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sortOrder) params.sortOrder = query.sortOrder;
    if (query.page) params.page = query.page;
    if (query.limit) params.limit = query.limit;

    return api.get<PaginatedResponse<PersistedArtifact>>(API_BASE, { params });
  }

  /**
   * Update an artifact
   */
  async update(artifactId: string, request: UpdateArtifactRequest): Promise<PersistedArtifact> {
    const response = await api.patch<ApiResponse<PersistedArtifact>>(
      `${API_BASE}/${artifactId}`,
      request
    );
    return response.data;
  }

  /**
   * Delete an artifact
   */
  async delete(artifactId: string): Promise<void> {
    await api.delete(`${API_BASE}/${artifactId}`);
  }

  /**
   * Convert a UI Artifact to a CreateArtifactRequest
   */
  toCreateRequest(
    artifact: Artifact,
    valueCaseId?: string
  ): CreateArtifactRequest {
    return {
      valueCaseId,
      type: artifact.type as ArtifactType,
      title: artifact.title,
      status: artifact.status as ArtifactStatus,
      content: artifact.content,
      agentRunId: artifact.source?.agentRunId,
      checkpointId: artifact.source?.checkpointId,
    };
  }

  /**
   * Convert a PersistedArtifact to a UI Artifact
   */
  toUIArtifact(persisted: PersistedArtifact): Artifact {
    return {
      id: persisted.id,
      type: persisted.type,
      title: persisted.title,
      status: persisted.status,
      createdAt: new Date(persisted.createdAt).getTime(),
      updatedAt: new Date(persisted.updatedAt).getTime(),
      content: persisted.content,
      source: persisted.agentRunId ? {
        agentRunId: persisted.agentRunId,
        checkpointId: persisted.checkpointId,
      } : undefined,
    };
  }
}

// Export singleton instance
export const artifactsService = new ArtifactsService();

// Export class for custom instances
export { ArtifactsService };
