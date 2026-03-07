import express, { type Request, type Response } from "express";
import { SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  tenantContextMiddleware,
  type TCTPayload,
} from "@backend/middleware/tenantContext";

const tctSecret = "test-tct-secret";

vi.mock("@shared/lib/tenantVerification", () => ({
  getUserTenantId: vi.fn(),
  verifyTenantExists: vi.fn(
    async (tenantId: string) => tenantId !== "missing-tenant"
  ),
  verifyTenantMembership: vi.fn(async (userId: string, tenantId: string) => {
    if (userId === "user-1" && tenantId === "tenant-1") return true;
    if (userId === "user-2" && tenantId === "tenant-2") return true;
    return false;
  }),
}));

type ResourceRecord = {
  id: string;
  tenantId: string;
  payload: string;
};

const resources = new Map<string, ResourceRecord>();
const encoder = new TextEncoder();

const signContext = async (payload: TCTPayload): Promise<string> =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .sign(encoder.encode(tctSecret));

const buildContext = (userId: string, tenantId: string): TCTPayload => ({
  iss: "jwt",
  sub: userId,
  tid: tenantId,
  roles: ["member"],
  tier: "test",
  exp: Math.floor(Date.now() / 1000) + 3600,
});

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(tenantContextMiddleware(true));

  app.post("/api/resources", (req: Request, res: Response) => {
    const tenantId = (req as { tenantId?: string }).tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: "tenant_required" });
    }

    const id = `api-sec-${Date.now()}`;
    resources.set(id, {
      id,
      tenantId,
      payload: String(req.body.payload ?? "payload"),
    });

    return res.status(201).json({ id, tenantId });
  });

  app.get("/api/resources/:resourceId", (req: Request, res: Response) => {
    const tenantId = (req as { tenantId?: string }).tenantId;
    const record = resources.get(req.params.resourceId);

    if (!record || record.tenantId !== tenantId) {
      return res.status(404).json({ error: "Not Found" });
    }

    return res.status(200).json(record);
  });

  app.patch("/api/resources/:resourceId", (req: Request, res: Response) => {
    const tenantId = (req as { tenantId?: string }).tenantId;
    const record = resources.get(req.params.resourceId);

    if (!record || record.tenantId !== tenantId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    record.payload = String(req.body.payload ?? record.payload);
    return res.status(200).json(record);
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

describe("API Tenant Isolation hard gate", () => {
  afterEach(() => {
    resources.clear();
    vi.clearAllMocks();
  });

  it("uses tenant-distinct JWT context and blocks cross-tenant reads with 404", async () => {
    process.env.TCT_SECRET = tctSecret;

    const app = createApp();
    const tenantOneToken = await signContext(
      buildContext("user-1", "tenant-1")
    );
    const tenantTwoToken = await signContext(
      buildContext("user-2", "tenant-2")
    );

    await withTestServer(app, async baseUrl => {
      const createResponse = await fetch(`${baseUrl}/api/resources`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenant-context": tenantOneToken,
        },
        body: JSON.stringify({ payload: "secret-for-tenant-1" }),
      });
      expect(createResponse.status).toBe(201);
      const created = (await createResponse.json()) as { id: string };

      const crossTenantRead = await fetch(
        `${baseUrl}/api/resources/${created.id}`,
        {
          headers: { "x-tenant-context": tenantTwoToken },
        }
      );
      expect(crossTenantRead.status).toBe(404);
    });
  });

  it("standardizes cross-tenant write semantics to 403", async () => {
    process.env.TCT_SECRET = tctSecret;

    const app = createApp();
    const tenantOneToken = await signContext(
      buildContext("user-1", "tenant-1")
    );
    const tenantTwoToken = await signContext(
      buildContext("user-2", "tenant-2")
    );

    await withTestServer(app, async baseUrl => {
      const createResponse = await fetch(`${baseUrl}/api/resources`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenant-context": tenantOneToken,
        },
        body: JSON.stringify({ payload: "immutable" }),
      });
      expect(createResponse.status).toBe(201);
      const created = (await createResponse.json()) as { id: string };

      const crossTenantWrite = await fetch(
        `${baseUrl}/api/resources/${created.id}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-tenant-context": tenantTwoToken,
          },
          body: JSON.stringify({ payload: "cross-tenant-overwrite" }),
        }
      );

      expect(crossTenantWrite.status).toBe(403);
    });
  });

  it("keeps setup/bootstrap separate from tenant-scoped access assertions", async () => {
    process.env.TCT_SECRET = tctSecret;

    const recordId = "api-sec-bootstrap-id";
    resources.set(recordId, {
      id: recordId,
      tenantId: "tenant-1",
      payload: "bootstrapped-with-service-role",
    });

    const app = createApp();
    const tenantTwoToken = await signContext(
      buildContext("user-2", "tenant-2")
    );

    await withTestServer(app, async baseUrl => {
      const crossTenantRead = await fetch(
        `${baseUrl}/api/resources/${recordId}`,
        {
          headers: { "x-tenant-context": tenantTwoToken },
        }
      );
      expect(crossTenantRead.status).toBe(404);
    });
  });
});
