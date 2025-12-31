/**
 * MCP CRM Server
 * 
 * Provides LLM tool access to CRM data (HubSpot, Salesforce).
 * Uses tenant-level OAuth connections.
 */

import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabase';
import { HubSpotModule } from '../modules/HubSpotModule';
import { SalesforceModule } from '../modules/SalesforceModule';
import {
  CRMConnection,
  CRMModule,
  CRMProvider,
  DealSearchParams,
  MCPCRMConfig,
  MCPCRMToolResult,
} from '../types';

// ============================================================================
// Tool Definitions for LLM
// ============================================================================

export const CRM_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'crm_search_deals',
      description: 'Search for deals/opportunities in the connected CRM (HubSpot or Salesforce). Use this to find specific deals by company name, stage, or amount.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Free text search query (e.g., company name, deal name)',
          },
          company_name: {
            type: 'string',
            description: 'Filter by company name',
          },
          stages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by deal stages (e.g., ["qualified", "proposal"])',
          },
          min_amount: {
            type: 'number',
            description: 'Minimum deal amount',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default 10)',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'crm_get_deal_details',
      description: 'Get detailed information about a specific deal including all properties, associated contacts, and recent activities.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: {
            type: 'string',
            description: 'The ID of the deal to retrieve',
          },
          include_contacts: {
            type: 'boolean',
            description: 'Include associated contacts (default true)',
          },
          include_activities: {
            type: 'boolean',
            description: 'Include recent activities (default true)',
          },
        },
        required: ['deal_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'crm_get_stakeholders',
      description: 'Get all contacts/stakeholders associated with a deal, including their roles and contact information.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: {
            type: 'string',
            description: 'The ID of the deal',
          },
        },
        required: ['deal_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'crm_get_recent_activities',
      description: 'Get recent activities (emails, calls, meetings) for a deal to understand engagement history.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: {
            type: 'string',
            description: 'The ID of the deal',
          },
          limit: {
            type: 'number',
            description: 'Number of recent activities to retrieve (default 10)',
          },
        },
        required: ['deal_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'crm_add_note',
      description: 'Add a note to a deal in the CRM with value case insights or analysis results.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: {
            type: 'string',
            description: 'The ID of the deal',
          },
          note: {
            type: 'string',
            description: 'The note content to add',
          },
        },
        required: ['deal_id', 'note'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'crm_get_deal_context',
      description: 'Get normalized deal context optimized for value analysis. Returns standardized financial data, stage mapping, and key metrics needed for ROI calculations.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: {
            type: 'string',
            description: 'The ID of the deal to retrieve context for',
          },
          include_history: {
            type: 'boolean',
            description: 'Include stage history and timeline (default false)',
          },
        },
        required: ['deal_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'crm_sync_metrics',
      description: 'Write calculated value metrics (ROI, NPV, Payback Period) back to CRM custom fields. Supports dry-run mode to validate permissions before writing.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: {
            type: 'string',
            description: 'The ID of the deal to update',
          },
          metrics: {
            type: 'object',
            description: 'Metrics to sync to CRM',
            properties: {
              roi: { type: 'number', description: 'ROI percentage (e.g., 245 for 245%)' },
              npv: { type: 'number', description: 'Net Present Value in deal currency' },
              payback_months: { type: 'number', description: 'Payback period in months' },
              total_value: { type: 'number', description: 'Total projected value' },
              confidence_score: { type: 'number', description: 'Confidence score 0-100' },
            },
          },
          dry_run: {
            type: 'boolean',
            description: 'If true, validate permissions without writing (default false)',
          },
        },
        required: ['deal_id', 'metrics'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'crm_inspect_schema',
      description: 'Inspect the CRM object schema to understand available fields for mapping. Returns field definitions, types, and editability.',
      parameters: {
        type: 'object',
        properties: {
          object_type: {
            type: 'string',
            enum: ['deal', 'contact', 'company'],
            description: 'The CRM object type to inspect',
          },
        },
        required: ['object_type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'crm_check_connection',
      description: 'Check which CRM systems are connected and available for this tenant.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

// ============================================================================
// MCP CRM Server
// ============================================================================

export class MCPCRMServer {
  private config: MCPCRMConfig;
  private modules: Map<CRMProvider, CRMModule> = new Map();
  private connections: Map<CRMProvider, CRMConnection> = new Map();

  constructor(config: MCPCRMConfig) {
    this.config = config;
  }

  /**
   * Initialize the server by loading tenant connections
   */
  async initialize(): Promise<void> {
    await this.loadConnections();
  }

  /**
   * Load CRM connections for the tenant from database
   * Note: Uses 'any' type until tenant_integrations migration is run
   */
  private async loadConnections(): Promise<void> {
    try {
      // Type assertion needed because tenant_integrations table
      // may not be in generated Supabase types yet
      const { data: integrations, error } = await (supabase as any)
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', this.config.tenantId)
        .eq('status', 'active');

      if (error) {
        logger.warn('Failed to load tenant integrations', { error });
        return;
      }

      for (const integration of (integrations || []) as any[]) {
        const connection: CRMConnection = {
          id: integration.id,
          tenantId: integration.tenant_id,
          provider: integration.provider as CRMProvider,
          accessToken: integration.access_token,
          refreshToken: integration.refresh_token,
          tokenExpiresAt: integration.token_expires_at ? new Date(integration.token_expires_at) : undefined,
          instanceUrl: integration.instance_url,
          hubId: integration.hub_id,
          scopes: integration.scopes || [],
          status: integration.status,
        };

        this.connections.set(connection.provider, connection);
        this.initializeModule(connection);
      }

      logger.info('Loaded CRM connections', {
        tenantId: this.config.tenantId,
        providers: Array.from(this.connections.keys()),
      });
    } catch (error) {
      logger.error('Error loading CRM connections', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Initialize a CRM module for a connection
   */
  private initializeModule(connection: CRMConnection): void {
    switch (connection.provider) {
      case 'hubspot':
        this.modules.set('hubspot', new HubSpotModule(connection));
        break;
      case 'salesforce':
        this.modules.set('salesforce', new SalesforceModule(connection));
        break;
      default:
        logger.warn(`Unknown CRM provider: ${connection.provider}`);
    }
  }

  /**
   * Get available tools based on connected CRMs
   */
  getTools(): typeof CRM_TOOLS {
    if (this.connections.size === 0) {
      // Return only the connection check tool if no CRMs connected
      return CRM_TOOLS.filter(t => t.function.name === 'crm_check_connection');
    }
    return CRM_TOOLS;
  }

  /**
   * Check if any CRM is connected
   */
  isConnected(): boolean {
    return this.connections.size > 0;
  }

  /**
   * Get connected providers
   */
  getConnectedProviders(): CRMProvider[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Execute a CRM tool
   */
  async executeTool(toolName: string, args: Record<string, unknown>): Promise<MCPCRMToolResult> {
    const startTime = Date.now();

    try {
      // Get the first available module (prefer HubSpot for now)
      const module = this.modules.get('hubspot') || this.modules.get('salesforce');

      switch (toolName) {
        case 'crm_check_connection':
          return this.handleCheckConnection();

        case 'crm_search_deals':
          if (!module) return this.noConnectionResult();
          return this.handleSearchDeals(module, args, startTime);

        case 'crm_get_deal_details':
          if (!module) return this.noConnectionResult();
          return this.handleGetDealDetails(module, args, startTime);

        case 'crm_get_stakeholders':
          if (!module) return this.noConnectionResult();
          return this.handleGetStakeholders(module, args, startTime);

        case 'crm_get_recent_activities':
          if (!module) return this.noConnectionResult();
          return this.handleGetActivities(module, args, startTime);

        case 'crm_add_note':
          if (!module) return this.noConnectionResult();
          return this.handleAddNote(module, args, startTime);

        case 'crm_get_deal_context':
          if (!module) return this.noConnectionResult();
          return this.handleGetDealContext(module, args, startTime);

        case 'crm_sync_metrics':
          if (!module) return this.noConnectionResult();
          return this.handleSyncMetrics(module, args, startTime);

        case 'crm_inspect_schema':
          if (!module) return this.noConnectionResult();
          return this.handleInspectSchema(module, args, startTime);

        default:
          return {
            success: false,
            error: `Unknown CRM tool: ${toolName}`,
          };
      }
    } catch (error) {
      logger.error('CRM tool execution failed', error instanceof Error ? error : undefined);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // Tool Handlers
  // ==========================================================================

  private handleCheckConnection(): MCPCRMToolResult {
    const providers = this.getConnectedProviders();
    return {
      success: true,
      data: {
        connected: providers.length > 0,
        providers,
        message: providers.length > 0
          ? `Connected to: ${providers.join(', ')}`
          : 'No CRM connected. Ask an admin to connect HubSpot or Salesforce in Settings.',
      },
    };
  }

  private async handleSearchDeals(
    module: CRMModule,
    args: Record<string, unknown>,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const params: DealSearchParams = {
      query: args.query as string | undefined,
      companyName: args.company_name as string | undefined,
      stage: args.stages as string[] | undefined,
      minAmount: args.min_amount as number | undefined,
      limit: (args.limit as number) || 10,
    };

    const result = await module.searchDeals(params);

    return {
      success: true,
      data: {
        deals: result.deals.map(d => ({
          id: d.id,
          name: d.name,
          company: d.companyName,
          amount: d.amount,
          stage: d.stage,
          closeDate: d.closeDate?.toISOString(),
          owner: d.ownerName,
        })),
        total: result.total,
        hasMore: result.hasMore,
      },
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  private async handleGetDealDetails(
    module: CRMModule,
    args: Record<string, unknown>,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const dealId = args.deal_id as string;
    const includeContacts = args.include_contacts !== false;
    const includeActivities = args.include_activities !== false;

    const deal = await module.getDeal(dealId);
    if (!deal) {
      return { success: false, error: `Deal not found: ${dealId}` };
    }

    const contacts = includeContacts ? await module.getDealContacts(dealId) : [];
    const activities = includeActivities ? await module.getDealActivities(dealId, 5) : [];

    return {
      success: true,
      data: {
        deal: {
          id: deal.id,
          name: deal.name,
          amount: deal.amount,
          currency: deal.currency,
          stage: deal.stage,
          probability: deal.probability,
          closeDate: deal.closeDate?.toISOString(),
          owner: deal.ownerName,
          company: deal.companyName,
          createdAt: deal.createdAt.toISOString(),
          updatedAt: deal.updatedAt.toISOString(),
        },
        contacts: contacts.map(c => ({
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
          email: c.email,
          phone: c.phone,
          title: c.title,
          role: c.role,
        })),
        recentActivities: activities.map(a => ({
          type: a.type,
          subject: a.subject,
          date: a.occurredAt.toISOString(),
          duration: a.durationMinutes,
        })),
      },
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  private async handleGetStakeholders(
    module: CRMModule,
    args: Record<string, unknown>,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const dealId = args.deal_id as string;
    const contacts = await module.getDealContacts(dealId);

    return {
      success: true,
      data: {
        stakeholders: contacts.map(c => ({
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown',
          email: c.email,
          phone: c.phone,
          title: c.title,
          role: c.role || 'Contact',
          company: c.companyName,
        })),
        count: contacts.length,
      },
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  private async handleGetActivities(
    module: CRMModule,
    args: Record<string, unknown>,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const dealId = args.deal_id as string;
    const limit = (args.limit as number) || 10;
    const activities = await module.getDealActivities(dealId, limit);

    return {
      success: true,
      data: {
        activities: activities.map(a => ({
          type: a.type,
          subject: a.subject,
          body: a.body?.substring(0, 200),
          date: a.occurredAt.toISOString(),
          durationMinutes: a.durationMinutes,
        })),
        count: activities.length,
      },
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  private async handleAddNote(
    module: CRMModule,
    args: Record<string, unknown>,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const dealId = args.deal_id as string;
    const note = args.note as string;

    const success = await module.addDealNote(dealId, note);

    return {
      success,
      data: success
        ? { message: 'Note added successfully' }
        : undefined,
      error: success ? undefined : 'Failed to add note',
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Get normalized deal context for value analysis
   * Returns standardized financial data optimized for ROI calculations
   */
  private async handleGetDealContext(
    module: CRMModule,
    args: Record<string, unknown>,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const dealId = args.deal_id as string;
    const includeHistory = args.include_history === true;

    const deal = await module.getDeal(dealId);
    if (!deal) {
      return { success: false, error: `Deal not found: ${dealId}` };
    }

    // Normalize stage to standardized enum
    const normalizedStage = this.normalizeStage(deal.stage);

    // Build normalized context optimized for value analysis
    const normalizedContext = {
      // Core identification
      dealId: deal.id,
      externalId: deal.externalId,
      provider: deal.provider,

      // Financial data (normalized)
      financial: {
        dealValue: this.normalizeCurrency(deal.amount),
        currency: deal.currency || 'USD',
        probability: deal.probability ?? 0,
        expectedValue: (deal.amount || 0) * ((deal.probability ?? 0) / 100),
      },

      // Stage information
      stage: {
        current: deal.stage,
        normalized: normalizedStage,
        closeDate: deal.closeDate?.toISOString(),
        daysInStage: this.calculateDaysInStage(deal.updatedAt),
        daysToClose: deal.closeDate ? this.calculateDaysToClose(deal.closeDate) : null,
      },

      // Stakeholders summary
      company: {
        id: deal.companyId,
        name: deal.companyName || 'Unknown',
      },

      // Owner
      owner: {
        id: deal.ownerId,
        name: deal.ownerName || 'Unassigned',
      },

      // Timestamps
      timestamps: {
        created: deal.createdAt.toISOString(),
        lastModified: deal.updatedAt.toISOString(),
      },

      // Custom properties (filtered for relevant fields)
      customFields: this.extractRelevantProperties(deal.properties),
    };

    // Optionally include stage history
    if (includeHistory) {
      const activities = await module.getDealActivities(dealId, 20);
      (normalizedContext as any).history = {
        recentActivityCount: activities.length,
        lastActivityDate: activities[0]?.occurredAt?.toISOString() || null,
        activityTypes: [...new Set(activities.map(a => a.type))],
      };
    }

    return {
      success: true,
      data: { context: normalizedContext },
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Sync calculated metrics back to CRM
   * Supports dry-run mode for permission validation
   */
  private async handleSyncMetrics(
    module: CRMModule,
    args: Record<string, unknown>,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const dealId = args.deal_id as string;
    const metrics = args.metrics as Record<string, number>;
    const dryRun = args.dry_run === true;

    // Map metrics to CRM field names based on provider
    const fieldMapping = this.getMetricsFieldMapping(module.provider);
    const propertiesToUpdate: Record<string, unknown> = {};

    if (metrics.roi !== undefined && fieldMapping.roi) {
      propertiesToUpdate[fieldMapping.roi] = metrics.roi;
    }
    if (metrics.npv !== undefined && fieldMapping.npv) {
      propertiesToUpdate[fieldMapping.npv] = metrics.npv;
    }
    if (metrics.payback_months !== undefined && fieldMapping.payback_months) {
      propertiesToUpdate[fieldMapping.payback_months] = metrics.payback_months;
    }
    if (metrics.total_value !== undefined && fieldMapping.total_value) {
      propertiesToUpdate[fieldMapping.total_value] = metrics.total_value;
    }
    if (metrics.confidence_score !== undefined && fieldMapping.confidence_score) {
      propertiesToUpdate[fieldMapping.confidence_score] = metrics.confidence_score;
    }

    // Add metadata fields
    propertiesToUpdate[fieldMapping.last_calculated || 'valuecanvas_last_sync'] = new Date().toISOString();

    if (dryRun) {
      // Validate by attempting to read the deal first
      const deal = await module.getDeal(dealId);
      if (!deal) {
        return { success: false, error: `Deal not found: ${dealId}` };
      }

      return {
        success: true,
        data: {
          dryRun: true,
          dealId,
          wouldUpdate: Object.keys(propertiesToUpdate),
          message: `Dry run successful. ${Object.keys(propertiesToUpdate).length} fields would be updated.`,
        },
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }

    // Actually write the metrics
    const success = await module.updateDealProperties(dealId, propertiesToUpdate);

    return {
      success,
      data: success
        ? {
            dealId,
            fieldsUpdated: Object.keys(propertiesToUpdate),
            timestamp: new Date().toISOString(),
            message: `Successfully synced ${Object.keys(metrics).length} metrics to CRM.`,
          }
        : undefined,
      error: success ? undefined : 'Failed to update deal properties. Check field permissions.',
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Inspect CRM object schema for field mapping
   */
  private async handleInspectSchema(
    module: CRMModule,
    args: Record<string, unknown>,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const objectType = args.object_type as string;

    // Get schema based on object type
    // Note: This would call the CRM's describe/metadata API
    // For now, return known field structure
    const schema = this.getObjectSchema(module.provider, objectType);

    return {
      success: true,
      data: {
        objectType,
        provider: module.provider,
        fields: schema.fields,
        customFieldsCount: schema.customFieldsCount,
        requiredFields: schema.requiredFields,
        writableFields: schema.writableFields,
      },
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private normalizeStage(stage: string): string {
    const stageMap: Record<string, string> = {
      // HubSpot stages
      'appointmentscheduled': 'discovery',
      'qualifiedtobuy': 'qualified',
      'presentationscheduled': 'proposal',
      'decisionmakerboughtin': 'negotiation',
      'contractsent': 'negotiation',
      'closedwon': 'closed_won',
      'closedlost': 'closed_lost',
      // Salesforce stages
      'prospecting': 'discovery',
      'qualification': 'qualified',
      'needs analysis': 'qualified',
      'value proposition': 'proposal',
      'id. decision makers': 'proposal',
      'perception analysis': 'proposal',
      'proposal/price quote': 'proposal',
      'negotiation/review': 'negotiation',
      'closed won': 'closed_won',
      'closed lost': 'closed_lost',
    };

    const normalized = stageMap[stage.toLowerCase()];
    return normalized || 'unknown';
  }

  private normalizeCurrency(amount: number | undefined): number {
    if (amount === undefined || amount === null) return 0;
    // Handle string amounts like "$1.2M" or "EUR 500K"
    if (typeof amount === 'string') {
      const cleaned = String(amount).replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(cleaned);
      // Handle K/M suffixes
      if (String(amount).toLowerCase().includes('m')) return parsed * 1000000;
      if (String(amount).toLowerCase().includes('k')) return parsed * 1000;
      return parsed || 0;
    }
    return amount;
  }

  private calculateDaysInStage(lastModified: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - lastModified.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  private calculateDaysToClose(closeDate: Date): number {
    const now = new Date();
    const diffMs = closeDate.getTime() - now.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  private extractRelevantProperties(props: Record<string, unknown>): Record<string, unknown> {
    // Filter for value-relevant properties
    const relevantKeys = [
      'annual_revenue', 'revenue', 'arr', 'mrr',
      'contract_value', 'contract_length', 'term',
      'discount', 'industry', 'company_size', 'employees',
    ];

    const result: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      const lowerKey = key.toLowerCase();
      if (relevantKeys.some(rk => lowerKey.includes(rk))) {
        result[key] = props[key];
      }
    }
    return result;
  }

  private getMetricsFieldMapping(provider: CRMProvider): Record<string, string> {
    // Default field mappings - would be loaded from config in production
    if (provider === 'salesforce') {
      return {
        roi: 'Calculated_ROI__c',
        npv: 'Net_Present_Value__c',
        payback_months: 'Payback_Period_Months__c',
        total_value: 'Total_Projected_Value__c',
        confidence_score: 'Value_Confidence__c',
        last_calculated: 'ValueCanvas_Last_Sync__c',
      };
    }
    // HubSpot
    return {
      roi: 'calculated_roi',
      npv: 'net_present_value',
      payback_months: 'payback_period_months',
      total_value: 'total_projected_value',
      confidence_score: 'value_confidence',
      last_calculated: 'valuecanvas_last_sync',
    };
  }

  private getObjectSchema(provider: CRMProvider, objectType: string): {
    fields: Array<{ name: string; type: string; editable: boolean; required: boolean }>;
    customFieldsCount: number;
    requiredFields: string[];
    writableFields: string[];
  } {
    // Return common schema structure
    const dealFields = [
      { name: 'name', type: 'string', editable: true, required: true },
      { name: 'amount', type: 'currency', editable: true, required: false },
      { name: 'stage', type: 'picklist', editable: true, required: true },
      { name: 'close_date', type: 'date', editable: true, required: false },
      { name: 'probability', type: 'percent', editable: true, required: false },
      { name: 'owner_id', type: 'reference', editable: true, required: true },
    ];

    // Add provider-specific custom fields for metrics
    const customFields = provider === 'salesforce'
      ? [
          { name: 'Calculated_ROI__c', type: 'number', editable: true, required: false },
          { name: 'Net_Present_Value__c', type: 'currency', editable: true, required: false },
          { name: 'Payback_Period_Months__c', type: 'number', editable: true, required: false },
        ]
      : [
          { name: 'calculated_roi', type: 'number', editable: true, required: false },
          { name: 'net_present_value', type: 'number', editable: true, required: false },
          { name: 'payback_period_months', type: 'number', editable: true, required: false },
        ];

    const allFields = [...dealFields, ...customFields];

    return {
      fields: allFields,
      customFieldsCount: customFields.length,
      requiredFields: allFields.filter(f => f.required).map(f => f.name),
      writableFields: allFields.filter(f => f.editable).map(f => f.name),
    };
  }

  private noConnectionResult(): MCPCRMToolResult {
    return {
      success: false,
      error: 'No CRM connected. Ask an admin to connect HubSpot or Salesforce in Settings → Integrations.',
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let serverInstance: MCPCRMServer | null = null;

export async function getMCPCRMServer(tenantId: string, userId: string): Promise<MCPCRMServer> {
  // In production, you'd cache by tenantId
  if (!serverInstance || serverInstance['config'].tenantId !== tenantId) {
    serverInstance = new MCPCRMServer({
      tenantId,
      userId,
      enabledProviders: ['hubspot', 'salesforce'],
      refreshTokensAutomatically: true,
    });
    await serverInstance.initialize();
  }
  return serverInstance;
}
