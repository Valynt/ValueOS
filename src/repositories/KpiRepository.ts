/**
 * Repository for interacting with the 'kpis' table.
 * Encapsulates all database logic for KPIs.
 */
import { supabase } from '../lib/supabase';
import { KPITarget } from '../types/vos'; // Assuming this is the correct type

export class KpiRepository {
  private orgId: string;

  constructor(orgId: string) {
    if (!orgId) {
      throw new Error('Organization ID is required for KpiRepository');
    }
    this.orgId = orgId;
  }

  /**
   * Finds all KPIs associated with a specific model.
   * @param modelId The ID of the model.
   * @returns A Supabase postgrest response with an array of KPIs or an error.
   */
  async findByModelId(modelId: string) {
    return supabase
      .from('kpis')
      .select('*')
      .eq('model_id', modelId)
      .eq('organization_id', this.orgId);
  }

  /**
   * Creates a new KPI.
   * @param kpiData The data for the new KPI.
   * @returns A Supabase postgrest response with the created KPI or an error.
   */
  async create(kpiData: Omit<KPITarget, 'id' | 'organization_id' | 'created_at'>) {
    const dataToInsert = {
      ...kpiData,
      organization_id: this.orgId,
    };
    return supabase
      .from('kpis')
      .insert(dataToInsert)
      .select()
      .single();
  }
}
