import { describe, expect, it } from 'vitest';
import { SessionContextLedger, sessionContextLedgerKey } from './index.js';

class InMemoryRedis {
  private nowMs = Date.now();
  private values = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const found = this.values.get(key);
    if (!found) {
      return null;
    }

    if (found.expiresAt && found.expiresAt <= this.nowMs) {
      this.values.delete(key);
      return null;
    }

    return found.value;
  }

  async set(key: string, value: string, options?: { EX?: number }): Promise<void> {
    const expiresAt = options?.EX ? this.nowMs + options.EX * 1000 : undefined;
    this.values.set(key, { value, expiresAt });
  }

  async expire(key: string, seconds: number): Promise<void> {
    const found = this.values.get(key);
    if (!found) {
      return;
    }

    found.expiresAt = this.nowMs + seconds * 1000;
    this.values.set(key, found);
  }

  async del(key: string): Promise<void> {
    this.values.delete(key);
  }

  advance(ms: number): void {
    this.nowMs += ms;
  }
}

const scope = {
  tenantId: 'tenant-1',
  authIdentity: 'user-1',
  sessionId: 'session-1',
};

describe('SessionContextLedger TTL behavior', () => {
  it('refreshes TTL when appending and reading session context', async () => {
    const redis = new InMemoryRedis();
    const ledger = new SessionContextLedger({ redis, ttlSeconds: 10 });

    await ledger.appendMessage(scope, { role: 'user', content: 'hello', tokenCount: 3 });

    redis.advance(9_000);
    const active = await ledger.getSessionContext(scope);
    expect(active.messages).toHaveLength(1);

    redis.advance(9_000);
    const stillPresent = await ledger.getSessionContext(scope);
    expect(stillPresent.messages).toHaveLength(1);

  });

  it('expires context after TTL window with no activity', async () => {
    const redis = new InMemoryRedis();
    const ledger = new SessionContextLedger({ redis, ttlSeconds: 5 });

    await ledger.appendCalculation(scope, { note: '2 + 2 = 4' });

    redis.advance(6_000);

    const expired = await ledger.getSessionContext(scope);
    expect(expired.calculations).toHaveLength(0);
    expect(expired.messages).toHaveLength(0);
  });

  it('hard deletes key on clearSession', async () => {
    const redis = new InMemoryRedis();
    const ledger = new SessionContextLedger({ redis, ttlSeconds: 30 });

    await ledger.appendMessage(scope, { role: 'assistant', content: 'done', tokenCount: 2 });
    await ledger.clearSession(scope);

    const key = sessionContextLedgerKey(scope);
    const raw = await redis.get(key);
    expect(raw).toBeNull();
  });
});
