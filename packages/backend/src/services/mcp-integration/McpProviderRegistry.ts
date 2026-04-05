import type { McpProviderInterface } from './McpProviderInterface.js';
import type { McpCapabilityDescriptor, McpIntegrationProvider } from './types.js';

class StaticMcpProvider implements McpProviderInterface {
  constructor(
    public readonly provider: McpIntegrationProvider,
    private readonly capabilities: McpCapabilityDescriptor[]
  ) {}

  getCapabilities(): McpCapabilityDescriptor[] {
    return this.capabilities;
  }

  async testAccess() {
    return {
      ok: true,
      status: 'connected' as const,
      reasonCode: null,
      checkedAt: new Date().toISOString(),
      latencyMs: 1,
      message: `${this.provider} access validated`,
    };
  }

  async healthCheck() {
    return {
      ok: true,
      reasonCode: null,
      message: `${this.provider} provider healthy`,
    };
  }

  async sync() {
    return {
      ok: true,
      syncedRecords: 0,
      degraded: false,
      reasonCode: null,
      message: `${this.provider} sync completed`,
    };
  }
}

const providers = new Map<McpIntegrationProvider, McpProviderInterface>();

providers.set(
  'openai',
  new StaticMcpProvider('openai', [
    {
      key: 'thread_sync',
      label: 'Thread Sync',
      description: 'Synchronize MCP thread metadata and state.',
      syncMode: 'pull',
      requiresWriteAccess: false,
    },
    {
      key: 'tool_execution',
      label: 'Tool Execution',
      description: 'Execute tenant-approved MCP tools.',
      syncMode: 'hybrid',
      requiresWriteAccess: true,
    },
  ])
);

providers.set(
  'anthropic',
  new StaticMcpProvider('anthropic', [
    {
      key: 'context_ingestion',
      label: 'Context Ingestion',
      description: 'Ingest approved MCP context blocks.',
      syncMode: 'pull',
      requiresWriteAccess: false,
    },
  ])
);

providers.set(
  'internal',
  new StaticMcpProvider('internal', [
    {
      key: 'workflow_bridge',
      label: 'Workflow Bridge',
      description: 'Bridge internal workflow state into MCP actions.',
      syncMode: 'push',
      requiresWriteAccess: true,
    },
  ])
);

export function getMcpProvider(provider: McpIntegrationProvider): McpProviderInterface {
  const implementation = providers.get(provider);
  if (!implementation) {
    throw new Error(`Unsupported MCP provider: ${provider}`);
  }
  return implementation;
}

export function registerMcpProvider(
  provider: McpIntegrationProvider,
  implementation: McpProviderInterface
): void {
  providers.set(provider, implementation);
}

export function getSupportedMcpProviders(): McpIntegrationProvider[] {
  return Array.from(providers.keys());
}
