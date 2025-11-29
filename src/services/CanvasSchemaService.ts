/**
 * Canvas Schema Service
 * 
 * Server-side service that generates SDUI page definitions based on workspace state.
 * This is the "brain" of the SDUI system that decides what UI to show.
 */

import { logger } from '../lib/logger';
import { SDUIPageDefinition } from '../sdui/schema';
import {
  WorkspaceContext,
  WorkspaceState,
  CanonicalAction,
  ActionResult,
  SchemaCacheEntry,
  TemplateSelectionCriteria,
} from '../types/sdui-integration';
import { LifecycleStage } from '../types/workflow';
import { CacheService } from './CacheService';
import { ValueFabricService } from './ValueFabricService';
import { getSupabaseClient } from '../lib/supabase';
import { generateSOFOpportunityPage } from '../sdui/templates/sof-opportunity-template';
import { generateSOFTargetPage } from '../sdui/templates/sof-target-template';
import { generateSOFExpansionPage } from '../sdui/templates/sof-expansion-template';
import { generateSOFIntegrityPage } from '../sdui/templates/sof-integrity-template';
import { generateSOFRealizationPage } from '../sdui/templates/sof-realization-template';
import { hashObject, shortHash } from '../lib/contentHash';

/**
 * Schema head pointer - points to current schema hash
 */
interface SchemaHead {
  hash: string;
  version: number;
  updatedAt: number;
  workspaceId: string;
}

/**
 * Canvas Schema Service
 */
export class CanvasSchemaService {
  private cacheService: CacheService;
  private valueFabricService: ValueFabricService;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'sdui:schema:';

  constructor(
    cacheService?: CacheService,
    valueFabricService?: ValueFabricService
  ) {
    this.cacheService = cacheService || new CacheService();
    this.valueFabricService = valueFabricService || new ValueFabricService(getSupabaseClient());
  }

  /**
   * Generate SDUI schema for a workspace
   */
  async generateSchema(
    workspaceId: string,
    context: WorkspaceContext
  ): Promise<SDUIPageDefinition> {
    logger.info('Generating SDUI schema', { workspaceId, lifecycleStage: context.lifecycleStage });

    try {
      // Check cache first
      const cached = await this.getCachedSchema(workspaceId);
      if (cached) {
        logger.debug('Returning cached schema', { workspaceId });
        return cached;
      }

      // Detect workspace state
      const workspaceState = await this.detectWorkspaceState(workspaceId, context);

      // Fetch required data from Value Fabric
      const data = await this.fetchWorkspaceData(workspaceState);

      // Select appropriate template
      const template = this.selectTemplate(workspaceState, data);

      // Generate schema using template
      const schema = await this.generateSchemaFromTemplate(template, data, workspaceState);

      // Cache the schema
      await this.cacheSchema(workspaceId, schema);

      logger.info('Generated SDUI schema', {
        workspaceId,
        lifecycleStage: context.lifecycleStage,
        componentCount: schema.sections.length,
      });

      return schema;
    } catch (error) {
      logger.error('Failed to generate SDUI schema', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return fallback schema
      return this.generateFallbackSchema(context.lifecycleStage);
    }
  }

  /**
   * Update schema based on action result
   */
  async updateSchema(
    workspaceId: string,
    action: CanonicalAction,
    result: ActionResult
  ): Promise<SDUIPageDefinition> {
    logger.info('Updating SDUI schema', { workspaceId, actionType: action.type });

    try {
      // If action result includes schema update, use it
      if (result.schemaUpdate) {
        await this.cacheSchema(workspaceId, result.schemaUpdate);
        return result.schemaUpdate;
      }

      // If action result includes atomic actions, apply them
      if (result.atomicActions && result.atomicActions.length > 0) {
        const currentSchema = await this.getCachedSchema(workspaceId);
        if (currentSchema) {
          // Apply atomic actions to current schema
          const updatedSchema = await this.applyAtomicActions(
            currentSchema,
            result.atomicActions
          );
          await this.cacheSchema(workspaceId, updatedSchema);
          return updatedSchema;
        }
      }

      // Otherwise, invalidate cache and regenerate
      await this.invalidateCache(workspaceId);
      
      // Get workspace context from action
      const context = this.extractContextFromAction(action);
      
      return await this.generateSchema(workspaceId, context);
    } catch (error) {
      logger.error('Failed to update SDUI schema', {
        workspaceId,
        actionType: action.type,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return current cached schema or fallback
      const cached = await this.getCachedSchema(workspaceId);
      if (cached) return cached;

      return this.generateFallbackSchema('opportunity');
    }
  }

  /**
   * Get cached schema if available
   */
  async getCachedSchema(workspaceId: string): Promise<SDUIPageDefinition | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${workspaceId}`;
      const cached = await this.cacheService.get<SchemaCacheEntry>(cacheKey);

      if (!cached) return null;

      // Check if cache is still valid
      const now = Date.now();
      if (now - cached.timestamp > cached.ttl * 1000) {
        await this.invalidateCache(workspaceId);
        return null;
      }

      return cached.schema;
    } catch (error) {
      logger.error('Failed to get cached schema', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Invalidate schema cache
   */
  async invalidateCache(workspaceId: string): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${workspaceId}`;
      await this.cacheService.delete(cacheKey);
      logger.debug('Invalidated schema cache', { workspaceId });
    } catch (error) {
      logger.error('Failed to invalidate cache', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Cache schema (legacy TTL-based)
   */
  private async cacheSchema(workspaceId: string, schema: SDUIPageDefinition): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${workspaceId}`;
      const entry: SchemaCacheEntry = {
        schema,
        timestamp: Date.now(),
        ttl: this.CACHE_TTL,
        workspaceId,
        version: schema.version,
      };
      await this.cacheService.set(cacheKey, entry, { ttl: this.CACHE_TTL * 1000 });
      logger.debug('Cached schema', { workspaceId, ttl: this.CACHE_TTL });
    } catch (error) {
      logger.error('Failed to cache schema', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ==========================================================================
  // Content-Addressable Storage (CAS) Methods
  // ==========================================================================

  /**
   * Store schema using CAS (Content-Addressable Storage)
   * Schema is stored by its content hash, making it cacheable forever.
   * A "head" pointer tracks the current version.
   */
  async cacheSchemaWithCAS(workspaceId: string, schema: SDUIPageDefinition): Promise<string> {
    try {
      // Step 1: Calculate content hash
      const { hash, size } = await hashObject(schema);
      
      // Step 2: Store schema by hash (immutable, long TTL)
      await this.cacheService.setCAS(hash, schema, { namespace: 'schema' });
      
      // Step 3: Update head pointer
      await this.cacheService.setHead(workspaceId, hash, { namespace: 'schema' });
      
      logger.debug('Cached schema with CAS', {
        workspaceId,
        hash: shortHash(hash),
        size,
        version: schema.version,
      });
      
      return hash;
    } catch (error) {
      logger.error('Failed to cache schema with CAS', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get schema head pointer (current hash) - always fetched fresh
   * This is the lightweight endpoint that clients call first.
   */
  async getSchemaHead(workspaceId: string): Promise<SchemaHead | null> {
    try {
      const head = await this.cacheService.getHead(workspaceId, { namespace: 'schema' });
      
      if (!head) return null;
      
      return {
        hash: head.hash,
        version: 1, // Could be stored in head if needed
        updatedAt: head.updatedAt,
        workspaceId,
      };
    } catch (error) {
      logger.error('Failed to get schema head', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get schema by its content hash - heavily cached
   * Clients call this after getting the head to fetch actual content.
   */
  async getSchemaByHash(hash: string): Promise<SDUIPageDefinition | null> {
    try {
      const schema = await this.cacheService.getCAS<SDUIPageDefinition>(hash, { namespace: 'schema' });
      
      if (schema) {
        logger.debug('Retrieved schema by hash', { hash: shortHash(hash) });
      }
      
      return schema;
    } catch (error) {
      logger.error('Failed to get schema by hash', {
        hash: shortHash(hash),
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get schema using CAS (resolves head -> hash -> content)
   * This is the main entry point for CAS-backed schema retrieval.
   */
  async getSchemaWithCAS(workspaceId: string): Promise<{
    schema: SDUIPageDefinition;
    hash: string;
    updatedAt: number;
  } | null> {
    try {
      const result = await this.cacheService.getByResourceId<SDUIPageDefinition>(
        workspaceId,
        { namespace: 'schema' }
      );
      
      if (result) {
        logger.debug('Retrieved schema with CAS', {
          workspaceId,
          hash: shortHash(result.hash),
        });
        return {
          schema: result.content,
          hash: result.hash,
          updatedAt: result.updatedAt,
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get schema with CAS', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Generate schema and store with CAS
   */
  async generateSchemaWithCAS(
    workspaceId: string,
    context: WorkspaceContext
  ): Promise<{ schema: SDUIPageDefinition; hash: string }> {
    // Check CAS cache first
    const cached = await this.getSchemaWithCAS(workspaceId);
    if (cached) {
      logger.debug('Returning CAS-cached schema', {
        workspaceId,
        hash: shortHash(cached.hash),
      });
      return { schema: cached.schema, hash: cached.hash };
    }

    // Generate new schema
    const schema = await this.generateSchema(workspaceId, context);
    
    // Store with CAS
    const hash = await this.cacheSchemaWithCAS(workspaceId, schema);
    
    return { schema, hash };
  }

  /**
   * Detect workspace state
   */
  private async detectWorkspaceState(
    workspaceId: string,
    context: WorkspaceContext
  ): Promise<WorkspaceState> {
    try {
      // Determine lifecycle stage from context or workflow state
      const lifecycleStage = await this.determineLifecycleStage(workspaceId, context);

      // Get current workflow execution if any
      const workflowExecution = await this.getCurrentWorkflowExecution(workspaceId);

      // Build workspace state
      const state: WorkspaceState = {
        workspaceId,
        lifecycleStage,
        currentWorkflowId: workflowExecution?.workflow_definition_id,
        currentStageId: workflowExecution?.current_stage || undefined,
        data: {
          workflowStatus: workflowExecution?.status,
          workflowContext: workflowExecution?.context,
        },
        metadata: {
          ...context.metadata,
          userId: context.userId,
          sessionId: context.sessionId,
        },
        lastUpdated: Date.now(),
        version: 1,
      };

      logger.debug('Detected workspace state', {
        workspaceId,
        lifecycleStage,
        hasWorkflow: !!workflowExecution,
      });

      return state;
    } catch (error) {
      logger.error('Failed to detect workspace state', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return fallback state
      return {
        workspaceId,
        lifecycleStage: context.lifecycleStage,
        data: {},
        metadata: context.metadata || {},
        lastUpdated: Date.now(),
        version: 1,
      };
    }
  }

  /**
   * Determine lifecycle stage for workspace
   */
  private async determineLifecycleStage(
    workspaceId: string,
    context: WorkspaceContext
  ): Promise<LifecycleStage> {
    // If context provides lifecycle stage, use it
    if (context.lifecycleStage) {
      return context.lifecycleStage;
    }

    // Otherwise, infer from workflow state or data availability
    // For now, default to opportunity
    return 'opportunity';
  }

  /**
   * Get current workflow execution for workspace
   */
  private async getCurrentWorkflowExecution(workspaceId: string): Promise<any | null> {
    try {
      // Query workflow_executions table for active workflow
      // This would use Supabase client in real implementation
      // For now, return null
      return null;
    } catch (error) {
      logger.error('Failed to get workflow execution', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch workspace data from Value Fabric
   */
  private async fetchWorkspaceData(state: WorkspaceState): Promise<any> {
    try {
      logger.debug('Fetching workspace data', {
        workspaceId: state.workspaceId,
        lifecycleStage: state.lifecycleStage,
      });

      // Fetch data based on lifecycle stage
      const data: any = {
        businessCase: null,
        systemMap: null,
        valueTree: null,
        kpis: [],
        interventions: [],
        feedbackLoops: [],
        personas: [],
      };

      // Fetch business case if available
      data.businessCase = await this.fetchBusinessCase(state.workspaceId);

      // Fetch stage-specific data
      switch (state.lifecycleStage) {
        case 'opportunity':
          data.systemMap = await this.fetchSystemMap(state.workspaceId);
          data.personas = await this.fetchPersonas(state.workspaceId);
          data.kpis = await this.fetchKPIs(state.workspaceId);
          break;

        case 'target':
          data.systemMap = await this.fetchSystemMap(state.workspaceId);
          data.interventions = await this.fetchInterventions(state.workspaceId);
          data.outcomeHypotheses = await this.fetchOutcomeHypotheses(state.workspaceId);
          data.kpis = await this.fetchKPIs(state.workspaceId);
          break;

        case 'expansion':
          data.valueTree = await this.fetchValueTree(state.workspaceId);
          data.kpis = await this.fetchKPIs(state.workspaceId);
          data.gaps = await this.fetchGaps(state.workspaceId);
          data.roi = await this.fetchROI(state.workspaceId);
          break;

        case 'integrity':
          data.manifestoResults = await this.fetchManifestoResults(state.workspaceId);
          data.assumptions = await this.fetchAssumptions(state.workspaceId);
          break;

        case 'realization':
          data.feedbackLoops = await this.fetchFeedbackLoops(state.workspaceId);
          data.metrics = await this.fetchRealizationMetrics(state.workspaceId);
          data.kpis = await this.fetchKPIs(state.workspaceId);
          break;
      }

      logger.debug('Fetched workspace data', {
        workspaceId: state.workspaceId,
        hasBusinessCase: !!data.businessCase,
        hasSystemMap: !!data.systemMap,
        kpiCount: data.kpis?.length || 0,
      });

      return data;
    } catch (error) {
      logger.error('Failed to fetch workspace data', {
        workspaceId: state.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return empty data on error
      return {
        businessCase: null,
        systemMap: null,
        valueTree: null,
        kpis: [],
        interventions: [],
        feedbackLoops: [],
      };
    }
  }

  /**
   * Fetch business case
   */
  private async fetchBusinessCase(workspaceId: string): Promise<any | null> {
    // TODO: Implement actual business case fetching
    return null;
  }

  /**
   * Fetch system map
   */
  private async fetchSystemMap(workspaceId: string): Promise<any | null> {
    // TODO: Implement actual system map fetching
    return null;
  }

  /**
   * Fetch personas
   */
  private async fetchPersonas(workspaceId: string): Promise<any[]> {
    // TODO: Implement actual persona fetching
    return [];
  }

  /**
   * Fetch KPIs
   */
  private async fetchKPIs(workspaceId: string): Promise<any[]> {
    // TODO: Implement actual KPI fetching
    return [];
  }

  /**
   * Fetch interventions
   */
  private async fetchInterventions(workspaceId: string): Promise<any[]> {
    // TODO: Implement actual intervention fetching
    return [];
  }

  /**
   * Fetch outcome hypotheses
   */
  private async fetchOutcomeHypotheses(workspaceId: string): Promise<any[]> {
    // TODO: Implement actual outcome hypothesis fetching
    return [];
  }

  /**
   * Fetch value tree
   */
  private async fetchValueTree(workspaceId: string): Promise<any | null> {
    // TODO: Implement actual value tree fetching
    return null;
  }

  /**
   * Fetch gaps
   */
  private async fetchGaps(workspaceId: string): Promise<any[]> {
    // TODO: Implement actual gap fetching
    return [];
  }

  /**
   * Fetch ROI
   */
  private async fetchROI(workspaceId: string): Promise<any | null> {
    // TODO: Implement actual ROI fetching
    return null;
  }

  /**
   * Fetch manifesto results
   */
  private async fetchManifestoResults(workspaceId: string): Promise<any[]> {
    // TODO: Implement actual manifesto results fetching
    return [];
  }

  /**
   * Fetch assumptions
   */
  private async fetchAssumptions(workspaceId: string): Promise<any[]> {
    // TODO: Implement actual assumption fetching
    return [];
  }

  /**
   * Fetch feedback loops
   */
  private async fetchFeedbackLoops(workspaceId: string): Promise<any[]> {
    // TODO: Implement actual feedback loop fetching
    return [];
  }

  /**
   * Fetch realization metrics
   */
  private async fetchRealizationMetrics(workspaceId: string): Promise<any> {
    // TODO: Implement actual realization metrics fetching
    return null;
  }

  /**
   * Select appropriate template based on workspace state
   */
  private selectTemplate(
    state: WorkspaceState,
    data: any
  ): LifecycleStage {
    // Template selection based on lifecycle stage
    return state.lifecycleStage;
  }

  /**
   * Generate schema from template
   */
  private async generateSchemaFromTemplate(
    template: LifecycleStage,
    data: any,
    state: WorkspaceState
  ): Promise<SDUIPageDefinition> {
    switch (template) {
      case 'opportunity':
        return generateSOFOpportunityPage(data);
      
      case 'target':
        return generateSOFTargetPage(data);
      
      case 'expansion':
        return generateSOFExpansionPage(data);
      
      case 'integrity':
        return generateSOFIntegrityPage(data);
      
      case 'realization':
        return generateSOFRealizationPage(data);
      
      default:
        logger.warn('Unknown template', { template });
        return this.generateFallbackSchema(template);
    }
  }

  /**
   * Generate fallback schema for error cases
   */
  private generateFallbackSchema(stage: LifecycleStage): SDUIPageDefinition {
    return {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'InfoBanner',
          version: 1,
          props: {
            title: 'Loading Workspace',
            description: `Preparing ${stage} stage...`,
            tone: 'info',
          },
        },
      ],
    };
  }

  /**
   * Apply atomic actions to schema
   */
  private async applyAtomicActions(
    schema: SDUIPageDefinition,
    actions: any[]
  ): Promise<SDUIPageDefinition> {
    // TODO: Implement atomic action application
    // For now, return schema unchanged
    logger.debug('Applying atomic actions', { actionCount: actions.length });
    return schema;
  }

  /**
   * Extract workspace context from action
   */
  private extractContextFromAction(action: CanonicalAction): WorkspaceContext {
    // Extract context based on action type
    switch (action.type) {
      case 'navigateToStage':
        return {
          workspaceId: '',
          userId: '',
          lifecycleStage: action.stage,
        };
      
      case 'saveWorkspace':
        return {
          workspaceId: action.workspaceId,
          userId: '',
          lifecycleStage: 'opportunity',
        };
      
      default:
        return {
          workspaceId: '',
          userId: '',
          lifecycleStage: 'opportunity',
        };
    }
  }
}

// Singleton instance
export const canvasSchemaService = new CanvasSchemaService();
