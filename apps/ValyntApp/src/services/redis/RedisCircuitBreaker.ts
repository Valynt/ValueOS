import { createClient, type RedisClientType } from 'redis';

export interface RedisCircuitBreakerConfig {
  failureThreshold?: number; // failures to open
  recoveryTimeoutMs?: number; // time to wait before half-open
  monitoringWindowMs?: number; // window for counting failures
  halfOpenMaxProbes?: number;
}

export class RedisCircuitBreaker {
  private client: RedisClientType;
  private config: Required<RedisCircuitBreakerConfig>;

  constructor(redisUrl?: string, config?: Partial<RedisCircuitBreakerConfig>, client?: RedisClientType) {
    this.config = {
      failureThreshold: 3,
      recoveryTimeoutMs: 30_000,
      monitoringWindowMs: 120_000,
      halfOpenMaxProbes: 1,
      ...config,
    };

    if (client) {
      this.client = client;
    } else {
      const url = redisUrl || process.env.REDIS_URL || '';
      this.client = createClient({ url });
      // connect lazily — callers may call execute immediately so ensure connect
      void this.client.connect().catch(() => {});
    }
  }

  private keyBase(breakerKey: string) {
    return `breaker:${breakerKey}`;
  }

  private async getStateRaw(breakerKey: string) {
    const base = this.keyBase(breakerKey);
    const [state, failures, openedAt, probes] = await Promise.all([
      this.client.get(`${base}:state`),
      this.client.get(`${base}:failures`),
      this.client.get(`${base}:opened_at`),
      this.client.get(`${base}:probes`),
    ]);

    return {
      state: (state as string) || 'closed',
      failures: parseInt(failures || '0', 10),
      openedAt: openedAt ? parseInt(openedAt, 10) : 0,
      probes: parseInt(probes || '0', 10),
    };
  }

  async getState(breakerKey: string): Promise<'closed'|'open'|'half_open'> {
    const raw = await this.getStateRaw(breakerKey);
    // auto transition if open and timeout passed
    if (raw.state === 'open') {
      const now = Date.now();
      if (now - raw.openedAt >= this.config.recoveryTimeoutMs) {
        return 'half_open';
      }
    }
    return raw.state as 'closed'|'open'|'half_open';
  }

  async reset(breakerKey: string): Promise<void> {
    const base = this.keyBase(breakerKey);
    await Promise.all([
      this.client.del(`${base}:state`),
      this.client.del(`${base}:failures`),
      this.client.del(`${base}:opened_at`),
      this.client.del(`${base}:probes`),
    ]);
  }

  private async markOpen(breakerKey: string): Promise<void> {
    const base = this.keyBase(breakerKey);
    await Promise.all([
      this.client.set(`${base}:state`, 'open'),
      this.client.set(`${base}:opened_at`, `${Date.now()}`),
    ]);
  }

  private async recordFailure(breakerKey: string): Promise<number> {
    const base = this.keyBase(breakerKey);
    const count = await this.client.incr(`${base}:failures`);
    // ensure TTL limited to monitoring window
    await this.client.pexpire(`${base}:failures`, this.config.monitoringWindowMs);
    return count;
  }

  private async recordSuccess(breakerKey: string): Promise<void> {
    const base = this.keyBase(breakerKey);
    await Promise.all([
      this.client.del(`${base}:failures`),
      this.client.del(`${base}:opened_at`),
      this.client.set(`${base}:state`, 'closed'),
    ]);
  }

  private async acquireProbeLock(breakerKey: string): Promise<boolean> {
    const base = this.keyBase(breakerKey);
    // use SET NX to create probe lock with short TTL to avoid stuck probes
    const lockKey = `${base}:probe_lock`;
    const res = await this.client.set(lockKey, '1', { NX: true, PX: Math.max(1000, this.config.recoveryTimeoutMs) });
    return res === 'OK';
  }

  async execute<T>(breakerKey: string, operation: () => Promise<T>, opts?: { timeoutMs?: number; fallback?: (() => Promise<T> | T) }): Promise<T> {
    const state = await this.getState(breakerKey);

    if (state === 'open') {
      // still open — reject immediately
      throw new Error('Circuit breaker OPEN');
    }

    if (state === 'half_open') {
      // attempt to acquire probe lock — if we cannot, another probe in progress
      const got = await this.acquireProbeLock(breakerKey);
      if (!got) {
        throw new Error('Circuit breaker half-open probe already in progress');
      }
    }

    const start = Date.now();
    try {
      const result = await operation();
      await this.recordSuccess(breakerKey);
      return result;
    } catch (err) {
      const failures = await this.recordFailure(breakerKey);
      if (failures >= this.config.failureThreshold) {
        await this.markOpen(breakerKey);
      }

      if (opts?.fallback) {
        try {
          const fb = await Promise.resolve(opts.fallback());
          return fb as T;
        } catch (e) {
          // fall through to throwing original error
        }
      }

      throw err;
    } finally {
      // noop: probe lock will expire automatically via PX
      void start; // keep eslint happy about unused
    }
  }

  async getStats(): Promise<unknown> {
    // naive: scan is expensive; callers should request known breaker keys
    return { info: 'RedisCircuitBreaker: stats require explicit keys' };
  }
}

export default RedisCircuitBreaker;
