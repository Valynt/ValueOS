export interface WebSocketLimiterConfig {
  maxMessagesPerSecond: number;
  maxPayloadBytes: number;
  refillIntervalMs?: number;
}

export type WebSocketLimiterViolationReason = "rate_limit_exceeded" | "payload_too_large";

interface TokenBucketState {
  tokens: number;
  lastRefillAt: number;
}

export interface WebSocketLimiterResult {
  allowed: boolean;
  reason?: WebSocketLimiterViolationReason;
}

export class WebSocketLimiter {
  private readonly maxMessagesPerSecond: number;
  private readonly maxPayloadBytes: number;
  private readonly refillIntervalMs: number;
  private readonly buckets = new Map<string, TokenBucketState>();

  constructor(config: WebSocketLimiterConfig) {
    this.maxMessagesPerSecond = config.maxMessagesPerSecond;
    this.maxPayloadBytes = config.maxPayloadBytes;
    this.refillIntervalMs = config.refillIntervalMs ?? 1000;
  }

  public evaluateMessage(
    connectionId: string,
    tenantId: string,
    payloadBytes: number,
    nowMs = Date.now()
  ): WebSocketLimiterResult {
    if (payloadBytes > this.maxPayloadBytes) {
      return { allowed: false, reason: "payload_too_large" };
    }

    const key = this.buildKey(connectionId, tenantId);
    const state = this.getRefilledState(key, nowMs);
    if (state.tokens < 1) {
      this.buckets.set(key, state);
      return { allowed: false, reason: "rate_limit_exceeded" };
    }

    state.tokens -= 1;
    this.buckets.set(key, state);
    return { allowed: true };
  }

  public releaseConnection(connectionId: string, tenantId: string): void {
    this.buckets.delete(this.buildKey(connectionId, tenantId));
  }

  private buildKey(connectionId: string, tenantId: string): string {
    return `${tenantId}:${connectionId}`;
  }

  private getRefilledState(key: string, nowMs: number): TokenBucketState {
    const existing = this.buckets.get(key);
    if (!existing) {
      return {
        tokens: this.maxMessagesPerSecond,
        lastRefillAt: nowMs,
      };
    }

    const elapsed = nowMs - existing.lastRefillAt;
    if (elapsed < this.refillIntervalMs) {
      return existing;
    }

    const refillUnits = Math.floor(elapsed / this.refillIntervalMs);
    const nextTokens = Math.min(this.maxMessagesPerSecond, existing.tokens + refillUnits * this.maxMessagesPerSecond);

    return {
      tokens: nextTokens,
      lastRefillAt: existing.lastRefillAt + refillUnits * this.refillIntervalMs,
    };
  }
}
