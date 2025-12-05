/**
 * Repository for 'value_trees' table.
 */
import { supabase } from '../lib/supabase';
import { ValueTree } from '../types/vos';

export class ValueTreeRepository {
  private orgId: string;

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  async create(treeData: Omit<ValueTree, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) {
    const dataToInsert = {
      ...treeData,
      organization_id: this.orgId,
    };
    return supabase
      .from('value_trees')
      .insert(dataToInsert)
      .select()
      .single();
  }
}
