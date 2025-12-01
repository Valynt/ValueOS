/**
 * Repository for 'value_commits' table.
 */
import { supabase } from '../lib/supabase';
import { ValueCommit } from '../types/vos';

export class ValueCommitRepository {
  private orgId: string;

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  async create(commitData: Omit<ValueCommit, 'id' | 'created_at' | 'organization_id'>) {
    const dataToInsert = {
      ...commitData,
      organization_id: this.orgId,
    };
    return supabase
      .from('value_commits')
      .insert(dataToInsert)
      .select()
      .single();
  }
}
