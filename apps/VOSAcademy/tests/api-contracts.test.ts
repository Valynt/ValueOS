import fs from "node:fs";
import path from "node:path";

import { describe, expect, expectTypeOf, it } from "vitest";

import openapiSchema from "../docs/api/openapi.json" assert { type: "json" };

import { paths } from "@/lib/api-types";

const graphQlSchema = fs.readFileSync(path.join(process.cwd(), "docs/api/schema.graphql"), "utf8");

describe("API contracts", () => {
  it("documents core REST endpoints", () => {
    const { paths: documentedPaths, components } = openapiSchema as { paths: Record<string, unknown>; components: Record<string, unknown> };

    expect(documentedPaths["/ai/chat"]).toBeDefined();
    expect(documentedPaths["/ai/roi-narrative"]).toBeDefined();
    expect(documentedPaths["/pillars"]).toBeDefined();
    expect(documentedPaths["/simulations/{scenarioId}"]).toBeDefined();
    expect(documentedPaths["/certifications"]).toBeDefined();

    expect(components.schemas).toBeDefined();
    expect((components as any).schemas.Pillar).toMatchObject({ type: "object" });
  });

  it("keeps schema objects consistent", () => {
    const chatRequestSchemaRef = (openapiSchema as any).paths["/ai/chat"].post.requestBody.content["application/json"].schema;
    const chatRequestSchema = chatRequestSchemaRef.$ref
      ? (openapiSchema as any).components.schemas[chatRequestSchemaRef.$ref.split("/").pop() as string]
      : chatRequestSchemaRef;

    expect(chatRequestSchema.required).toContain("messages");
    expect(chatRequestSchema.properties.messages.items["$ref"]).toBe("#/components/schemas/Message");

    const simulationAttemptSchema = (openapiSchema as any).components.schemas.SimulationAttempt;
    expect(simulationAttemptSchema.required).toEqual(["scenarioId", "response"]);
    expect(simulationAttemptSchema.properties.stage.type).toBe("string");
  });

  it("generates SDK typings for contract clients", () => {
    type ChatRequest = paths["/ai/chat"]["post"]["requestBody"]["content"]["application/json"];
    type SimulationAttemptRequest = paths["/simulations/{scenarioId}/attempts"]["post"]["requestBody"]["content"]["application/json"];

    const sampleChat: ChatRequest = {
      messages: [{ role: "user", content: "hello" }]
    };
    const attempt: SimulationAttemptRequest = { scenarioId: 1, response: "response" };

    expect(sampleChat.messages[0].content).toBe("hello");
    expectTypeOf(sampleChat.messages[0].role).toEqualTypeOf<"system" | "user" | "assistant">();
    expectTypeOf(attempt.response).toBeString();
  });

  it("aligns GraphQL and REST contracts", () => {
    const essentialQueries = ["pillars", "pillar", "quizQuestions", "simulations", "simulation", "certifications"];
    essentialQueries.forEach(queryName => {
      expect(graphQlSchema).toContain(queryName);
    });

    const openApiPaths = Object.keys((openapiSchema as any).paths);
    ["/pillars", "/pillars/{pillarNumber}", "/simulations", "/simulations/{scenarioId}"].forEach(pathName => {
      expect(openApiPaths).toContain(pathName);
    });
  });
});
