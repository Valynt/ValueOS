import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { decryptMock, encryptMock, loggerErrorMock } = vi.hoisted(() => ({
  decryptMock: vi.fn(),
  encryptMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('../config/secrets/CacheEncryption', () => ({
  cacheEncryption: {
    encrypt: encryptMock,
    decrypt: decryptMock,
  },
}));

vi.mock('../lib/logger', () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

import { SecureCache } from './SecureCache';

const entryFactory = () => ({
  encrypted: Buffer.from('secret'),
  iv: Buffer.from('iviviviviviviviv'),
  authTag: Buffer.from('tagtagtagtagtagt'),
  expiresAt: Date.now() + 10_000,
});

describe('SecureCache', () => {
  beforeEach(() => {
    encryptMock.mockReset();
    decryptMock.mockReset();
    loggerErrorMock.mockReset();
    encryptMock.mockImplementation(() => entryFactory());
  });

  it('round-trips values using schema parser', () => {
    const payloadSchema = z.object({ id: z.string(), count: z.number().int() });
    const cache = new SecureCache({ schema: payloadSchema, tenantId: 'tenant-a' });

    cache.set('workflow', { id: 'abc', count: 2 });
    decryptMock.mockReturnValue({ id: 'abc', count: 2 });

    expect(cache.get('workflow')).toEqual({ id: 'abc', count: 2 });
    expect(encryptMock).toHaveBeenCalledWith({ id: 'abc', count: 2 }, 'tenant-a');
  });

  it('drops entry when decrypted payload is malformed for schema', () => {
    const payloadSchema = z.object({ id: z.string(), count: z.number().int() });
    const cache = new SecureCache({ schema: payloadSchema });

    cache.set('bad', { id: 'ok', count: 1 });
    decryptMock.mockReturnValue({ id: 'ok', count: 'not-a-number' });

    expect(cache.get('bad')).toBeNull();
    expect(cache.size()).toBe(0);
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
  });

  it('drops entry when decrypted payload is not JSON-safe without parser', () => {
    const cache = new SecureCache({});

    cache.set('bad', { nested: true });
    decryptMock.mockReturnValue(() => 'nope');

    expect(cache.get('bad')).toBeNull();
    expect(cache.size()).toBe(0);
  });
});
