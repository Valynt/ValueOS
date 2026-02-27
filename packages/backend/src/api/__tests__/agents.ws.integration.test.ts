import { afterAll, beforeAll, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import WebSocket from "ws";
import type { Server } from "http";
import { createBaseEvent } from "@shared/types/events";

let server: Server;
let wss: any;
let port: number;

const jwtSecret = "test-websocket-secret";
const waitForOpen = (ws: WebSocket) =>
  new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", (err) => reject(err));
  });

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = jwtSecret;

  const serverModule = await import("../../server");
  server = serverModule.server;
  wss = serverModule.wss;

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Failed to bind test server");
      port = address.port;
      resolve();
    });
  });
});

afterAll(async () => {
  wss.clients.forEach((c: any) => c.close());
  await new Promise<void>((resolve) => wss.close(() => resolve()));
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const createToken = (userId: string, tenantId: string) =>
  jwt.sign({ sub: userId, tenant_id: tenantId, email: `${userId}@example.com` }, jwtSecret, {
    expiresIn: "1h",
  });

describe("Agent reasonings websocket broadcast", () => {
  it("receives agent.reasoning.update broadcast for tenant", async () => {
    const token = createToken("u1", "tenant-1");

    const ws = new WebSocket(`ws://localhost:${port}/ws/sdui`, {
      headers: { authorization: `Bearer ${token}` },
    });
    await waitForOpen(ws);

    // Mock UnifiedAgentAPI to return resolved issue
    const unifiedMock = await import("../services/UnifiedAgentAPI");
    (unifiedMock.getUnifiedAgentAPI as any) = () => ({
      invoke: async () => ({
        data: { resolvedIssueId: "issue-xyz", resolution: "accept" },
        metadata: { confidence: 0.95 },
      }),
    });

    const svcModule = await import("../services/AgentExecutorService");
    const svc = svcModule.getAgentExecutorService();

    const event = createBaseEvent(
      "agent.request",
      {
        agentId: "IntegrityAgent",
        tenantId: "tenant-1",
        userId: "u1",
        sessionId: "s1",
        query: "resolve",
        context: {},
        parameters: { issueId: "issue-xyz", resolution: "accept" },
        priority: "normal",
        timeout: 30000,
      },
      {} as any
    );

    const messagePromise = new Promise<any>((resolve, reject) => {
      ws.once("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          resolve(msg);
        } catch (err) {
          reject(err);
        }
      });

      setTimeout(() => reject(new Error("Timeout waiting for message")), 3000);
    });

    await (svc as any).handleAgentRequest(event as any);

    const message = await messagePromise;
    expect(message).toBeDefined();
    // Our RealtimeBroadcastService sends plain JSON messages; check payload
    const parsed = typeof message === "string" ? JSON.parse(message) : message;
    // For agent.event envelope
    if (parsed.type === "agent.event") {
      const payload = parsed.payload || {};
      expect(payload.eventType).toBe("agent.reasoning.update");
      expect(payload.data.response.resolvedIssueId).toBe("issue-xyz");
    } else {
      // older format: direct message with type and payload
      expect(parsed.type).toBe("agent.reasoning.update");
      expect(parsed.payload.response.resolvedIssueId).toBe("issue-xyz");
    }

    ws.close();
  });
});
