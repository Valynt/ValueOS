import type {
  McpAccessTestResult,
  McpCapabilityDescriptor,
  McpFailureReasonCode,
  McpIntegrationProvider,
  McpSyncResult,
} from './types.js';

export interface McpProviderHealthContext {
  tenantId: string;
  providerConfig: Record<string, unknown>;
}

export interface McpProviderInterface {
  readonly provider: McpIntegrationProvider;

  getCapabilities(): McpCapabilityDescriptor[];

  testAccess(context: McpProviderHealthContext): Promise<McpAccessTestResult>;

  healthCheck(context: McpProviderHealthContext): Promise<{
    ok: boolean;
    reasonCode: McpFailureReasonCode | null;
    message: string;
  }>;

  sync(context: McpProviderHealthContext): Promise<McpSyncResult>;
}
