import { z } from "zod";

export const capabilityToolSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  manifestUrl: z.string().min(1),
});

export const agentCapabilityEntrySchema = z.object({
  agentId: z.string().min(1),
  endpoint: z.string().min(1),
  authMode: z.enum(["service", "user", "public"]),
  tools: z.array(capabilityToolSchema),
  version: z.string().min(1),
  healthUrl: z.string().min(1),
});

export const mcpCapabilitiesDocumentSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  generatedAt: z.string().datetime(),
  capabilities: z.array(agentCapabilityEntrySchema),
});

const AGENT_DEPLOYMENT_IDS = [
  "benchmark",
  "communicator",
  "company-intelligence",
  "coordinator",
  "expansion",
  "financial-modeling",
  "groundtruth",
  "integrity",
  "intervention-designer",
  "narrative",
  "opportunity",
  "outcome-engineer",
  "realization",
  "research",
  "system-mapper",
  "target",
  "value-eval",
  "value-mapping",
] as const;

export type AgentDeploymentId = (typeof AGENT_DEPLOYMENT_IDS)[number];

const DEFAULT_AGENT_TOOLS = [
  {
    id: "execute",
    description: "Run this agent with lifecycle input context",
  },
  {
    id: "status",
    description: "Return runtime status and queue depth metadata",
  },
] as const;

export const getAllAgentDeploymentIds = (): string[] => [...AGENT_DEPLOYMENT_IDS];

export const getEnabledAgentDeploymentIds = (enabledIdsEnv = process.env.MCP_ENABLED_AGENTS): string[] => {
  if (!enabledIdsEnv || enabledIdsEnv.trim().length === 0) {
    return getAllAgentDeploymentIds();
  }

  const requested = new Set(
    enabledIdsEnv
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );

  return AGENT_DEPLOYMENT_IDS.filter((agentId) => requested.has(agentId));
};

export const buildAgentCapabilitiesDocument = (baseUrl = ""): z.infer<typeof mcpCapabilitiesDocumentSchema> => {
  const capabilities = getEnabledAgentDeploymentIds().map((agentId) => ({
    agentId,
    endpoint: `${baseUrl}/api/mcp/agents/${agentId}`,
    authMode: "service" as const,
    tools: DEFAULT_AGENT_TOOLS.map((tool) => ({
      id: tool.id,
      description: tool.description,
      manifestUrl: `${baseUrl}/api/mcp/agents/${agentId}/tools/${tool.id}`,
    })),
    version: "1.0.0",
    healthUrl: `${baseUrl}/api/mcp/agents/${agentId}/health`,
  }));

  return {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    capabilities,
  };
};

export const toolSchemaMetadataByToolId = {
  execute: {
    inputSchema: {
      type: "object",
      required: ["sessionId", "organizationId", "input"],
      properties: {
        sessionId: { type: "string" },
        organizationId: { type: "string" },
        input: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        confidence: { type: "number" },
        result: { type: "object", additionalProperties: true },
      },
      required: ["status", "result"],
      additionalProperties: true,
    },
  },
  status: {
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        queueDepth: { type: "number" },
        updatedAt: { type: "string", format: "date-time" },
      },
      required: ["ok", "updatedAt"],
      additionalProperties: false,
    },
  },
} as const;

export type KnownToolId = keyof typeof toolSchemaMetadataByToolId;
