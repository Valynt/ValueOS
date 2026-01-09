import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { server, wss } from "../../src/backend/server";
import { __setEnvSourceForTests } from "../../src/lib/env";

const JWT_SECRET = "test-jwt-secret";

function createToken(tenantId: string, userId: string) {
  return jwt.sign(
    {
      sub: userId,
      email: `${userId}@example.com`,
      tenant_id: tenantId,
    },
    JWT_SECRET,
    { algorithm: "HS256" }
  );
}

function waitForClose(ws: WebSocket, timeoutMs = 500) {
  return new Promise<{ code: number; reason: string }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("timeout"));
    }, timeoutMs);

    ws.once("close", (code, reason) => {
      clearTimeout(timeout);
      resolve({ code, reason: reason.toString() });
    });
    ws.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function waitForMessage(ws: WebSocket, timeoutMs = 500) {
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("timeout"));
    }, timeoutMs);

    ws.once("message", (data) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()));
    });
    ws.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function connectWithToken(port: number, token?: string, tenantId?: string) {
  const params = new URLSearchParams();
  if (token) {
    params.set("token", token);
  }
  if (tenantId) {
    params.set("tenantId", tenantId);
  }

  const url = `ws://localhost:${port}/ws/sdui${
    params.size ? `?${params.toString()}` : ""
  }`;

  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("open", () => resolve(ws));
    ws.once("error", (error) => reject(error));
  });
}

describe("WebSocket auth and tenant isolation", () => {
  let port: number;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    __setEnvSourceForTests({ ...process.env, JWT_SECRET });
    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to start server");
    }
    port = address.port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("rejects unauthenticated WebSocket connections", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/sdui`);
    const result = await waitForClose(ws);
    expect(result.code).toBe(1008);
  });

  it("blocks cross-tenant sdui_update broadcasts", async () => {
    const tokenTenantA1 = createToken("tenant-a", "user-a1");
    const tokenTenantA2 = createToken("tenant-a", "user-a2");
    const tokenTenantB = createToken("tenant-b", "user-b1");

    const [sender, receiver, otherTenant] = await Promise.all([
      connectWithToken(port, tokenTenantA1),
      connectWithToken(port, tokenTenantA2),
      connectWithToken(port, tokenTenantB),
    ]);

    try {
      sender.send(
        JSON.stringify({
          type: "sdui_update",
          messageId: "msg-1",
          payload: { update: "ok" },
        })
      );

      const received = await waitForMessage(receiver);
      expect(received.type).toBe("sdui_update");

      await expect(waitForMessage(otherTenant, 200)).rejects.toThrow("timeout");
    } finally {
      sender.close();
      receiver.close();
      otherTenant.close();
    }
  });
});
