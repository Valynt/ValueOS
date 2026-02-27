/**
 * Value Cases Repository
 * 
 * Data access layer for value cases with Supabase/Postgres.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  ValueCase, 
  CreateValueCaseRequest, 
  UpdateValueCaseRequest,
  ListValueCasesQuery,
  PaginatedResponse,
  CaseStatus,
  CasePhase,
} from './types';
import { logger } from '../../lib/logger.js'

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

export class ConflictError extends RepositoryError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

export class DatabaseError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'DATABASE_ERROR', cause);
  }
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class ValueCasesRepository {
  private supabase: SupabaseClient;
  private tableName = 'value_cases';

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create a new value case
   */
  async create(
    tenantId: string,
    userId: string,
    data: CreateValueCaseRequest
  ): Promise<ValueCase> {
    const correlationId = `vc-create-${Date.now()}`;
    
    try {
      const now = new Date().toISOString();
      const caseData = {
        tenant_id: tenantId,
        name: data.name,
        company_name: data.companyName,
        company_id: data.companyId || null,
        description: data.description || null,
        status: 'draft' as CaseStatus,
        phase: 'discovery' as CasePhase,
        domain_pack_id: data.domainPackId || null,
        domain_pack_version: data.domainPackVersion || null,
        domain_pack_snapshot: null, // Snapshot is set by the service layer at attachment time
        stakeholders: data.stakeholders || [],
        metrics: [],
        value_drivers: data.valueDrivers || [],
        template_id: data.templateId || null,
        metadata: data.metadata || {},
        created_by: userId,
        created_at: now,
        updated_at: now,
      };

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(caseData)
        .select()
        .single();

      if (error) {
        logger.error('Failed to create value case', {
          correlationId,
          tenantId,
          error: error.message,
          code: error.code,
        });

        if (error.code === '23505') {
          throw new ConflictError('A case with this name already exists');
        }
        throw new DatabaseError('Failed to create value case', error);
      }

      logger.info('Value case created', {
        correlationId,
        tenantId,
        caseId: result.id,
      });

      return this.mapToEntity(result);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error creating value case', {
        correlationId,
        tenantId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error creating value case', err as Error);
    }
  }

  /**
   * Get a value case by ID
   */
  async getById(tenantId: string, caseId: string): Promise<ValueCase> {
    const correlationId = `vc-get-${caseId}`;

    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select()
        .eq('id', caseId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('ValueCase', caseId);
        }
        logger.error('Failed to get value case', {
          correlationId,
          tenantId,
          caseId,
          error: error.message,
        });
        throw new DatabaseError('Failed to get value case', error);
      }

      return this.mapToEntity(data);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error getting value case', {
        correlationId,
        tenantId,
        caseId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error getting value case', err as Error);
    }
  }

  /**
   * Update a value case
   */
  async update(
    tenantId: string,
    caseId: string,
    data: UpdateValueCaseRequest
  ): Promise<ValueCase> {
    const correlationId = `vc-update-${caseId}`;

    try {
      // First check if case exists
      await this.getById(tenantId, caseId);

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.phase !== undefined) updateData.phase = data.phase;
      if (data.domainPackId !== undefined) updateData.domain_pack_id = data.domainPackId;
      if (data.domainPackVersion !== undefined) updateData.domain_pack_version = data.domainPackVersion;
      if (data.stakeholders !== undefined) updateData.stakeholders = data.stakeholders;
      if (data.metrics !== undefined) updateData.metrics = data.metrics;
      if (data.valueDrivers !== undefined) updateData.value_drivers = data.valueDrivers;
      if (data.totalValue !== undefined) updateData.total_value = data.totalValue;
      if (data.npv !== undefined) updateData.npv = data.npv;
      if (data.paybackMonths !== undefined) updateData.payback_months = data.paybackMonths;
      if (data.metadata !== undefined) updateData.metadata = data.metadata;

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq('id', caseId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update value case', {
          correlationId,
          tenantId,
          caseId,
          error: error.message,
        });
        throw new DatabaseError('Failed to update value case', error);
      }

      logger.info('Value case updated', {
        correlationId,
        tenantId,
        caseId,
        fields: Object.keys(data),
      });

      return this.mapToEntity(result);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error updating value case', {
        correlationId,
        tenantId,
        caseId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error updating value case', err as Error);
    }
  }

  /**
   * Delete a value case
   */
  async delete(tenantId: string, caseId: string): Promise<void> {
    const correlationId = `vc-delete-${caseId}`;

    try {
      // First check if case exists
      await this.getById(tenantId, caseId);

      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', caseId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete value case', {
          correlationId,
          tenantId,
          caseId,
          error: error.message,
        });
        throw new DatabaseError('Failed to delete value case', error);
      }

      logger.info('Value case deleted', {
        correlationId,
        tenantId,
        caseId,
      });
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error deleting value case', {
        correlationId,
        tenantId,
        caseId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error deleting value case', err as Error);
    }
  }

  /**
   * List value cases with pagination and filtering
   */
  async list(
    tenantId: string,
    query: ListValueCasesQuery
  ): Promise<PaginatedResponse<ValueCase>> {
    const correlationId = `vc-list-${Date.now()}`;
    const { status, search, sortBy, sortOrder, page, limit } = query;

    try {
      let queryBuilder = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId);

      // Apply filters
      if (status) {
        queryBuilder = queryBuilder.eq('status', status);
      }

      if (search) {
        queryBuilder = queryBuilder.or(
          `name.ilike.%${search}%,company_name.ilike.%${search}%`
        );
      }

      // Apply sorting
      const sortColumn = this.mapSortColumn(sortBy);
      queryBuilder = queryBuilder.order(sortColumn, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const offset = (page - 1) * limit;
      queryBuilder = queryBuilder.range(offset, offset + limit - 1);

      const { data, error, count } = await queryBuilder;

      if (error) {
        logger.error('Failed to list value cases', {
          correlationId,
          tenantId,
          error: error.message,
        });
        throw new DatabaseError('Failed to list value cases', error);
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
      
      logger.error('Unexpected error listing value cases', {
        correlationId,
        tenantId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error listing value cases', err as Error);
    }
  }

  /**
   * Map database row to entity
   */
  private mapToEntity(row: Record<string, unknown>): ValueCase {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      companyName: row.company_name as string,
      companyId: row.company_id as string | undefined,
      description: row.description as string | undefined,
      status: row.status as CaseStatus,
      phase: row.phase as CasePhase,
      domainPackId: (row.domain_pack_id as string) ?? null,
      domainPackVersion: (row.domain_pack_version as string) ?? null,
      domainPackSnapshot: (row.domain_pack_snapshot as Record<string, unknown>) ?? null,
      stakeholders: (row.stakeholders as unknown[]) || [],
      metrics: (row.metrics as unknown[]) || [],
      valueDrivers: (row.value_drivers as unknown[]) || [],
      totalValue: row.total_value as number | undefined,
      npv: row.npv as number | undefined,
      paybackMonths: row.payback_months as number | undefined,
      templateId: row.template_id as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdBy: row.created_by as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Map sort field to database column
   */
  private mapSortColumn(sortBy: string): string {
    const mapping: Record<string, string> = {
      created_at: 'created_at',
      updated_at: 'updated_at',
      name: 'name',
      total_value: 'total_value',
    };
    return mapping[sortBy] || 'updated_at';
  }
}

// Singleton instance
let repository: ValueCasesRepository | null = null;

export function getValueCasesRepository(): ValueCasesRepository {
  if (!repository) {
    repository = new ValueCasesRepository();
  }
  return repository;
}
