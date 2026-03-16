import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestRedisClient = {
  scan: (cursor: string, options: { MATCH: string; COUNT: number }) => Promise<[string, string[]]>;
  del: (keys: string | string[]) => Promise<number>;
};

const ORIGINAL_ENV = { ...process.env };

function matchesPattern(key: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return key.startsWith(pattern.slice(0, -1));
  }
  return key === pattern;
}

function createRedisClient(initialKeys: string[]): { client: TestRedisClient; keys: Set<string> } {
  const keys = new Set(initialKeys);

  const client: TestRedisClient = {
    scan: vi.fn(async (_cursor, options) => {
      const matched = [...keys].filter((key) => matchesPattern(key, options.MATCH));
      return ["0", matched];
    }),
    del: vi.fn(async (keysToDelete) => {
      const keysArray = Array.isArray(keysToDelete) ? keysToDelete : [keysToDelete];
      let deleted = 0;
      for (const key of keysArray) {
        if (keys.delete(key)) {
          deleted += 1;
        }
      }
      return deleted;
    }),
  };

  return { client, keys };
}

async function createDevApp(client: TestRedisClient): Promise<express.Express> {
  vi.resetModules();
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "development",
    ENABLE_DEV_ROUTES: "true",
  };

  vi.doMock("../../middleware/auth.js", () => ({
    requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.user = { id: "user-1", role: "admin" } as express.Request["user"];
      next();
    },
  }));

  vi.doMock("../../lib/redis.js", () => ({
    getRedisClient: vi.fn().mockResolvedValue(client),
  }));

  const { default: devRouter } = await import("../dev.js");
  const app = express();
  app.use(express.json());
  app.use("/api/dev", devRouter);

  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("dev cache clear route", () => {
  it("only removes keys matching the tenant prefix and keeps unrelated keys", async () => {
    const redis = createRedisClient([
      "valueos:tenant:tenant-1:session:1",
      "valueos:tenant:tenant-2:session:1",
      "valueos:metrics:last-run",
      "other:tenant:tenant-1:data",
    ]);

    const app = await createDevApp(redis.client);

    const response = await request(app)
      .post("/api/dev/clear-cache")
      .set("Host", "localhost")
      .send({ scope: "tenant", tenantId: "tenant-1" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.scope).toBe("tenant");
    expect(response.body.deletedKeyCount).toBe(1);

    expect(redis.keys.has("valueos:tenant:tenant-1:session:1")).toBe(false);
    expect(redis.keys.has("valueos:tenant:tenant-2:session:1")).toBe(true);
    expect(redis.keys.has("valueos:metrics:last-run")).toBe(true);
    expect(redis.keys.has("other:tenant:tenant-1:data")).toBe(true);
  });

  it("rejects empty scope and unsupported global scope", async () => {
    const redis = createRedisClient(["valueos:tenant:tenant-1:session:1"]);
    const app = await createDevApp(redis.client);

    const missingScopeResponse = await request(app)
      .post("/api/dev/clear-cache")
      .set("Host", "localhost")
      .send({});

    expect(missingScopeResponse.status).toBe(400);
    expect(missingScopeResponse.body.success).toBe(false);

    const globalScopeResponse = await request(app)
      .post("/api/dev/clear-cache")
      .set("Host", "localhost")
      .send({ scope: "global" });

    expect(globalScopeResponse.status).toBe(400);
    expect(globalScopeResponse.body.success).toBe(false);
  });
});
