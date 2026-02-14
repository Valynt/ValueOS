import express from "express";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { createVersionedApiRouter } from "../versioning";

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
  versioned.get("/contract", (req, res) => {
    res.json({ ok: true, apiVersion: res.locals.apiVersion, path: req.path });
  });
  app.use(versioned);
  return app;
}

describe("versioned router contract compatibility", () => {
  it("keeps v1 as default compatibility target", async () => {
    const { response, body } = await call(createApp(), "/contract");
    expect(response.status).toBe(200);
    expect(response.headers.get("api-version")).toBe("v1");
    expect(body.apiVersion).toBe("v1");
  });

  it("supports explicit path versioning", async () => {
    const { response, body } = await call(createApp(), "/v1/contract");
    expect(response.status).toBe(200);
    expect(body.path).toBe("/contract");
  });

  it("returns unsupported_version for invalid versions", async () => {
    const { response, body } = await call(createApp(), "/v9/contract");
    expect(response.status).toBe(426);
    expect(body.error).toBe("unsupported_version");
  });
});
