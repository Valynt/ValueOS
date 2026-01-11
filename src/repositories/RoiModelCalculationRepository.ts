/**
 * Repository for 'roi_model_calculations' table.
 */
import { supabase } from '../lib/supabase';
import { ROIModelCalculation } from '../types/vos';

export class RoiModelCalculationRepository {
  private tenantId: string;

  constructor(tenantId: string) {
    if (!tenantId) {
      throw new Error('Tenant ID is required for RoiModelCalculationRepository');
    }
    this.tenantId = tenantId;
  }

  async create(calcData: Omit<ROIModelCalculation, 'id' | 'created_at' | 'tenant_id'>) {
    const dataToInsert = {
      ...calcData,
      tenant_id: this.tenantId,
    };
    return supabase
      .from('roi_model_calculations')
      .insert(dataToInsert)
      .select()
      .single();
  }
}
