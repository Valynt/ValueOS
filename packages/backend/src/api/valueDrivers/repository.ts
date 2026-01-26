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
import {
  CreateValueDriverDbSchema,
  ListValueDriversQueryDbSchema,
  UpdateValueDriverDbSchema,
  mapDriverStatusToDb,
  mapDriverTypeToDb,
} from './dbValidation';
import {
  DbConflictError,
  DbNotFoundError,
  TransientDbError,
} from '../../lib/db/errors';
import { logDbError, logDbInfo, logDbWarn } from '../../lib/db/logging.js'
import { parseDbInput } from '../../lib/db/validation.js'

const TRANSIENT_DB_CODES = new Set([
  '08001',
  '08006',
  '53300',
  '57P01',
  '57014',
  '55006',
]);

function isTransientDbError(code?: string | null): boolean {
  return Boolean(code && TRANSIENT_DB_CODES.has(code));
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
      const sanitized = parseDbInput(
        CreateValueDriverDbSchema,
        data,
        'value driver create payload'
      );
      const now = new Date().toISOString();
      const driverData = {
        tenant_id: tenantId,
        name: sanitized.name,
        description: sanitized.description || null,
        type: mapDriverTypeToDb(sanitized.type),
        persona_tags: sanitized.personaTags,
        sales_motion_tags: sanitized.salesMotionTags,
        formula: sanitized.formula,
        narrative_pitch: sanitized.narrativePitch,
        status: mapDriverStatusToDb(sanitized.status),
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
        logDbError(
          'Failed to create value driver',
          {
            correlationId,
            tenantId,
            operation: 'create',
            table: this.tableName,
            errorCode: error.code,
          },
          error
        );

        if (error.code === '23505') {
          throw new DbConflictError('A driver with this name already exists');
        }
        if (isTransientDbError(error.code)) {
          throw new TransientDbError('Database temporarily unavailable', {
            operation: 'create',
          });
        }
        throw error;
      }

      logDbInfo('Value driver created', {
        correlationId,
        tenantId,
        operation: 'create',
        table: this.tableName,
        recordId: result.id,
      });

      return this.mapToEntity(result);
    } catch (err) {
      if (err instanceof Error) {
        logDbError('Unexpected error creating value driver', {
          correlationId,
          tenantId,
          operation: 'create',
          table: this.tableName,
        }, err);
      }
      throw err;
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
          throw new DbNotFoundError('ValueDriver', driverId);
        }
        logDbError(
          'Failed to get value driver',
          {
            correlationId,
            tenantId,
            operation: 'getById',
            table: this.tableName,
            recordId: driverId,
            errorCode: error.code,
          },
          error
        );
        if (isTransientDbError(error.code)) {
          throw new TransientDbError('Database temporarily unavailable', {
            operation: 'getById',
          });
        }
        throw error;
      }

      return this.mapToEntity(data);
    } catch (err) {
      if (err instanceof Error) {
        logDbError('Unexpected error getting value driver', {
          correlationId,
          tenantId,
          operation: 'getById',
          table: this.tableName,
          recordId: driverId,
        }, err);
      }
      throw err;
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
      const sanitized = parseDbInput(
        UpdateValueDriverDbSchema,
        data,
        'value driver update payload'
      );
      // First check if driver exists and get current version
      const existing = await this.getById(tenantId, driverId);

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        version: existing.version + 1,
      };

      if (sanitized.name !== undefined) updateData.name = sanitized.name;
      if (sanitized.description !== undefined) updateData.description = sanitized.description;
      if (sanitized.type !== undefined) updateData.type = mapDriverTypeToDb(sanitized.type);
      if (sanitized.personaTags !== undefined) updateData.persona_tags = sanitized.personaTags;
      if (sanitized.salesMotionTags !== undefined) updateData.sales_motion_tags = sanitized.salesMotionTags;
      if (sanitized.formula !== undefined) updateData.formula = sanitized.formula;
      if (sanitized.narrativePitch !== undefined) updateData.narrative_pitch = sanitized.narrativePitch;
      if (sanitized.status !== undefined) updateData.status = mapDriverStatusToDb(sanitized.status);

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq('id', driverId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        logDbError(
          'Failed to update value driver',
          {
            correlationId,
            tenantId,
            operation: 'update',
            table: this.tableName,
            recordId: driverId,
            errorCode: error.code,
          },
          error
        );
        if (isTransientDbError(error.code)) {
          throw new TransientDbError('Database temporarily unavailable', {
            operation: 'update',
          });
        }
        throw error;
      }

      logDbInfo('Value driver updated', {
        correlationId,
        tenantId,
        operation: 'update',
        table: this.tableName,
        recordId: driverId,
      });

      return this.mapToEntity(result);
    } catch (err) {
      if (err instanceof Error) {
        logDbError('Unexpected error updating value driver', {
          correlationId,
          tenantId,
          operation: 'update',
          table: this.tableName,
          recordId: driverId,
        }, err);
      }
      throw err;
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
        logDbError(
          'Failed to delete value driver',
          {
            correlationId,
            tenantId,
            operation: 'delete',
            table: this.tableName,
            recordId: driverId,
            errorCode: error.code,
          },
          error
        );
        if (isTransientDbError(error.code)) {
          throw new TransientDbError('Database temporarily unavailable', {
            operation: 'delete',
          });
        }
        throw error;
      }

      logDbInfo('Value driver deleted', {
        correlationId,
        tenantId,
        operation: 'delete',
        table: this.tableName,
        recordId: driverId,
      });
    } catch (err) {
      if (err instanceof Error) {
        logDbError('Unexpected error deleting value driver', {
          correlationId,
          tenantId,
          operation: 'delete',
          table: this.tableName,
          recordId: driverId,
        }, err);
      }
      throw err;
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
    const sanitized = parseDbInput(
      ListValueDriversQueryDbSchema,
      query,
      'value driver query'
    );
    const { type, status, persona, salesMotion, search, sortBy, sortOrder, page, limit } = sanitized;

    try {
      let queryBuilder = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId);

      // Apply filters
      if (type) {
        queryBuilder = queryBuilder.eq('type', mapDriverTypeToDb(type));
      }

      if (status) {
        queryBuilder = queryBuilder.eq('status', mapDriverStatusToDb(status));
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
        logDbError(
          'Failed to list value drivers',
          {
            correlationId,
            tenantId,
            operation: 'list',
            table: this.tableName,
            errorCode: error.code,
          },
          error
        );
        if (isTransientDbError(error.code)) {
          throw new TransientDbError('Database temporarily unavailable', {
            operation: 'list',
          });
        }
        throw error;
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
      if (err instanceof Error) {
        logDbError('Unexpected error listing value drivers', {
          correlationId,
          tenantId,
          operation: 'list',
          table: this.tableName,
        }, err);
      }
      throw err;
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
        logDbWarn('Failed to increment driver usage', {
          correlationId,
          tenantId,
          operation: 'incrementUsage',
          table: this.tableName,
          recordId: driverId,
          errorCode: error.code,
        });
      }
    } catch (err) {
      if (err instanceof Error) {
        logDbWarn('Unexpected error incrementing driver usage', {
          correlationId,
          tenantId,
          operation: 'incrementUsage',
          table: this.tableName,
          recordId: driverId,
        });
      }
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
