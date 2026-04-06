import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-secrets-manager", () => {
  class SecretsManagerClient {
    send = vi.fn();
  }

  return {
    CreateSecretCommand: class {},
    DeleteSecretCommand: class {},
    DescribeSecretCommand: class {},
    GetSecretValueCommand: class {},
    ListSecretsCommand: class {},
    PutSecretValueCommand: class {},
    RotateSecretCommand: class {},
    SecretsManagerClient,
  };
});

vi.mock("../../../lib/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/logger.js")>();
  return {
    ...actual,
    logger: {
      ...actual.logger,
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock("../../../lib/redisClient", () => ({
  getRedisClient: vi.fn(async () => ({
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  })),
}));

vi.mock("../../../lib/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/supabase")>();
  const mockServerClient = {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
  };

  return {
    assertNotTestEnv: vi.fn(),
    ...actual,
    supabase: null,
    createBrowserSupabaseClient: vi.fn(() => {
      throw new Error("createBrowserSupabaseClient() is only available in browser tests");
    }),
    createRequestSupabaseClient: vi.fn(() => mockServerClient),
    createServerSupabaseClient: vi.fn(() => mockServerClient),
    getSupabaseClient: vi.fn(() => mockServerClient),
  };
});

import { AWSSecretProvider } from "../AWSSecretProvider.js";
import { VaultSecretProvider } from "../VaultSecretProvider.js";

type ProviderInstance = AWSSecretProvider | VaultSecretProvider;
type ProviderFactory = () => ProviderInstance;

const createAwsProvider = () => new AWSSecretProvider("us-east-1", 1_000);
const createVaultProvider = () =>
  new VaultSecretProvider("http://vault", "valuecanvas", "role", 1_000);

const providerFactories: Array<{ name: string; create: ProviderFactory }> = [
  { name: "aws", create: createAwsProvider },
  { name: "vault", create: createVaultProvider },
];

function serializeCachedSecret(
  provider: ProviderInstance,
  cacheKey: string,
  value: Record<string, string>,
): string {
  return (provider as unknown as {
    serializeCachedSecret: (cacheKey: string, value: Record<string, string>) => string;
  }).serializeCachedSecret(cacheKey, value);
}

function deserializeCachedSecret(
  provider: ProviderInstance,
  cacheKey: string,
  cachedValue: string,
): Record<string, string> {
  return (provider as unknown as {
    deserializeCachedSecret: (cacheKey: string, cachedValue: string) => Record<string, string>;
  }).deserializeCachedSecret(cacheKey, cachedValue);
}

describe.each(providerFactories)("$name provider cache encryption", ({ create }) => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("CACHE_ENCRYPTION_KEY", "shared-cache-key");
    vi.stubEnv("CACHE_ENCRYPTION_KEY_VERSION", "v1");
    vi.stubEnv("CACHE_ENCRYPTION_PREVIOUS_KEYS", "");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("decrypts cached entries across process restarts with the same configured key", () => {
    const cacheKey = "tenant-1:api-key";
    const value = { value: "super-secret" };

    const firstInstance = create();
    const cachedValue = serializeCachedSecret(firstInstance, cacheKey, value);

    const restartedInstance = create();
    expect(deserializeCachedSecret(restartedInstance, cacheKey, cachedValue)).toEqual(value);
  });

  it("detects tampering via AES-256-GCM authentication", () => {
    const cacheKey = "tenant-1:api-key";
    const value = { value: "super-secret" };

    const provider = create();
    const cachedValue = serializeCachedSecret(provider, cacheKey, value);
    const tampered = JSON.parse(cachedValue) as {
      ciphertext: string;
      authTag: string;
    };

    tampered.ciphertext = `${tampered.ciphertext.slice(0, -2)}AA`;

    expect(() =>
      deserializeCachedSecret(provider, cacheKey, JSON.stringify(tampered)),
    ).toThrow();
  });

  it("supports multi-instance cache interoperability with the same key material", () => {
    const cacheKey = "tenant-1:api-key";
    const value = { value: "shared-secret" };

    const writer = create();
    const reader = create();

    const cachedValue = serializeCachedSecret(writer, cacheKey, value);
    expect(deserializeCachedSecret(reader, cacheKey, cachedValue)).toEqual(value);
  });

  it("supports key rotation by decrypting old entries and emitting new key-version metadata", () => {
    const cacheKey = "tenant-1:api-key";
    const value = { value: "rotated-secret" };

    vi.stubEnv("CACHE_ENCRYPTION_KEY", "old-cache-key");
    vi.stubEnv("CACHE_ENCRYPTION_KEY_VERSION", "v1");
    vi.stubEnv("CACHE_ENCRYPTION_PREVIOUS_KEYS", "");
    const oldProvider = create();
    const oldCachedValue = serializeCachedSecret(oldProvider, cacheKey, value);

    vi.stubEnv("CACHE_ENCRYPTION_KEY", "new-cache-key");
    vi.stubEnv("CACHE_ENCRYPTION_KEY_VERSION", "v2");
    vi.stubEnv(
      "CACHE_ENCRYPTION_PREVIOUS_KEYS",
      JSON.stringify({ v1: "old-cache-key" }),
    );
    const rotatedProvider = create();

    expect(deserializeCachedSecret(rotatedProvider, cacheKey, oldCachedValue)).toEqual(value);

    const newCachedValue = serializeCachedSecret(rotatedProvider, cacheKey, value);
    expect(JSON.parse(newCachedValue)).toMatchObject({ keyVersion: "v2" });
  });
});

describe("AWS distributed cache safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("disables Redis-backed distributed caching when no stable cache key is configured", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("CACHE_ENCRYPTION_KEY", "");
    vi.stubEnv("CACHE_ENCRYPTION_KEY_VERSION", "");
    vi.stubEnv("CACHE_ENCRYPTION_PREVIOUS_KEYS", "");

    const provider = createAwsProvider();

    expect((provider as unknown as { redisEnabled: boolean }).redisEnabled).toBe(false);
  });
});
