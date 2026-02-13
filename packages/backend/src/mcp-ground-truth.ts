/**
 * MCP Ground Truth stub
 *
 * Re-exports the MCP Ground Truth server factory for use by MCPGroundTruthService.
 * The actual implementation lives in packages/mcp/ground-truth/.
 * This stub exists so the dynamic import('../mcp-ground-truth') in
 * MCPGroundTruthService.ts resolves within the backend package.
 */

export async function createDevServer(): Promise<any> {
  // In production, this would import from @valueos/mcp-ground-truth.
  // For now, return null — MCPGroundTruthService falls back to HTTP API mode.
  return null;
}
