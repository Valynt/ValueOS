/**
 * Repository for interacting with the 'roi_models' table.
 * Encapsulates all database logic for ROI Models.
 */
import { supabase } from '../lib/supabase';
import { ROIModel } from '../types/vos';

export class RoiModelRepository {
  private tenantId: string;

  constructor(tenantId: string) {
    if (!tenantId) {
      throw new Error('Tenant ID is required for RoiModelRepository');
    }
    this.tenantId = tenantId;
  }

  /**
   * Finds an ROI model by its ID, ensuring it belongs to the correct organization.
   * @param modelId The ID of the model to find.
   * @returns A Supabase postgrest response with the model data or an error.
   */
  async findById(modelId: string) {
    // Note: The table in the DB is 'models', but the code uses 'roi_models'.
    // This repository will use 'roi_models' as per the existing agent code.
    // A migration should be created to align the database schema with the code's expectations.
    return supabase
      .from('roi_models')
      .select('*')
      .eq('id', modelId)
      .eq('tenant_id', this.tenantId)
      .single();
  }

  /**
   * Creates a new ROI model for the organization.
   * @param modelData The data for the new model.
   * @returns A Supabase postgrest response with the created model or an error.
   */
  async create(modelData: Omit<ROIModel, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) {
    const dataToInsert = {
      ...modelData,
      tenant_id: this.tenantId,
    };
    return supabase
      .from('roi_models')
      .insert(dataToInsert)
      .select()
      .single();
  }
}
