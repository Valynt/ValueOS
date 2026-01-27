import { SupabaseClient } from '@supabase/supabase-js';

export class TenantScopedError extends Error {
  constructor(message: string, public readonly tenantId: string) {
    super(message);
    this.name = 'TenantScopedError';
  }
}

export abstract class BaseTenantService<T extends { tenant_id: string }> {
  constructor(
    protected readonly supabase: SupabaseClient,
    protected readonly tableName: string
  ) {}

  protected scopedQuery(tenantId: string) {
    // ALWAYS applies tenant filter - no exceptions
    return this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId);
  }

  async getById(tenantId: string, id: string): Promise<T | null> {
    const { data, error } = await this.scopedQuery(tenantId)
      .eq('id', id)
      .single();

    if (error) throw new TenantScopedError(error.message, tenantId);
    return data;
  }

  async list(tenantId: string, filters?: Record<string, any>): Promise<T[]> {
    let query = this.scopedQuery(tenantId);

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    const { data, error } = await query;
    if (error) throw new TenantScopedError(error.message, tenantId);
    return data || [];
  }

  async create(tenantId: string, data: Omit<T, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<T> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert({ ...data, tenant_id: tenantId })
      .select()
      .single();

    if (error) throw new TenantScopedError(error.message, tenantId);
    return result;
  }

  async update(tenantId: string, id: string, data: Partial<Omit<T, 'id' | 'tenant_id' | 'created_at'>>): Promise<T> {
    const { data: result, error } = await this.scopedQuery(tenantId)
      .eq('id', id)
      .update(data)
      .select()
      .single();

    if (error) throw new TenantScopedError(error.message, tenantId);
    return result;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const { error } = await this.scopedQuery(tenantId)
      .eq('id', id)
      .delete();

    if (error) throw new TenantScopedError(error.message, tenantId);
  }
}