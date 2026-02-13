/**
 * Artifacts Repository
 * 
 * Data access layer for artifacts with Supabase/Postgres.
 * Uses memory_artifacts table with tenant isolation via RLS.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  Artifact, 
  CreateArtifactRequest, 
  UpdateArtifactRequest,
  ListArtifactsQuery,
  PaginatedResponse,
  ArtifactType,
  ArtifactStatus,
  ArtifactContent,
} from './types';
import { logger } from "../../lib/logger.js";
// Simple logger
const logger = {
  info: (msg: string, data?: Record<string, unknown>) => logger.info(`[INFO] ${msg}`, JSON.stringify(data || {})),
  error: (msg: string, data?: Record<string, unknown>) => console.error(`[ERROR] ${msg}`, JSON.stringify(data || {})),
  warn: (msg: string, data?: Record<string, unknown>) => console.warn(`[WARN] ${msg}`, JSON.stringify(data || {})),
};

// ============================================================================
// Repository Errors
// ============================================================================

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class NotFoundError extends RepositoryError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND');
  }
}

export class ValidationError extends RepositoryError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class DatabaseError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'DATABASE_ERROR', cause);
  }
}

// ============================================================================
// Database Row Type
// ============================================================================

interface ArtifactRow {
  id: string;
  tenant_id: string;
  value_case_id: string | null;
  source_url: string | null;
  title: string;
  content_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class ArtifactsRepository {
  private supabase: SupabaseClient;
  private tableName = 'memory_artifacts';

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create a new artifact
   */
  async create(
    tenantId: string,
    data: CreateArtifactRequest
  ): Promise<Artifact> {
    const correlationId = `artifact-create-${Date.now()}`;
    
    try {
      const now = new Date().toISOString();
      
      // Store artifact type, status, content, and agent source in metadata
      const metadata: Record<string, unknown> = {
        ...data.metadata,
        artifact_type: data.type,
        artifact_status: data.status,
        content: data.content,
        agent_run_id: data.agentRunId,
        checkpoint_id: data.checkpointId,
      };

      const artifactData = {
        tenant_id: tenantId,
        value_case_id: data.valueCaseId || null,
        source_url: data.sourceUrl || null,
        title: data.title,
        content_type: data.content.kind,
        metadata,
        created_at: now,
        updated_at: now,
      };

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(artifactData)
        .select()
        .single();

      if (error) {
        logger.error('Failed to create artifact', {
          correlationId,
          tenantId,
          error: error.message,
          code: error.code,
        });
        throw new DatabaseError('Failed to create artifact', error);
      }

      logger.info('Artifact created', {
        correlationId,
        tenantId,
        artifactId: result.id,
        type: data.type,
      });

      return this.mapToEntity(result);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error creating artifact', {
        correlationId,
        tenantId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error creating artifact', err as Error);
    }
  }

  /**
   * Create multiple artifacts in a single transaction
   */
  async createBatch(
    tenantId: string,
    valueCaseId: string | undefined,
    artifacts: Omit<CreateArtifactRequest, 'valueCaseId'>[]
  ): Promise<Artifact[]> {
    const correlationId = `artifact-batch-${Date.now()}`;
    
    try {
      const now = new Date().toISOString();
      
      const artifactRows = artifacts.map(data => {
        const metadata: Record<string, unknown> = {
          ...data.metadata,
          artifact_type: data.type,
          artifact_status: data.status,
          content: data.content,
          agent_run_id: data.agentRunId,
          checkpoint_id: data.checkpointId,
        };

        return {
          tenant_id: tenantId,
          value_case_id: valueCaseId || null,
          source_url: data.sourceUrl || null,
          title: data.title,
          content_type: data.content.kind,
          metadata,
          created_at: now,
          updated_at: now,
        };
      });

      const { data: results, error } = await this.supabase
        .from(this.tableName)
        .insert(artifactRows)
        .select();

      if (error) {
        logger.error('Failed to create artifacts batch', {
          correlationId,
          tenantId,
          count: artifacts.length,
          error: error.message,
          code: error.code,
        });
        throw new DatabaseError('Failed to create artifacts batch', error);
      }

      logger.info('Artifacts batch created', {
        correlationId,
        tenantId,
        count: results?.length || 0,
        valueCaseId,
      });

      return (results || []).map(this.mapToEntity);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error creating artifacts batch', {
        correlationId,
        tenantId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error creating artifacts batch', err as Error);
    }
  }

  /**
   * Get an artifact by ID
   */
  async getById(tenantId: string, artifactId: string): Promise<Artifact> {
    const correlationId = `artifact-get-${artifactId}`;

    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select()
        .eq('id', artifactId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('Artifact', artifactId);
        }
        logger.error('Failed to get artifact', {
          correlationId,
          tenantId,
          artifactId,
          error: error.message,
        });
        throw new DatabaseError('Failed to get artifact', error);
      }

      return this.mapToEntity(data);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error getting artifact', {
        correlationId,
        tenantId,
        artifactId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error getting artifact', err as Error);
    }
  }

  /**
   * Update an artifact
   */
  async update(
    tenantId: string,
    artifactId: string,
    data: UpdateArtifactRequest
  ): Promise<Artifact> {
    const correlationId = `artifact-update-${artifactId}`;

    try {
      // First get existing artifact to merge metadata
      const existing = await this.getById(tenantId, artifactId);

      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        updated_at: now,
      };

      // Build updated metadata
      const metadata: Record<string, unknown> = {
        ...(existing.metadata || {}),
      };

      if (data.title !== undefined) {
        updateData.title = data.title;
      }

      if (data.status !== undefined) {
        metadata.artifact_status = data.status;
      }

      if (data.content !== undefined) {
        metadata.content = data.content;
        updateData.content_type = data.content.kind;
      }

      if (data.metadata !== undefined) {
        Object.assign(metadata, data.metadata);
      }

      updateData.metadata = metadata;

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq('id', artifactId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update artifact', {
          correlationId,
          tenantId,
          artifactId,
          error: error.message,
        });
        throw new DatabaseError('Failed to update artifact', error);
      }

      logger.info('Artifact updated', {
        correlationId,
        tenantId,
        artifactId,
        fields: Object.keys(data),
      });

      return this.mapToEntity(result);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error updating artifact', {
        correlationId,
        tenantId,
        artifactId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error updating artifact', err as Error);
    }
  }

  /**
   * Delete an artifact
   */
  async delete(tenantId: string, artifactId: string): Promise<void> {
    const correlationId = `artifact-delete-${artifactId}`;

    try {
      // First check if artifact exists
      await this.getById(tenantId, artifactId);

      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', artifactId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete artifact', {
          correlationId,
          tenantId,
          artifactId,
          error: error.message,
        });
        throw new DatabaseError('Failed to delete artifact', error);
      }

      logger.info('Artifact deleted', {
        correlationId,
        tenantId,
        artifactId,
      });
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error deleting artifact', {
        correlationId,
        tenantId,
        artifactId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error deleting artifact', err as Error);
    }
  }

  /**
   * List artifacts with pagination and filtering
   */
  async list(
    tenantId: string,
    query: ListArtifactsQuery
  ): Promise<PaginatedResponse<Artifact>> {
    const correlationId = `artifact-list-${Date.now()}`;
    const { valueCaseId, type, status, search, sortBy, sortOrder, page, limit } = query;

    try {
      let queryBuilder = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId);

      // Apply filters
      if (valueCaseId) {
        queryBuilder = queryBuilder.eq('value_case_id', valueCaseId);
      }

      if (type) {
        queryBuilder = queryBuilder.eq('metadata->>artifact_type', type);
      }

      if (status) {
        queryBuilder = queryBuilder.eq('metadata->>artifact_status', status);
      }

      if (search) {
        queryBuilder = queryBuilder.ilike('title', `%${search}%`);
      }

      // Apply sorting
      const sortColumn = sortBy === 'title' ? 'title' : sortBy;
      queryBuilder = queryBuilder.order(sortColumn, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const offset = (page - 1) * limit;
      queryBuilder = queryBuilder.range(offset, offset + limit - 1);

      const { data, error, count } = await queryBuilder;

      if (error) {
        logger.error('Failed to list artifacts', {
          correlationId,
          tenantId,
          error: error.message,
        });
        throw new DatabaseError('Failed to list artifacts', error);
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: (data || []).map(this.mapToEntity),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      };
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error listing artifacts', {
        correlationId,
        tenantId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error listing artifacts', err as Error);
    }
  }

  /**
   * Get artifacts by value case ID
   */
  async getByValueCase(tenantId: string, valueCaseId: string): Promise<Artifact[]> {
    const correlationId = `artifact-by-case-${valueCaseId}`;

    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select()
        .eq('tenant_id', tenantId)
        .eq('value_case_id', valueCaseId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to get artifacts by value case', {
          correlationId,
          tenantId,
          valueCaseId,
          error: error.message,
        });
        throw new DatabaseError('Failed to get artifacts by value case', error);
      }

      return (data || []).map(this.mapToEntity);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error getting artifacts by value case', {
        correlationId,
        tenantId,
        valueCaseId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error getting artifacts by value case', err as Error);
    }
  }

  /**
   * Map database row to entity
   */
  private mapToEntity(row: ArtifactRow): Artifact {
    const metadata = row.metadata || {};
    
    return {
      id: row.id,
      tenantId: row.tenant_id,
      valueCaseId: row.value_case_id || undefined,
      type: (metadata.artifact_type as ArtifactType) || 'narrative',
      title: row.title,
      status: (metadata.artifact_status as ArtifactStatus) || 'proposed',
      content: (metadata.content as ArtifactContent) || { kind: 'markdown', markdown: '' },
      sourceUrl: row.source_url || undefined,
      agentRunId: metadata.agent_run_id as string | undefined,
      checkpointId: metadata.checkpoint_id as string | undefined,
      metadata: Object.fromEntries(
        Object.entries(metadata).filter(([key]) => 
          !['artifact_type', 'artifact_status', 'content', 'agent_run_id', 'checkpoint_id'].includes(key)
        )
      ),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Singleton instance
let repository: ArtifactsRepository | null = null;

export function getArtifactsRepository(): ArtifactsRepository {
  if (!repository) {
    repository = new ArtifactsRepository();
  }
  return repository;
}
