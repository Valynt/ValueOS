import express from "express";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { createVersionedApiRouter } from "../versioning.js";

const servers: Array<ReturnType<express.Application["listen"]>> = [];

async function call(app: express.Application, path: string, headers: Record<string, string> = {}) {
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
  const body = await response.json();
  return { response, body };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

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
    const { response, body } = await call(createApp(), "/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("api-version")).toBe("v1");
    expect(body.apiVersion).toBe("v1");
  });

  it("accepts path-based versioning and preserves compatibility", async () => {
    const { response, body } = await call(createApp(), "/v1/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("api-version")).toBe("v1");
    expect(body.path).toBe("/health");
  });

  it("accepts header-based versioning", async () => {
    const { response } = await call(createApp(), "/health", { "x-api-version": "v1" });
    expect(response.status).toBe(200);
    expect(response.headers.get("api-version")).toBe("v1");
  });

  it("rejects unsupported versions with stable error contract", async () => {
    const { response, body } = await call(createApp(), "/v2/health");
    expect(response.status).toBe(426);
    expect(response.headers.get("api-version")).toBe("v1");
    expect(body.error).toBe("unsupported_version");
  });
});
