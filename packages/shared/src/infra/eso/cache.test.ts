import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const counterAdd = vi.fn();
const histogramRecord = vi.fn();
const getRedisClientMock = vi.fn();

vi.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: () => ({
      createCounter: () => ({ add: counterAdd }),
      createHistogram: () => ({ record: histogramRecord }),
    }),
  },
}));

vi.mock("../../lib/redisClient.js", () => ({
  getRedisClient: getRedisClientMock,
}));

interface FakeRedisValue {
  value: string;
  expiresAt: number;
}

class FakeRedisClient {
  readonly store = new Map<string, FakeRedisValue>();
  readonly setCalls: Array<{ key: string; value: string; durationMs: number; condition?: "NX" }> = [];

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(
    key: string,
    value: string,
    mode: "PX",
    durationMs: number,
    condition?: "NX",
  ): Promise<string | null> {
    void mode;
    const existing = await this.get(key);
    if (condition === "NX" && existing) {
      return null;
    }

    this.setCalls.push({ key, value, durationMs, condition });
    this.store.set(key, {
      value,
      expiresAt: Date.now() + durationMs,
    });
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async dbsize(): Promise<number> {
    return this.store.size;
  }

  async eval(_script: string, _numKeys: number, key: string, _token: string): Promise<number> {
    if (!this.store.has(key)) {
      return 0;
    }

    this.store.delete(key);
    return 1;
  }
}

describe("ESOCache", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    counterAdd.mockClear();
    histogramRecord.mockClear();
    getRedisClientMock.mockReset();
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("coalesces concurrent misses into one loader in memory mode", async () => {
    const { ESOCache } = await import("./cache.js");
    const cache = new ESOCache(200);
    let loaderCalls = 0;

    const loader = async () => {
      loaderCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { value: loaderCalls };
    };

    const [first, second, third] = await Promise.all([
      cache.getOrLoad({ adapter: "BLS", key: "series-A" }, loader),
      cache.getOrLoad({ adapter: "BLS", key: "series-A" }, loader),
      cache.getOrLoad({ adapter: "BLS", key: "series-A" }, loader),
    ]);

    expect(first).toEqual({ value: 1 });
    expect(second).toEqual({ value: 1 });
    expect(third).toEqual({ value: 1 });
    expect(loaderCalls).toBe(1);

    const cached = await cache.getOrLoad({ adapter: "BLS", key: "series-A" }, loader);
    expect(cached).toEqual({ value: 1 });
    expect(loaderCalls).toBe(1);
  });

  it("serves stale entries while refreshing in the background", async () => {
    const { ESOCache } = await import("./cache.js");
    const cache = new ESOCache(25);
    let loaderCalls = 0;

    const loader = async () => {
      loaderCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { version: loaderCalls };
    };

    const first = await cache.getOrLoad(
      { adapter: "SEC", key: "filing-1", ttlMs: 25, staleTtlMs: 200 },
      loader,
    );
    expect(first).toEqual({ version: 1 });

    await new Promise((resolve) => setTimeout(resolve, 35));

    const stale = await cache.getOrLoad(
      { adapter: "SEC", key: "filing-1", ttlMs: 25, staleTtlMs: 200 },
      loader,
    );
    expect(stale).toEqual({ version: 1 });

    await new Promise((resolve) => setTimeout(resolve, 30));

    const refreshed = await cache.getOrLoad(
      { adapter: "SEC", key: "filing-1", ttlMs: 25, staleTtlMs: 200 },
      loader,
    );
    expect(refreshed).toEqual({ version: 2 });
    expect(loaderCalls).toBe(2);
  });

  it("uses Redis-backed tenant-safe keys outside dev/test", async () => {
    process.env.NODE_ENV = "production";
    const fakeRedis = new FakeRedisClient();
    getRedisClientMock.mockReturnValue(fakeRedis);

    const { ESOCache } = await import("./cache.js");
    const cache = new ESOCache(1000);
    let loaderCalls = 0;

    const first = await cache.getOrLoad(
      {
        adapter: "Census",
        key: JSON.stringify({ dataset: "acs/acs5", geography: "state:*" }),
        tenantId: "tenant-a",
        scope: "population",
        cacheTier: "hot",
      },
      async () => {
        loaderCalls += 1;
        return { rows: 10 };
      },
    );

    const second = await cache.getOrLoad(
      {
        adapter: "Census",
        key: JSON.stringify({ dataset: "acs/acs5", geography: "state:*" }),
        tenantId: "tenant-a",
        scope: "population",
        cacheTier: "hot",
      },
      async () => {
        loaderCalls += 1;
        return { rows: 11 };
      },
    );

    expect(first).toEqual({ rows: 10 });
    expect(second).toEqual({ rows: 10 });
    expect(loaderCalls).toBe(1);
    const dataWrite = fakeRedis.setCalls.find((call) => !call.key.startsWith("eso-lock:"));
    expect(dataWrite?.key).toMatch(/^tenant-a:read-cache:eso:census:population:/);
    expect(fakeRedis.setCalls.some((call) => call.key.startsWith("eso-lock:"))).toBe(true);
  });
});
