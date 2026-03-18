import {
  buildAgentCapabilitiesDocument,
  getEnabledAgentDeploymentIds,
  type KnownToolId,
  mcpCapabilitiesDocumentSchema,
  toolSchemaMetadataByToolId,
} from "@mcp/common";
import express from "express";

const router = express.Router();

router.get("/agents/:agentId", (req, res) => {
  const { agentId } = req.params;
  const enabled = new Set(getEnabledAgentDeploymentIds());

  if (!enabled.has(agentId)) {
    return res.status(404).json({ error: `Unknown agent '${agentId}'` });
  }

  return res.json({
    agentId,
    status: "available",
    endpoint: `/api/mcp/agents/${agentId}`,
  });
});

router.get("/agents/:agentId/health", (req, res) => {
  const { agentId } = req.params;
  const enabled = new Set(getEnabledAgentDeploymentIds());

  if (!enabled.has(agentId)) {
    return res.status(404).json({ error: `Unknown agent '${agentId}'` });
  }

  return res.json({
    ok: true,
    agentId,
    updatedAt: new Date().toISOString(),
  });
});

router.get("/agents/:agentId/tools/:toolId", (req, res) => {
  const { agentId } = req.params;
  const toolId = req.params.toolId as KnownToolId;
  const enabled = new Set(getEnabledAgentDeploymentIds());

  if (!enabled.has(agentId)) {
    return res.status(404).json({ error: `Unknown agent '${agentId}'` });
  }

  const schemaMetadata = toolSchemaMetadataByToolId[toolId];
  if (!schemaMetadata) {
    return res.status(404).json({ error: `Unknown tool '${req.params.toolId}'` });
  }

  return res.json({
    agentId,
    toolId,
    ...schemaMetadata,
  });
});

export const mcpDiscoveryRouter = router;

export const serveMcpCapabilitiesDocument = (req: express.Request, res: express.Response): void => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const document = buildAgentCapabilitiesDocument(baseUrl);
  const parsed = mcpCapabilitiesDocumentSchema.parse(document);

  res.set("Cache-Control", "public, max-age=60");
  res.json(parsed);
};
