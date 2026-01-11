import { afterAll, beforeAll, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import WebSocket, { type WebSocketServer } from "ws";
import type { Server } from "http";

const jwtSecret = "test-websocket-secret";
const WS_POLICY_VIOLATION_CODE = 1008;
const CROSS_TENANT_WAIT_MS = 200;
let server: Server;
let wss: WebSocketServer;
let port: number;

const waitForOpen = (ws: WebSocket) =>
  new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", (error) => reject(error));
  });

const waitForClose = (ws: WebSocket) =>
  new Promise<{ code: number; reason: string }>((resolve) => {
    ws.once("close", (code, reason) =>
      resolve({ code, reason: reason.toString() })
    );
  });

const closeWebSocket = async (ws: WebSocket) => {
  if (ws.readyState === WebSocket.CLOSED) {
    return;
  }
  ws.close();
  await waitForClose(ws);
};

const createToken = (userId: string, tenantId: string) =>
  jwt.sign(
    {
      sub: userId,
      tenant_id: tenantId,
      email: `${userId}@example.com`,
      role: "authenticated",
    },
    jwtSecret,
    { expiresIn: "1h" }
  );

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = jwtSecret;

  const serverModule = await import("../../src/backend/server");
  server = serverModule.server;
  wss = serverModule.wss;

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to bind WebSocket test server");
      }
      port = address.port;
      resolve();
    });
  });
});

afterAll(async () => {
  wss.clients.forEach((client) => client.close());

  await new Promise<void>((resolve) => {
    wss.close(() => resolve());
  });

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe("WebSocket auth", () => {
  it("rejects unauthenticated connections", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/sdui`);
    const closed = await waitForClose(ws);

    expect(closed.code).toBe(WS_POLICY_VIOLATION_CODE);
  });

  it("blocks cross-tenant sdui_update broadcasts", async () => {
    const tokenA = createToken("user-a", "tenant-a");
    const tokenB = createToken("user-b", "tenant-b");

    const wsTenantA = new WebSocket(`ws://localhost:${port}/ws/sdui`, {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const wsTenantB = new WebSocket(`ws://localhost:${port}/ws/sdui`, {
      headers: { authorization: `Bearer ${tokenB}` },
    });

    await Promise.all([waitForOpen(wsTenantA), waitForOpen(wsTenantB)]);

    const noCrossTenantMessage = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => resolve(), CROSS_TENANT_WAIT_MS);
      wsTenantB.once("message", () => {
        clearTimeout(timer);
        reject(new Error("Received cross-tenant broadcast"));
      });
    });

    wsTenantA.send(
      JSON.stringify({
        type: "sdui_update",
        payload: { message: "update" },
        messageId: "msg-1",
      })
    );

    await expect(noCrossTenantMessage).resolves.toBeUndefined();

    await Promise.all([closeWebSocket(wsTenantA), closeWebSocket(wsTenantB)]);
  });
});
