/**
 * ValyntApp MCP CRM adapter.
 *
 * Canonical runtime ownership lives in packages/mcp/crm/core/MCPCRMServer.ts.
 * This file keeps only app-specific glue behavior to avoid drift.
 */

import {
  CRM_TOOLS,
  getMCPCRMServer as getCanonicalMCPCRMServer,
  type MCPCRMServer as CanonicalMCPCRMServer,
} from "../../../../../packages/mcp/crm/index.ts";
import type { MCPCRMConfig, MCPCRMToolResult } from "../types";

interface MCPCRMServerRuntime {
  initialize(): Promise<void>;
  isConnected(): boolean;
  getTools(): typeof CRM_TOOLS;
  getConnectedProviders(): string[];
  executeTool(toolName: string, args: Record<string, unknown>): Promise<MCPCRMToolResult>;
}

export class MCPCRMServer implements MCPCRMServerRuntime {
  private readonly config: MCPCRMConfig;
  private readonly runtime: Promise<CanonicalMCPCRMServer>;
  private resolvedRuntime: CanonicalMCPCRMServer | null = null;

  constructor(config: MCPCRMConfig, runtime?: Promise<CanonicalMCPCRMServer>) {
    this.config = config;
    this.runtime =
      runtime ?? getCanonicalMCPCRMServer(config.tenantId, config.userId);
    this.runtime.then((delegate) => {
      this.resolvedRuntime = delegate;
    });
  }

  async initialize(): Promise<void> {
    const delegate = await this.runtime;
    await delegate.initialize();
  }

  isConnected(): boolean {
    return this.resolvedRuntime?.isConnected() ?? false;
  }

  getTools(): typeof CRM_TOOLS {
    return CRM_TOOLS;
  }

  getConnectedProviders(): string[] {
    return this.resolvedRuntime?.getConnectedProviders() ?? [];
  }

  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPCRMToolResult> {
    const delegate = await this.runtime;
    const result = await delegate.executeTool(toolName, args);

    // Preserve app-only status field used by UI runtime checks.
    if (toolName === "crm_check_connection" && result.success) {
      const data = (result.data ?? {}) as {
        providers?: unknown[];
        [key: string]: unknown;
      };
      const providers = Array.isArray(data.providers) ? data.providers : [];
      return {
        ...result,
        data: {
          ...data,
          status: providers.length > 0 ? "connected" : "disconnected",
        },
      };
    }

    return result;
  }

  async asCanonical(): Promise<CanonicalMCPCRMServer> {
    return this.runtime;
  }
}

const appServerInstances = new Map<string, Promise<MCPCRMServer>>();

export async function getMCPCRMServer(
  tenantId: string,
  userId: string
): Promise<MCPCRMServer> {
  const key = `${tenantId}:${userId}`;
  const cached = appServerInstances.get(key);
  if (cached) {
    return cached;
  }

  const runtime = getCanonicalMCPCRMServer(tenantId, userId);
  const adapter = Promise.resolve(
    new MCPCRMServer(
      {
        tenantId,
        userId,
        enabledProviders: ["hubspot", "salesforce"],
        refreshTokensAutomatically: true,
      },
      runtime
    )
  );
  appServerInstances.set(key, adapter);
  return adapter;
}

export { CRM_TOOLS };
