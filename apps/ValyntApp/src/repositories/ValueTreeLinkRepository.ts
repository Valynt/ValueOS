/**
 * Repository for 'value_tree_links' table.
 */
import { supabase } from '../lib/supabase';
import { ValueTreeLink } from '../types/vos';

export class ValueTreeLinkRepository {
  private tenantId: string;

  constructor(tenantId: string) {
    if (!tenantId) {
      throw new Error('Tenant ID is required for ValueTreeLinkRepository');
    }
    this.tenantId = tenantId;
  }

  async create(linkData: Omit<ValueTreeLink, 'id' | 'created_at' | 'tenant_id'>) {
    const dataToInsert = {
      ...linkData,
      tenant_id: this.tenantId,
    };
    return supabase
      .from('value_tree_links')
      .insert(dataToInsert)
      .select()
      .single();
  }
}
