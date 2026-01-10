/**
 * Canvas Schema Service
 * 
 * Server-side service that generates SDUI page definitions based on workspace state.
 * This is the "brain" of the SDUI system that decides what UI to show.
 */

import { logger } from '../lib/logger';
import { SDUIPageDefinition } from '../sdui/schema';
import {
  ActionResult,
  CanonicalAction,
  SchemaCacheEntry,
  TemplateSelectionCriteria,
  WorkspaceContext,
  WorkspaceState,
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
import { ROIFormulaInterpreter } from './ROIFormulaInterpreter';
import { ROIModel, ROIModelCalculation } from '../types/vos';
import { ALL_VMRT_SEEDS } from '../types/vos-pt1-seed';
import { VMRTAssumption } from '../types/vmrt';
import { ManifestoValidationResult } from '../types/vos';
import { EXTENDED_STRUCTURAL_PERSONA_MAPS } from '../types/structural-data';
import { OutcomeHypothesis } from '../types/sof';

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
      const userId = state.metadata?.userId as string | undefined;
      data.businessCase = await this.fetchBusinessCase(state.workspaceId, userId);

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
          data.assumptions = await this.fetchAssumptions(state.workspaceId, data.businessCase);
          break;

        case 'realization':
          data.feedbackLoops = await this.fetchFeedbackLoops(state.workspaceId);
          data.realizationData = await this.fetchRealizationMetrics(state.workspaceId);
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
  private async fetchBusinessCase(workspaceId: string, userId?: string): Promise<any | null> {
    try {
      const supabase = getSupabaseClient();

      // Try business_cases table (legacy but primary for now)
      // We select fields that map to the ValueCase interface
      let query = supabase
        .from('business_cases')
        .select(`
          id,
          name,
          client,
          description,
          status,
          created_at,
          updated_at,
          metadata,
          owner_id
        `)
        .eq('id', workspaceId);

      // If userId is provided, we can optionally check ownership,
      // though RLS should handle this securely at the database level.
      if (userId) {
        query = query.eq('owner_id', userId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        logger.warn('Error fetching business case', { workspaceId, error: error.message });
        return null;
      }

      if (!data) {
        // Fallback: try value_cases table if business_cases didn't yield result
        // This handles the migration scenario where data might be in the new table
        const { data: vcData, error: vcError } = await supabase
          .from('value_cases')
          .select(`
            id,
            name,
            description,
            status,
            created_at,
            updated_at,
            metadata,
            company_profiles (
              company_name
            )
          `)
          .eq('id', workspaceId)
          .maybeSingle();

        if (vcError || !vcData) {
          logger.debug('Business case not found in either table', { workspaceId });
          return null;
        }

        // Map value_cases result
        return {
          id: vcData.id,
          name: vcData.name,
          description: vcData.description,
          company: vcData.company_profiles?.[0]?.company_name || 'Unknown Company',
          stage: vcData.metadata?.stage || 'opportunity',
          status: vcData.status,
          created_at: vcData.created_at,
          updated_at: vcData.updated_at,
          metadata: vcData.metadata || {},
        };
      }

      // Map business_cases result
      return {
        id: data.id,
        name: data.name,
        description: data.metadata?.description || data.description,
        company: data.client,
        stage: data.metadata?.stage || 'opportunity',
        status: data.status === 'presented' ? 'completed' : 'in-progress',
        created_at: data.created_at,
        updated_at: data.updated_at,
        metadata: data.metadata || {},
      };

    } catch (error) {
      logger.error('Failed to fetch business case', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch system map
   */
  private async fetchSystemMap(workspaceId: string): Promise<any | null> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('system_maps')
        .select('*')
        .eq('business_case_id', workspaceId)
        .maybeSingle();

      if (error) {
        logger.warn('Error fetching system map', { workspaceId, error: error.message });
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Failed to fetch system map', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch personas
   */
  private async fetchPersonas(workspaceId: string): Promise<any[]> {
    try {
      // 1. Fetch business case to get context (industry, custom stakeholders)
      const businessCase = await this.fetchBusinessCase(workspaceId);

      // 2. If business case has stored stakeholders/personas, return them
      if (businessCase?.metadata?.stakeholders && Array.isArray(businessCase.metadata.stakeholders)) {
        return businessCase.metadata.stakeholders;
      }

      if (businessCase?.metadata?.personas && Array.isArray(businessCase.metadata.personas)) {
        return businessCase.metadata.personas;
      }

      // 3. Fallback: Use structural truth data
      // We map the structural personas to the format expected by the UI
      return EXTENDED_STRUCTURAL_PERSONA_MAPS.map(p => ({
        id: p.persona, // Use persona key as ID
        name: this.formatPersonaName(p.persona),
        role: p.persona,
        primaryPain: p.primaryPain,
        painDescription: p.painDescription,
        keyKPIs: p.keyKPIs,
        financialDriver: p.financialDriver,
        typicalGoals: p.typicalGoals,
        communicationPreference: p.communicationPreference
      }));

    } catch (error) {
       logger.error('Failed to fetch personas', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private formatPersonaName(key: string): string {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Fetch KPIs
   */
  private async fetchKPIs(workspaceId: string): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();

      // 1. First try to find active value commit
      // This allows us to get committed targets if they exist
      const { data: commit } = await supabase
        .from('value_commits')
        .select('id')
        .eq('value_case_id', workspaceId)
        .eq('status', 'active')
        .maybeSingle();

      if (commit) {
        // 2. If commit exists, fetch targets
        const { data: targets, error: targetError } = await supabase
          .from('kpi_targets')
          .select('*')
          .eq('value_commit_id', commit.id);

        if (!targetError && targets && targets.length > 0) {
          return targets.map(t => ({
            id: t.id,
            kpi_name: t.kpi_name,
            baseline_value: t.baseline_value,
            target_value: t.target_value,
            unit: t.unit,
            confidence_level: t.confidence_level,
            source: 'target',
            created_at: t.created_at
          }));
        }
      }

      // 3. Fallback: fetch hypotheses
      // Used in Opportunity stage or before commitment
      const { data: hypotheses, error: hypoError } = await supabase
        .from('kpi_hypotheses')
        .select('*')
        .eq('value_case_id', workspaceId);

      if (hypoError) {
        logger.warn('Error fetching KPI hypotheses', { workspaceId, error: hypoError.message });
        return [];
      }

      return (hypotheses || []).map(h => ({
        id: h.id,
        kpi_name: h.kpi_name,
        baseline_value: h.baseline_value,
        target_value: h.target_value,
        unit: h.unit,
        confidence_level: h.confidence_level,
        source: 'hypothesis',
        created_at: h.created_at
      }));

    } catch (error) {
      logger.error('Failed to fetch KPIs', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Fetch interventions
   */
  private async fetchInterventions(workspaceId: string): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();

      // 1. Get system map for this workspace (business case)
      const { data: systemMap, error: mapError } = await supabase
        .from('system_maps')
        .select('id')
        .eq('business_case_id', workspaceId)
        .maybeSingle();

      if (mapError) {
        logger.warn('Error fetching system map for interventions', { workspaceId, error: mapError.message });
        return [];
      }

      if (!systemMap) {
        logger.debug('No system map found for workspace', { workspaceId });
        return [];
      }

      // 2. Fetch interventions for the system map
      const { data: interventions, error: intError } = await supabase
        .from('intervention_points')
        .select('*')
        .eq('system_map_id', systemMap.id)
        .order('created_at', { ascending: false });

      if (intError) {
        logger.error('Error fetching interventions', { workspaceId, error: intError.message });
        return [];
      }

      return interventions || [];

    } catch (error) {
      logger.error('Failed to fetch interventions', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Fetch outcome hypotheses
   * Retrieves outcome hypotheses linked to the system map of the current workspace.
   * Relies on the 'outcome_hypotheses' table as referenced in DataBindingResolver.ts.
   */
  private async fetchOutcomeHypotheses(workspaceId: string): Promise<OutcomeHypothesis[]> {
    try {
      const supabase = getSupabaseClient();

      // 1. Resolve the System Map ID for this Workspace
      // We assume 'system_maps' has a 'business_case_id' column based on standard patterns.
      const { data: systemMap, error: systemMapError } = await supabase
        .from('system_maps')
        .select('id')
        .eq('business_case_id', workspaceId)
        .maybeSingle();

      if (systemMapError) {
        logger.error('Error resolving system map for outcomes', { workspaceId, error: systemMapError.message });
        return [];
      }

      if (!systemMap) {
        // No system map exists for this workspace yet, so no outcomes can exist.
        return [];
      }

      // 2. Fetch outcome hypotheses linked to the System Map
      const { data, error } = await supabase
        .from('outcome_hypotheses')
        .select('*')
        .eq('system_map_id', systemMap.id)
        // Ordering by creation ensures consistent display order
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Error fetching outcome hypotheses', { workspaceId, error: error.message });
        return [];
      }

      return (data as OutcomeHypothesis[]) || [];

    } catch (err) {
      logger.error('Unexpected error in fetchOutcomeHypotheses', {
        workspaceId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Fetch value tree
   */
  private async fetchValueTree(workspaceId: string): Promise<any | null> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('value_trees')
        .select(`
          *,
          value_tree_nodes(*),
          value_tree_links(*)
        `)
        .eq('value_case_id', workspaceId)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching value tree', { workspaceId, error: error.message });
        return null;
      }

      if (!data) return null;

      // Transform to match expected structure (similar to ValueTreeService)
      return {
        ...data,
        nodes: data.value_tree_nodes || [],
        links: data.value_tree_links || []
      };
    } catch (error) {
      logger.error('Failed to fetch value tree', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch gaps
   */
  private async fetchGaps(workspaceId: string): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();

      // Fetch opportunities with gap analysis
      const { data: opportunities, error } = await supabase
        .from('opportunities')
        .select('id, title, type, gap_analysis, current_state, desired_state, impact_score')
        .eq('value_case_id', workspaceId)
        .not('gap_analysis', 'is', null);

      if (error) {
        logger.warn('Error fetching gaps from opportunities', { workspaceId, error: error.message });
        return [];
      }

      // Transform into a standardized Gap interface
      return (opportunities || []).map(opp => ({
        id: opp.id,
        name: opp.title,
        type: opp.type,
        gap_analysis: opp.gap_analysis,
        current_state: opp.current_state,
        desired_state: opp.desired_state,
        impact_score: opp.impact_score
      }));

    } catch (error) {
      logger.error('Failed to fetch gaps', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Fetch ROI
   */
  private async fetchROI(workspaceId: string): Promise<{
    model: ROIModel;
    calculations: ROIModelCalculation[];
    results: any;
  } | null> {
    try {
      const supabase = getSupabaseClient();

      // Fetch ROI Model and Calculations in a single efficient query
      // using nested filtering via join with value_trees table
      const { data: roiModel, error: rmError } = await supabase
        .from('roi_models')
        .select(`
          *,
          roi_model_calculations (*),
          value_trees!inner (
            value_case_id
          )
        `)
        .eq('value_trees.value_case_id', workspaceId)
        .maybeSingle();

      if (rmError || !roiModel) {
        logger.debug('ROI Model not found', { workspaceId });
        return null;
      }

      // Calculations are already ordered by database if not we sort them
      const calculations = (roiModel.roi_model_calculations || []).sort(
        (a: ROIModelCalculation, b: ROIModelCalculation) => a.calculation_order - b.calculation_order
      );

      // Clean up the model object to remove the extra nested data if strict typing needed
      // But for now casting or just using it is fine.
      // We also need to remove the value_trees property if it's not part of ROIModel type
      // But let's keep it simple.

      // 4. Calculate results using ROIFormulaInterpreter
      const interpreter = new ROIFormulaInterpreter(supabase);

      // Initialize context with KPI data
      const context = await interpreter.createContextFromKPIs(workspaceId);

      // Execute calculation sequence
      const results = await interpreter.executeCalculationSequence(
        calculations,
        context
      );

      return {
        model: roiModel as unknown as ROIModel,
        calculations,
        results
      };

    } catch (error) {
      logger.error('Failed to fetch ROI', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch manifesto results
   */
  private async fetchManifestoResults(workspaceId: string): Promise<ManifestoValidationResult[]> {
    try {
      const supabase = getSupabaseClient();
      const results: ManifestoValidationResult[] = [];

      // Helper to process artifacts
      const collectResults = (artifacts: any[]) => {
        if (!artifacts) return;
        artifacts.forEach(artifact => {
          if (artifact.compliance_metadata && artifact.compliance_metadata.results) {
            results.push(...artifact.compliance_metadata.results);
          }
        });
      };

      // 1. Fetch Value Trees
      const { data: valueTrees } = await supabase
        .from('value_trees')
        .select('id, compliance_metadata')
        .eq('value_case_id', workspaceId);

      collectResults(valueTrees || []);

      // 2. Fetch ROI Models (linked via Value Trees)
      if (valueTrees && valueTrees.length > 0) {
        const valueTreeIds = valueTrees.map((vt: any) => vt.id);
        const { data: roiModels } = await supabase
          .from('roi_models')
          .select('id, compliance_metadata')
          .in('value_tree_id', valueTreeIds);

        collectResults(roiModels || []);
      }

      // 3. Fetch Value Commits
      const { data: valueCommits } = await supabase
        .from('value_commits')
        .select('id, compliance_metadata')
        .eq('value_case_id', workspaceId);

      collectResults(valueCommits || []);

      // 4. Fetch Realization Reports
      const { data: realizationReports } = await supabase
        .from('realization_reports')
        .select('id, compliance_metadata')
        .eq('value_case_id', workspaceId);

      collectResults(realizationReports || []);

      // 5. Fetch Expansion Models
      const { data: expansionModels } = await supabase
        .from('expansion_models')
        .select('id, compliance_metadata')
        .eq('value_case_id', workspaceId);

      collectResults(expansionModels || []);

      logger.debug('Fetched manifesto results', {
        workspaceId,
        count: results.length
      });

      return results;

    } catch (error) {
      logger.error('Failed to fetch manifesto results', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Fetch assumptions
   */
  private async fetchAssumptions(workspaceId: string, businessCase?: any): Promise<VMRTAssumption[]> {
    try {
      // 1. Try to fetch from database models first
      const supabase = getSupabaseClient();

      // Try to find a model associated with this business case (workspace)
      // We check if the model_data contains the business_case_id
      const { data: modelData } = await supabase
        .from('models')
        .select('model_data')
        .contains('model_data', { business_case_id: workspaceId })
        .maybeSingle();

      // If we found a model with assumptions, return them
      if (modelData?.model_data?.assumptions && Array.isArray(modelData.model_data.assumptions)) {
         return modelData.model_data.assumptions;
      }

      // 2. Fallback to seed data based on industry/context
      const industry = businessCase?.metadata?.industry;

      // Find relevant VMRTs from the seeds
      let relevantTraces = ALL_VMRT_SEEDS;

      if (industry) {
        const industryTraces = ALL_VMRT_SEEDS.filter(t =>
          t.context?.organization?.industry?.toLowerCase() === industry.toLowerCase()
        );
        if (industryTraces.length > 0) {
          relevantTraces = industryTraces;
        }
      }

      // Extract all assumptions from reasoning steps
      const assumptions: VMRTAssumption[] = relevantTraces.flatMap(trace =>
        trace.reasoningSteps?.flatMap(step => step.assumptions || []) || []
      );

      // Deduplicate by factor name, keeping the one with higher confidence
      const uniqueAssumptions = Array.from(
        assumptions.reduce((map, assumption) => {
          const existing = map.get(assumption.factor);
          if (!existing || (assumption.confidence > existing.confidence)) {
            map.set(assumption.factor, assumption);
          }
          return map;
        }, new Map<string, VMRTAssumption>()).values()
      );

      return uniqueAssumptions;

    } catch (error) {
      logger.error('Failed to fetch assumptions', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Fetch feedback loops
   */
  private async fetchFeedbackLoops(workspaceId: string): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();

      // 1. Get system map
      const { data: systemMap, error: mapError } = await supabase
        .from('system_maps')
        .select('id')
        .eq('business_case_id', workspaceId)
        .maybeSingle();

      if (mapError || !systemMap) {
        return [];
      }

      // 2. Fetch feedback loops
      const { data: loops, error: loopError } = await supabase
        .from('feedback_loops')
        .select('*')
        .eq('system_map_id', systemMap.id);

      if (loopError) {
        logger.warn('Error fetching feedback loops', { workspaceId, error: loopError.message });
        return [];
      }

      return loops || [];
    } catch (error) {
      logger.error('Failed to fetch feedback loops', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Fetch realization metrics
   */
  private async fetchRealizationMetrics(workspaceId: string): Promise<any> {
    try {
      const supabase = getSupabaseClient();

      // 1. Fetch Realization Status (Report)
      const { data: report } = await supabase
        .from('realization_reports')
        .select('*')
        .eq('value_case_id', workspaceId)
        .order('report_period_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      let implementationStatus = 'planning';
      let kpiMeasurements: any[] = [];

      if (report) {
        // Map status
        const statusMap: Record<string, string> = {
          'on_track': 'implementing',
          'at_risk': 'implementing',
          'achieved': 'completed',
          'missed': 'completed'
        };
        implementationStatus = statusMap[report.overall_status] || 'planning';

        // Fetch KPI measurements for this report
        const { data: results } = await supabase
          .from('realization_results')
          .select('*')
          .eq('realization_report_id', report.id);

        if (results) {
          kpiMeasurements = results;
        }
      }

      // 2. Fetch Observed Changes (from Feedback Loops)
      const feedbackLoops = await this.fetchFeedbackLoops(workspaceId);
      const observedChanges = feedbackLoops.flatMap(loop => loop.behavior_changes || []);

      return {
        implementationStatus,
        observedChanges,
        kpiMeasurements
      };

    } catch (error) {
      logger.error('Failed to fetch realization metrics', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
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
