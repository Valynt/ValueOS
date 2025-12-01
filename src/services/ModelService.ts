/**
 * Service for managing Value Models and their related KPIs.
 * This service encapsulates business logic and uses repositories for data access.
 */
import { ModelRepository } from '../repositories/ModelRepository';
import { KpiRepository } from '../repositories/KpiRepository';
import { LifecycleContext } from '../types/agent';
import { Model } from '../types/vos';

export class ModelService {
  private modelRepo: ModelRepository;
  private kpiRepo: KpiRepository;
  private context: LifecycleContext;

  constructor(context: LifecycleContext) {
    if (!context.organizationId) {
      throw new Error('Organization ID is required to initialize ModelService');
    }
    this.context = context;
    this.modelRepo = new ModelRepository(context.organizationId);
    this.kpiRepo = new KpiRepository(context.organizationId);
  }

  /**
   * Gets a single model and its associated KPIs.
   * @param modelId The ID of the model to retrieve.
   * @returns The model with an array of its KPIs, or null if not found.
   */
  async getModelWithKpis(modelId: string) {
    const modelResult = await this.modelRepo.findById(modelId);
    
    if (modelResult.error) {
      console.error('Error fetching model:', modelResult.error);
      throw modelResult.error;
    }
    if (!modelResult.data) {
      return null;
    }

    const kpisResult = await this.kpiRepo.findByModelId(modelId);

    if (kpisResult.error) {
        console.error('Error fetching KPIs for model:', kpisResult.error);
        // We can decide to throw or just return the model without KPIs
        throw kpisResult.error;
    }

    return {
      ...modelResult.data,
      kpis: kpisResult.data || [],
    };
  }

  /**
   * Creates a new model.
   * @param modelData Data for the new model.
   * @returns The newly created model.
   */
  async createModel(modelData: Omit<Model, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) {
    // Here you could add more business logic, e.g., validation, audit logging, etc.
    const result = await this.modelRepo.create({
      ...modelData,
      created_by_user_id: this.context.userId, // Add user from context
    });

    if (result.error) {
      console.error('Error creating model:', result.error);
      throw result.error;
    }

    // Example of a post-creation action, like sending a notification
    // await this.notificationService.notify('model_created', { modelId: result.data.id });

    return result.data;
  }
  
  /**
   * Lists all models for the organization.
   * @returns An array of models.
   */
  async listModels() {
    const result = await this.modelRepo.findAll();
    if (result.error) {
        console.error('Error listing models:', result.error);
        throw result.error;
    }
    return result.data;
  }
}
