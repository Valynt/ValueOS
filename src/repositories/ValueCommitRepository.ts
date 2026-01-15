/**
 * Repository for 'value_commits' table.
 */
import { supabase } from '../lib/supabase';
import { ValueCommit } from '../types/vos';

export class ValueCommitRepository {
  private tenantId: string;

  constructor(tenantId: string) {
    if (!tenantId) {
      throw new Error('Tenant ID is required for ValueCommitRepository');
    }
    this.tenantId = tenantId;
  }

  async create(commitData: Omit<ValueCommit, 'id' | 'created_at' | 'tenant_id'>) {
    const dataToInsert = {
      ...commitData,
      tenant_id: this.tenantId,
    };
    return supabase
      .from('value_commits')
      .insert(dataToInsert)
      .select()
      .single();
  }
}
