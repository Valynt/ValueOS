/**
 * Repository for 'value_tree_links' table.
 */
import { supabase } from '../lib/supabase';
import { ValueTreeLink } from '../types/vos';

export class ValueTreeLinkRepository {
  private orgId: string;

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  async create(linkData: Omit<ValueTreeLink, 'id' | 'created_at' | 'organization_id'>) {
    const dataToInsert = {
      ...linkData,
      organization_id: this.orgId,
    };
    return supabase
      .from('value_tree_links')
      .insert(dataToInsert)
      .select()
      .single();
  }
}
