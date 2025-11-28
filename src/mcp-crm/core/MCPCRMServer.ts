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
  CRMProvider,
  CRMConnection,
  CRMModule,
  MCPCRMConfig,
  MCPCRMToolResult,
  DealSearchParams,
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
