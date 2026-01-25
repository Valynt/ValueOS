import { describe, it, expect, vi } from "vitest";
import { CacheEncryption } from "../CacheEncryption";

vi.mock('../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("CacheEncryption", () => {
  it("should encrypt and decrypt correctly", () => {
    const ce = new CacheEncryption();
    const data = { foo: "bar" };
    const tenantId = "t-1";

    const encrypted = ce.encrypt(data, tenantId);
    const decrypted = ce.decrypt(encrypted, tenantId);

    expect(decrypted).toEqual(data);
  });

  it("benchmark should run without error", async () => {
    const ce = new CacheEncryption();
    // Use iterations > BATCH_SIZE (100) to trigger yielding
    const stats = await ce.benchmark(150);
    expect(stats.throughputMBps).toBeGreaterThan(0);
    expect(stats.averageEncryptionMs).toBeGreaterThanOrEqual(0);
    expect(stats.averageDecryptionMs).toBeGreaterThanOrEqual(0);
  });
});
