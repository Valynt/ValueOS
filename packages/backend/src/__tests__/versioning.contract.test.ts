import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createVersionedApiRouter } from "../versioning.js";

async function call(
  app: express.Application,
  path: string,
  headers: Record<string, string> = {},
) {
  const response = await request(app).get(path).set(headers);
  return {
    response,
    body: response.body,
    getHeader: (name: string) => response.headers[name.toLowerCase()],
  };
}

function createApp() {
  const app = express();
  const versioned = createVersionedApiRouter();
  versioned.get("/health", (req, res) => {
    res.json({ ok: true, apiVersion: res.locals.apiVersion, path: req.path });
  });
  app.use(versioned);
  return app;
}

describe("API versioning compatibility contracts", () => {
  it("defaults to v1 when no explicit version is provided", async () => {
    const { response, body, getHeader } = await call(createApp(), "/health");
    expect(response.status).toBe(200);
    expect(getHeader("api-version")).toBe("v1");
    expect(body.apiVersion).toBe("v1");
  });

  it("accepts path-based versioning and preserves compatibility", async () => {
    const { response, body, getHeader } = await call(createApp(), "/v1/health");
    expect(response.status).toBe(200);
    expect(getHeader("api-version")).toBe("v1");
    expect(body.path).toBe("/health");
  });

  it("accepts header-based versioning", async () => {
    const { response, getHeader } = await call(createApp(), "/health", {
      "x-api-version": "v1",
    });
    expect(response.status).toBe(200);
    expect(getHeader("api-version")).toBe("v1");
  });

  it("rejects unsupported versions with stable error contract", async () => {
    const { response, body, getHeader } = await call(createApp(), "/v2/health");
    expect(response.status).toBe(426);
    expect(getHeader("api-version")).toBe("v1");
    expect(body.error).toBe("unsupported_version");
  });

  it("sets API-Deprecated-Versions header on supported deprecated version", async () => {
    const app = express();
    const versioned = createVersionedApiRouter({ _deprecatedVersionsOverride: ["v1"] });
    versioned.get("/health", (_req, res) => res.json({ ok: true }));
    app.use(versioned);

    const { response, getHeader } = await call(app, "/v1/health");
    expect(response.status).toBe(200);
    expect(getHeader("api-deprecated-versions")).toBe("v1");
  });

  it("sets API-Deprecated-Versions header on unsupported version response", async () => {
    const app = express();
    const versioned = createVersionedApiRouter({ _deprecatedVersionsOverride: ["v1"] });
    versioned.get("/health", (_req, res) => res.json({ ok: true }));
    app.use(versioned);

    const { response, getHeader } = await call(app, "/v2/health");
    expect(response.status).toBe(426);
    expect(getHeader("api-deprecated-versions")).toBe("v1");
  });
});
