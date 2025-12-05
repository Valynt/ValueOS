/**
 * Repository for interacting with the 'roi_models' table.
 * Encapsulates all database logic for ROI Models.
 */
import { supabase } from '../lib/supabase';
import { ROIModel } from '../types/vos';

export class RoiModelRepository {
  private orgId: string;

  constructor(orgId: string) {
    if (!orgId) {
      throw new Error('Organization ID is required for RoiModelRepository');
    }
    this.orgId = orgId;
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
      .eq('organization_id', this.orgId)
      .single();
  }

  /**
   * Creates a new ROI model for the organization.
   * @param modelData The data for the new model.
   * @returns A Supabase postgrest response with the created model or an error.
   */
  async create(modelData: Omit<ROIModel, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) {
    const dataToInsert = {
      ...modelData,
      organization_id: this.orgId,
    };
    return supabase
      .from('roi_models')
      .insert(dataToInsert)
      .select()
      .single();
  }
}