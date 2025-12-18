/**
 * SDUI API Endpoints
 * 
 * P1 GAP FIX: Provides HTTP endpoints for schema delivery with version negotiation
 * 
 * Implements:
 * - Schema delivery via HTTP
 * - Version negotiation via Accept-Version header
 * - Schema caching with appropriate headers
 * - Backward compatibility via version downgrading
 */

import { Request, Response, Router } from 'express';
import { logger } from '../../lib/logger';
import { validateSDUISchema } from '../../sdui/schema';
import { migrateSchema } from '../../sdui/migrations';
import { SDUI_VERSION } from '../../sdui/registry';

const router = Router();

/**
 * Get SDUI schema for a workspace
 * 
 * Supports version negotiation via Accept-Version header
 * Returns schema compatible with requested version
 */
router.get('/api/sdui/schema/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const requestedVersion = parseVersion(req.headers['accept-version'] as string);
    const clientVersion = requestedVersion || SDUI_VERSION;

    logger.info('SDUI schema requested', {
      workspaceId,
      requestedVersion: clientVersion,
      serverVersion: SDUI_VERSION
    });

    // Generate schema for workspace (placeholder - implement actual generation)
    let schema = await generateSchemaForWorkspace(workspaceId);

    // Validate schema
    const validation = validateSDUISchema(schema);
    if (!validation.success) {
      logger.error('Invalid SDUI schema generated', {
        workspaceId,
        errors: validation.errors
      });
      return res.status(500).json({
        error: 'schema_generation_failed',
        message: 'Failed to generate valid SDUI schema'
      });
    }

    // Downgrade schema if client version is older
    if (clientVersion < SDUI_VERSION) {
      logger.info('Downgrading schema for old client', {
        from: SDUI_VERSION,
        to: clientVersion
      });
      schema = migrateSchema(schema, clientVersion);
    }

    // Set response headers
    res.setHeader('SDUI-Version', schema.version || SDUI_VERSION);
    res.setHeader('SDUI-Server-Version', SDUI_VERSION);
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.setHeader('Vary', 'Accept-Version');

    // Warn if client is using old version
    if (clientVersion < SDUI_VERSION) {
      res.setHeader('Warning', `299 - "Client version ${clientVersion} is older than server version ${SDUI_VERSION}"`);
    }

    res.json(schema);
  } catch (error) {
    logger.error('SDUI schema request failed', { error });
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to retrieve SDUI schema'
    });
  }
});

/**
 * Get SDUI schema for a specific agent
 * 
 * Returns schema for agent's current state
 */
router.get('/api/sdui/agent/:agentId/schema', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const requestedVersion = parseVersion(req.headers['accept-version'] as string);
    const clientVersion = requestedVersion || SDUI_VERSION;

    logger.info('Agent SDUI schema requested', {
      agentId,
      requestedVersion: clientVersion
    });

    // Generate schema for agent (placeholder - implement actual generation)
    let schema = await generateSchemaForAgent(agentId);

    // Validate schema
    const validation = validateSDUISchema(schema);
    if (!validation.success) {
      logger.error('Invalid agent SDUI schema generated', {
        agentId,
        errors: validation.errors
      });
      return res.status(500).json({
        error: 'schema_generation_failed',
        message: 'Failed to generate valid agent SDUI schema'
      });
    }

    // Downgrade schema if needed
    if (clientVersion < SDUI_VERSION) {
      schema = migrateSchema(schema, clientVersion);
    }

    // Set response headers
    res.setHeader('SDUI-Version', schema.version || SDUI_VERSION);
    res.setHeader('Cache-Control', 'private, max-age=60'); // 1 minute (agent state changes frequently)
    res.setHeader('Vary', 'Accept-Version');

    res.json(schema);
  } catch (error) {
    logger.error('Agent SDUI schema request failed', { error });
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to retrieve agent SDUI schema'
    });
  }
});

/**
 * Get supported SDUI versions
 * 
 * Returns list of supported schema versions and their features
 */
router.get('/api/sdui/versions', (_req: Request, res: Response) => {
  res.json({
    current: SDUI_VERSION,
    supported: [1, 2],
    deprecated: [],
    features: {
      1: {
        components: ['InfoBanner', 'DiscoveryCard', 'ValueTreeCard'],
        actions: ['mutate_component', 'add_component', 'remove_component'],
        dataBinding: false
      },
      2: {
        components: ['InfoBanner', 'DiscoveryCard', 'ValueTreeCard', 'MetricBadge', 'KPIForm', 'DataTable'],
        actions: ['mutate_component', 'add_component', 'remove_component', 'reorder_components', 'update_layout', 'batch'],
        dataBinding: true,
        realtime: true
      }
    }
  });
});

/**
 * Validate SDUI schema
 * 
 * Allows clients to validate schemas before rendering
 */
router.post('/api/sdui/validate', (req: Request, res: Response) => {
  try {
    const schema = req.body;
    const validation = validateSDUISchema(schema);

    if (validation.success) {
      res.json({
        valid: true,
        warnings: validation.warnings || []
      });
    } else {
      res.status(400).json({
        valid: false,
        errors: validation.errors
      });
    }
  } catch (error) {
    logger.error('Schema validation failed', { error });
    res.status(500).json({
      error: 'validation_error',
      message: 'Failed to validate schema'
    });
  }
});

/**
 * Parse version from header
 */
function parseVersion(versionHeader: string | undefined): number | null {
  if (!versionHeader) return null;

  // Support formats: "v2", "2", "2.0"
  const match = versionHeader.match(/v?(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return null;
}

/**
 * Generate SDUI schema for workspace
 * 
 * TODO: Implement actual schema generation based on workspace state
 */
async function generateSchemaForWorkspace(workspaceId: string): Promise<Record<string, unknown>> {
  logger.info('Generating schema for workspace', { workspaceId });

  // Placeholder implementation
  return {
    version: SDUI_VERSION,
    title: `Workspace ${workspaceId}`,
    layout: 'vertical',
    components: [
      {
        id: 'welcome-banner',
        type: 'InfoBanner',
        version: SDUI_VERSION,
        props: {
          message: 'Welcome to your workspace',
          variant: 'info'
        }
      }
    ]
  };
}

/**
 * Generate SDUI schema for agent
 * 
 * TODO: Implement actual schema generation based on agent state
 */
async function generateSchemaForAgent(agentId: string): Promise<Record<string, unknown>> {
  logger.info('Generating schema for agent', { agentId });

  // Placeholder implementation
  return {
    version: SDUI_VERSION,
    title: `Agent ${agentId}`,
    layout: 'vertical',
    components: [
      {
        id: 'agent-status',
        type: 'AgentResponseCard',
        version: SDUI_VERSION,
        props: {
          agentId,
          status: 'active'
        }
      }
    ]
  };
}

export default router;
