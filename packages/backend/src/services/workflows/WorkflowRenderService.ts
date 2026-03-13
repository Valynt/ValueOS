import { SDUIPageDefinition } from "@valueos/sdui";

import { AgentType } from "../agent-types";
import type { AgentContext, AgentAPI, AgentResponse as APIAgentResponse } from "../AgentAPI";
import type { AgentResponse, ExecutionEnvelope, StreamingUpdate } from "../../types/orchestration.js";
import { createAgentFactory } from "../../lib/agent-fabric/AgentFactory.js";
import { LLMGateway } from "../../lib/agent-fabric/LLMGateway.js";
import { MemorySystem } from "../../lib/agent-fabric/MemorySystem.js";
import { SupabaseMemoryBackend } from "../../lib/agent-fabric/SupabaseMemoryBackend.js";
import { CircuitBreaker } from "../../lib/resilience/CircuitBreaker.js";
import { assertTenantContextMatch } from "../../lib/tenant/assertTenantContextMatch.js";

let _renderFactory: ReturnType<typeof createAgentFactory> | null = null;
function getRenderFactory(): ReturnType<typeof createAgentFactory> {
  if (!_renderFactory) {
    _renderFactory = createAgentFactory({
      llmGateway: new LLMGateway({ provider: 'together', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' }),
      memorySystem: new MemorySystem({ max_memories: 1000, enable_persistence: true }, new SupabaseMemoryBackend()),
      circuitBreaker: new CircuitBreaker(),
    });
  }
  return _renderFactory;
}

export interface WorkflowRenderService {
  generateSDUIPage(
    envelope: ExecutionEnvelope,
    agent: AgentType,
    query: string,
    context?: AgentContext,
    streamingCallback?: (update: StreamingUpdate) => void
  ): Promise<AgentResponse>;
  generateAndRenderPage(
    envelope: ExecutionEnvelope,
    agent: AgentType,
    query: string,
    context?: AgentContext,
    renderOptions?: Record<string, unknown>
  ): Promise<{ response: AgentResponse; rendered: unknown }>;
}

export class DefaultWorkflowRenderService implements WorkflowRenderService {
  private renderPage: ((page: SDUIPageDefinition, options?: Record<string, unknown>) => unknown) | null = null;

  constructor(
    private readonly agentAPI: AgentAPI,
    private readonly validateEnvelope: (envelope: ExecutionEnvelope) => void,
    private readonly isEnabled: () => boolean,
  ) {}

  async generateSDUIPage(
    envelope: ExecutionEnvelope,
    agent: AgentType,
    query: string,
    context?: AgentContext,
    streamingCallback?: (update: StreamingUpdate) => void
  ): Promise<AgentResponse> {
    this.validateEnvelope(envelope);
    if (!this.isEnabled()) {
      throw new Error("SDUI generation is disabled");
    }

    streamingCallback?.({ stage: "analyzing", message: `Invoking ${agent} agent...`, progress: 10 });

    let response: APIAgentResponse<SDUIPageDefinition>;
    switch (agent) {
      case "opportunity":
        response = await this.agentAPI.generateValueCase(query, context);
        break;
      case "realization":
        response = await this.agentAPI.generateRealizationDashboard(query, context);
        break;
      case "expansion":
        response = await this.agentAPI.generateExpansionOpportunities(query, context);
        break;
      default: {
        // ADR-0014: direct factory invocation — no HTTP round-trip
        const orgId = context?.organizationId ?? envelope.organizationId;
        assertTenantContextMatch({
          expectedOrganizationId: envelope.organizationId,
          contextOrganizationId: orgId,
          source: 'WorkflowRenderService.generateSDUIPage',
        });
        const agentInstance = getRenderFactory().create(agent, envelope.organizationId);
        const output = await agentInstance.execute({
          workspace_id: context?.sessionId ?? '',
          user_id: context?.userId ?? '',
          organization_id: envelope.organizationId,
          session_id: context?.sessionId ?? '',
          query,
        });
        response = {
          success: output.status === 'success' || output.status === 'partial_success',
          data: output.result as SDUIPageDefinition,
          error: output.errors?.[0]?.message,
        };
      }
    }

    streamingCallback?.({ stage: "processing", message: "Processing agent response...", progress: 60 });

    if (!response.success) {
      throw new Error(response.error || "Agent request failed");
    }

    streamingCallback?.({ stage: "complete", message: "SDUI page generated successfully", progress: 100 });

    return {
      type: "sdui-page",
      payload: response.data ?? null,
      sduiPage: response.data,
    };
  }

  async generateAndRenderPage(
    envelope: ExecutionEnvelope,
    agent: AgentType,
    query: string,
    context?: AgentContext,
    renderOptions?: Record<string, unknown>
  ): Promise<{ response: AgentResponse; rendered: unknown }> {
    const response = await this.generateSDUIPage(envelope, agent, query, context);

    if (!response.sduiPage) {
      throw new Error("No SDUI page in response");
    }

    const renderPage = await this.getRenderPage();
    const rendered = renderPage(response.sduiPage, renderOptions);
    return { response, rendered };
  }

  private async getRenderPage() {
    if (!this.renderPage) {
      const mod = await import("@sdui/renderPage");
      this.renderPage = mod.renderPage;
    }
    return this.renderPage;
  }
}
