/**
 * Value Drivers Repository
 * 
 * Data access layer for value drivers with Supabase/Postgres.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  ValueDriver, 
  CreateValueDriverRequest, 
  UpdateValueDriverRequest,
  ListValueDriversQuery,
  PaginatedResponse,
  DriverType,
  DriverStatus,
} from './types';
import { logger } from '../../lib/logger';

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

export class ValueDriversRepository {
  private supabase: SupabaseClient;
  private tableName = 'value_drivers';

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create a new value driver
   */
  async create(
    tenantId: string,
    userId: string,
    data: CreateValueDriverRequest
  ): Promise<ValueDriver> {
    const correlationId = `vd-create-${Date.now()}`;
    
    try {
      const now = new Date().toISOString();
      const driverData = {
        tenant_id: tenantId,
        name: data.name,
        description: data.description || null,
        type: data.type,
        persona_tags: data.personaTags,
        sales_motion_tags: data.salesMotionTags,
        formula: data.formula,
        narrative_pitch: data.narrativePitch,
        status: data.status || 'draft',
        version: 1,
        usage_count: 0,
        created_by: userId,
        created_at: now,
        updated_at: now,
      };

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(driverData)
        .select()
        .single();

      if (error) {
        logger.error('Failed to create value driver', {
          correlationId,
          tenantId,
          error: error.message,
          code: error.code,
        });

        if (error.code === '23505') {
          throw new ConflictError('A driver with this name already exists');
        }
        throw new DatabaseError('Failed to create value driver', error);
      }

      logger.info('Value driver created', {
        correlationId,
        tenantId,
        driverId: result.id,
      });

      return this.mapToEntity(result);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error creating value driver', {
        correlationId,
        tenantId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error creating value driver', err as Error);
    }
  }

  /**
   * Get a value driver by ID
   */
  async getById(tenantId: string, driverId: string): Promise<ValueDriver> {
    const correlationId = `vd-get-${driverId}`;

    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select()
        .eq('id', driverId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('ValueDriver', driverId);
        }
        logger.error('Failed to get value driver', {
          correlationId,
          tenantId,
          driverId,
          error: error.message,
        });
        throw new DatabaseError('Failed to get value driver', error);
      }

      return this.mapToEntity(data);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error getting value driver', {
        correlationId,
        tenantId,
        driverId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error getting value driver', err as Error);
    }
  }

  /**
   * Update a value driver
   */
  async update(
    tenantId: string,
    driverId: string,
    data: UpdateValueDriverRequest
  ): Promise<ValueDriver> {
    const correlationId = `vd-update-${driverId}`;

    try {
      // First check if driver exists and get current version
      const existing = await this.getById(tenantId, driverId);

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        version: existing.version + 1,
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.personaTags !== undefined) updateData.persona_tags = data.personaTags;
      if (data.salesMotionTags !== undefined) updateData.sales_motion_tags = data.salesMotionTags;
      if (data.formula !== undefined) updateData.formula = data.formula;
      if (data.narrativePitch !== undefined) updateData.narrative_pitch = data.narrativePitch;
      if (data.status !== undefined) updateData.status = data.status;

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq('id', driverId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update value driver', {
          correlationId,
          tenantId,
          driverId,
          error: error.message,
        });
        throw new DatabaseError('Failed to update value driver', error);
      }

      logger.info('Value driver updated', {
        correlationId,
        tenantId,
        driverId,
        fields: Object.keys(data),
        newVersion: result.version,
      });

      return this.mapToEntity(result);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error updating value driver', {
        correlationId,
        tenantId,
        driverId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error updating value driver', err as Error);
    }
  }

  /**
   * Delete a value driver
   */
  async delete(tenantId: string, driverId: string): Promise<void> {
    const correlationId = `vd-delete-${driverId}`;

    try {
      // First check if driver exists
      await this.getById(tenantId, driverId);

      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', driverId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete value driver', {
          correlationId,
          tenantId,
          driverId,
          error: error.message,
        });
        throw new DatabaseError('Failed to delete value driver', error);
      }

      logger.info('Value driver deleted', {
        correlationId,
        tenantId,
        driverId,
      });
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      
      logger.error('Unexpected error deleting value driver', {
        correlationId,
        tenantId,
        driverId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error deleting value driver', err as Error);
    }
  }

  /**
   * List value drivers with pagination and filtering
   */
  async list(
    tenantId: string,
    query: ListValueDriversQuery
  ): Promise<PaginatedResponse<ValueDriver>> {
    const correlationId = `vd-list-${Date.now()}`;
    const { type, status, persona, salesMotion, search, sortBy, sortOrder, page, limit } = query;

    try {
      let queryBuilder = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId);

      // Apply filters
      if (type) {
        queryBuilder = queryBuilder.eq('type', type);
      }

      if (status) {
        queryBuilder = queryBuilder.eq('status', status);
      }

      if (persona) {
        queryBuilder = queryBuilder.contains('persona_tags', [persona]);
      }

      if (salesMotion) {
        queryBuilder = queryBuilder.contains('sales_motion_tags', [salesMotion]);
      }

      if (search) {
        queryBuilder = queryBuilder.or(
          `name.ilike.%${search}%,description.ilike.%${search}%,narrative_pitch.ilike.%${search}%`
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
        logger.error('Failed to list value drivers', {
          correlationId,
          tenantId,
          error: error.message,
        });
        throw new DatabaseError('Failed to list value drivers', error);
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
      
      logger.error('Unexpected error listing value drivers', {
        correlationId,
        tenantId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new DatabaseError('Unexpected error listing value drivers', err as Error);
    }
  }

  /**
   * Increment usage count for a driver
   */
  async incrementUsage(tenantId: string, driverId: string): Promise<void> {
    const correlationId = `vd-usage-${driverId}`;

    try {
      const { error } = await this.supabase.rpc('increment_driver_usage', {
        p_tenant_id: tenantId,
        p_driver_id: driverId,
      });

      if (error) {
        // Non-critical - log but don't throw
        logger.warn('Failed to increment driver usage', {
          correlationId,
          tenantId,
          driverId,
          error: error.message,
        });
      }
    } catch (err) {
      logger.warn('Unexpected error incrementing driver usage', {
        correlationId,
        tenantId,
        driverId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  /**
   * Map database row to entity
   */
  private mapToEntity(row: Record<string, unknown>): ValueDriver {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      type: row.type as DriverType,
      personaTags: row.persona_tags as string[],
      salesMotionTags: row.sales_motion_tags as string[],
      formula: row.formula as ValueDriver['formula'],
      narrativePitch: row.narrative_pitch as string,
      status: row.status as DriverStatus,
      version: row.version as number,
      usageCount: row.usage_count as number,
      winRateCorrelation: row.win_rate_correlation as number | undefined,
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
      usage_count: 'usage_count',
    };
    return mapping[sortBy] || 'updated_at';
  }
}

// Singleton instance
let repository: ValueDriversRepository | null = null;

export function getValueDriversRepository(): ValueDriversRepository {
  if (!repository) {
    repository = new ValueDriversRepository();
  }
  return repository;
}
