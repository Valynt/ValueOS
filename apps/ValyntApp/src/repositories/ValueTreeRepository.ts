/**
 * Repository for 'value_trees' table.
 */
import { supabase } from '../lib/supabase';
import { ValueTree } from '../types/vos';

export class ValueTreeRepository {
  private tenantId: string;

  constructor(tenantId: string) {
    if (!tenantId) {
      throw new Error('Tenant ID is required for ValueTreeRepository');
    }
    this.tenantId = tenantId;
  }

  async create(treeData: Omit<ValueTree, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>) {
    const dataToInsert = {
      ...treeData,
      tenant_id: this.tenantId,
    };
    return supabase
      .from('value_trees')
      .insert(dataToInsert)
      .select()
      .single();
  }
}
