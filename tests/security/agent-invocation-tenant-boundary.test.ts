import express from "express";
import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";

import {
  tenantContextMiddleware,
  type TCTPayload,
} from "@backend/middleware/tenantContext";

const tctSecret = "agent-boundary-secret";

vi.mock("@shared/lib/tenantVerification", () => ({
  getUserTenantId: vi.fn(),
  verifyTenantExists: vi.fn(async () => true),
  verifyTenantMembership: vi.fn(async (userId: string, tenantId: string) => {
    return (
      (userId === "agent-user-a" && tenantId === "tenant-a") ||
      (userId === "agent-user-b" && tenantId === "tenant-b")
    );
  }),
}));

const encoder = new TextEncoder();

const signContext = async (payload: TCTPayload): Promise<string> =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .sign(encoder.encode(tctSecret));

const contextFor = (sub: string, tid: string): TCTPayload => ({
  iss: "jwt",
  sub,
  tid,
  roles: ["member"],
  tier: "test",
  exp: Math.floor(Date.now() / 1000) + 3600,
});

const createAgentApp = () => {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    (req as { user?: { id: string; tenant_id: string } }).user = {
      id: req.header("x-user-id") ?? "agent-user-a",
      tenant_id: req.header("x-claim-tenant") ?? "tenant-a",
    };
    next();
  });

  app.use(tenantContextMiddleware(true));

  app.post("/api/agents/invoke", (req, res) => {
    const tenantId = (req as { tenantId?: string }).tenantId;
    return res.status(202).json({ status: "accepted", tenantId });
  });

  app.post("/api/value/resource", (req, res) => {
    const tenantId = (req as { tenantId?: string }).tenantId;
    return res.status(200).json({ status: "ok", tenantId });
  });

  return app;
};

const withTestServer = async <T>(
  app: express.Express,
  cb: (baseUrl: string) => Promise<T>
): Promise<T> => {
  const server = await new Promise<import("node:http").Server>(resolve => {
    const created = app.listen(0, () => resolve(created));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine test server address");
  }

  try {
    return await cb(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
};

describe("Agent invocation tenant boundary hard gate", () => {
  it("rejects agent invocation when JWT-shaped context tenant diverges from authenticated claim", async () => {
    process.env.TCT_SECRET = tctSecret;

    const app = createAgentApp();
    const mismatchedToken = await signContext(
      contextFor("agent-user-a", "tenant-b")
    );

    await withTestServer(app, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/agents/invoke`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "agent-user-a",
          "x-claim-tenant": "tenant-a",
          "x-tenant-context": mismatchedToken,
        },
        body: JSON.stringify({ operation: "run" }),
      });

      expect(response.status).toBe(403);
      const payload = (await response.json()) as { error: string };
      expect(payload.error).toBe("tenant_mismatch");
    });
  });

  it("allows invocation when user claim and tenant context match", async () => {
    process.env.TCT_SECRET = tctSecret;

    const app = createAgentApp();
    const validToken = await signContext(
      contextFor("agent-user-a", "tenant-a")
    );

    await withTestServer(app, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/agents/invoke`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "agent-user-a",
          "x-claim-tenant": "tenant-a",
          "x-tenant-context": validToken,
        },
        body: JSON.stringify({ operation: "run" }),
      });

      expect(response.status).toBe(202);
      const payload = (await response.json()) as { tenantId: string };
      expect(payload.tenantId).toBe("tenant-a");
    });
  });

  it("returns 404 semantics when an authenticated user is not a member of requested tenant", async () => {
    process.env.TCT_SECRET = tctSecret;

    const app = createAgentApp();
    const nonMemberToken = await signContext(
      contextFor("agent-user-a", "tenant-b")
    );

    await withTestServer(app, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/value/resource`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "agent-user-a",
          "x-claim-tenant": "tenant-b",
          "x-tenant-context": nonMemberToken,
        },
        body: JSON.stringify({ operation: "read" }),
      });

      expect(response.status).toBe(404);
    });
  });
});
