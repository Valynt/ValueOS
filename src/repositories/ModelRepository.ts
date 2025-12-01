/**
 * Repository for interacting with the 'models' table.
 * Encapsulates all database logic for Value Models.
 */
import { supabase } from '../lib/supabase';
import { Model } from '../types/vos'; // Assuming the type exists here

export class ModelRepository {
  private orgId: string;

  constructor(orgId: string) {
    if (!orgId) {
      throw new Error('Organization ID is required for ModelRepository');
    }
    this.orgId = orgId;
  }

  /**
   * Finds a model by its ID, ensuring it belongs to the correct organization.
   * @param modelId The ID of the model to find.
   * @returns A Supabase postgrest response with the model data or an error.
   */
  async findById(modelId: string) {
    return supabase
      .from('models')
      .select('*')
      .eq('id', modelId)
      .eq('organization_id', this.orgId)
      .single();
  }

  /**
   * Finds all models for the organization.
   * @returns A Supabase postgrest response with an array of models or an error.
   */
  async findAll() {
    return supabase
      .from('models')
      .select('*')
      .eq('organization_id', this.orgId);
  }

  /**
   * Creates a new model for the organization.
   * @param modelData The data for the new model.
   * @returns A Supabase postgrest response with the created model or an error.
   */
  async create(modelData: Omit<Model, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) {
    const dataToInsert = {
      ...modelData,
      organization_id: this.orgId,
    };
    return supabase
      .from('models')
      .insert(dataToInsert)
      .select()
      .single();
  }

  /**
   * Updates an existing model.
   * @param modelId The ID of the model to update.
   * @param updates The partial data to update.
   * @returns A Supabase postgrest response with the updated model or an error.
   */
  async update(modelId: string, updates: Partial<Model>) {
    return supabase
      .from('models')
      .update(updates)
      .eq('id', modelId)
      .eq('organization_id', this.orgId)
      .select()
      .single();
  }
}
