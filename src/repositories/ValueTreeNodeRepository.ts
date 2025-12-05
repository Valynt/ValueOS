/**
 * Repository for 'value_tree_nodes' table.
 */
import { supabase } from '../lib/supabase';
import { ValueTreeNode } from '../types/vos';

export class ValueTreeNodeRepository {
  private orgId: string;

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  async create(nodeData: Omit<ValueTreeNode, 'id' | 'created_at' | 'organization_id'>) {
     const dataToInsert = {
      ...nodeData,
      organization_id: this.orgId,
    };
    return supabase
      .from('value_tree_nodes')
      .insert(dataToInsert)
      .select()
      .single();
  }

  async findByNodeId(valueTreeId: string, nodeId: string) {
    return supabase
      .from('value_tree_nodes')
      .select('id')
      .eq('value_tree_id', valueTreeId)
      .eq('node_id', nodeId)
      .eq('organization_id', this.orgId)
      .maybeSingle();
  }
}
