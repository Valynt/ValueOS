import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  getAllAgentDeploymentIds,
  mcpCapabilitiesDocumentSchema,
} from "@mcp/common";
import {
  mcpDiscoveryRouter,
  serveMcpCapabilitiesDocument,
} from "../mcpDiscovery.js";

const app = express();
app.get("/.well-known/mcp-capabilities.json", serveMcpCapabilitiesDocument);
app.use("/api/mcp", mcpDiscoveryRouter);

const testDir = path.dirname(fileURLToPath(import.meta.url));
const k8sAgentsPath = path.resolve(testDir, "../../../../../infra/k8s/base/agents");

const getK8sAgentIds = (): string[] =>
  fs
    .readdirSync(k8sAgentsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

describe("MCP discovery contract", () => {
  it("serves the discovery JSON from /.well-known/mcp-capabilities.json", async () => {
    const response = await request(app).get("/.well-known/mcp-capabilities.json").expect(200);
    const parsed = mcpCapabilitiesDocumentSchema.parse(response.body);

    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.capabilities.length).toBeGreaterThan(0);
  });

  it("contains capability entries for every infra/k8s/base/agents deployment", async () => {
    const response = await request(app).get("/.well-known/mcp-capabilities.json").expect(200);
    const advertisedAgentIds = response.body.capabilities
      .map((entry: { agentId: string }) => entry.agentId)
      .sort();

    expect(advertisedAgentIds).toEqual(getK8sAgentIds());
    expect(advertisedAgentIds).toEqual(getAllAgentDeploymentIds().sort());
  });

  it("exposes schema metadata for every advertised tool endpoint", async () => {
    const response = await request(app).get("/.well-known/mcp-capabilities.json").expect(200);

    for (const capability of response.body.capabilities as Array<{
      agentId: string;
      tools: Array<{ id: string; manifestUrl: string }>;
    }>) {
      for (const tool of capability.tools) {
        const toolResponse = await request(app).get(new URL(tool.manifestUrl).pathname).expect(200);

        expect(toolResponse.body.agentId).toBe(capability.agentId);
        expect(toolResponse.body.toolId).toBe(tool.id);
        expect(toolResponse.body.inputSchema.type).toBe("object");
        expect(toolResponse.body.outputSchema.type).toBe("object");
      }
    }
  });
});
