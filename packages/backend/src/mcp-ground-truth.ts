/**
 * MCP Ground Truth Integration
 *
 * Exports the MCP Ground Truth server factory for use by MCPGroundTruthService.
 * Links to the actual implementation in @mcp/ground-truth.
 */

import { logger } from './lib/logger.js';
import { createDevServer as createServer } from '@mcp/ground-truth';

export async function createDevServer(): Promise<unknown> {
  try {
    return await createServer();
  } catch (error) {
    logger.error('Failed to create MCP Dev Server', { error });
    return null;
  }
}
