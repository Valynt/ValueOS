/**
 * Repository for 'value_tree_nodes' table.
 */
import { supabase } from '../lib/supabase';
import { ValueTreeNode } from '../types/vos';

export class ValueTreeNodeRepository {
  private tenantId: string;

  constructor(tenantId: string) {
    if (!tenantId) {
      throw new Error('Tenant ID is required for ValueTreeNodeRepository');
    }
    this.tenantId = tenantId;
  }

  async create(nodeData: Omit<ValueTreeNode, 'id' | 'created_at' | 'tenant_id'>) {
     const dataToInsert = {
      ...nodeData,
      tenant_id: this.tenantId,
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
      .eq('tenant_id', this.tenantId)
      .maybeSingle();
  }
}
