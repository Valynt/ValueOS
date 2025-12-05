/**
 * Repository for 'roi_model_calculations' table.
 */
import { supabase } from '../lib/supabase';
import { ROIModelCalculation } from '../types/vos';

export class RoiModelCalculationRepository {
  private orgId: string;

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  async create(calcData: Omit<ROIModelCalculation, 'id' | 'created_at' | 'organization_id'>) {
    const dataToInsert = {
      ...calcData,
      organization_id: this.orgId,
    };
    return supabase
      .from('roi_model_calculations')
      .insert(dataToInsert)
      .select()
      .single();
  }
}
