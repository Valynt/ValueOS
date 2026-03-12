import { getRedisClient } from '../../shared/src/lib/redisClient.js';

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const RECENT_MESSAGE_LIMIT = 40;
const RECENT_CALCULATION_LIMIT = 30;

export interface SessionScope {
  tenantId: string;
  authIdentity: string;
  sessionId: string;
}

export interface TokenHistoryMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tokenCount: number;
  createdAt: string;
}

export interface CalculationNote {
  note: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface SessionContextData {
  messages: TokenHistoryMessage[];
  calculations: CalculationNote[];
  agentContext: Record<string, unknown>;
  updatedAt: string;
}

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export interface SessionContextLedgerOptions {
  ttlSeconds?: number;
  redis?: RedisLike;
}

function buildKey(scope: SessionScope): string {
  const sanitize = (value: string) => value.trim().replace(/:/g, '_');
  return `memory:context-ledger:${sanitize(scope.tenantId)}:${sanitize(scope.authIdentity)}:${sanitize(scope.sessionId)}`;
}

function emptyContext(now: Date = new Date()): SessionContextData {
  return {
    messages: [],
    calculations: [],
    agentContext: {},
    updatedAt: now.toISOString(),
  };
}

export class SessionContextLedger {
  private readonly ttlSeconds: number;
  private readonly redisPromise: Promise<RedisLike>;

  constructor(options: SessionContextLedgerOptions = {}) {
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    this.redisPromise = options.redis
      ? Promise.resolve(options.redis)
      : Promise.resolve(getRedisClient() as unknown as RedisLike);
  }

  async appendMessage(scope: SessionScope, message: Omit<TokenHistoryMessage, 'createdAt'>): Promise<SessionContextData> {
    const context = await this.read(scope);
    context.messages = [
      ...context.messages,
      {
        ...message,
        createdAt: new Date().toISOString(),
      },
    ].slice(-RECENT_MESSAGE_LIMIT);
    context.updatedAt = new Date().toISOString();

    await this.write(scope, context);
    return context;
  }

  async appendCalculation(
    scope: SessionScope,
    calculation: Omit<CalculationNote, 'createdAt'>,
  ): Promise<SessionContextData> {
    const context = await this.read(scope);
    context.calculations = [
      ...context.calculations,
      {
        ...calculation,
        createdAt: new Date().toISOString(),
      },
    ].slice(-RECENT_CALCULATION_LIMIT);
    context.updatedAt = new Date().toISOString();

    await this.write(scope, context);
    return context;
  }

  async getSessionContext(scope: SessionScope): Promise<SessionContextData> {
    const context = await this.read(scope);
    await this.refreshTtl(scope);
    return context;
  }

  async clearSession(scope: SessionScope): Promise<void> {
    const redis = await this.redisPromise;
    await redis.del(buildKey(scope));
  }

  private async read(scope: SessionScope): Promise<SessionContextData> {
    const redis = await this.redisPromise;
    const raw = await redis.get(buildKey(scope));

    if (!raw) {
      return emptyContext();
    }

    try {
      const parsed = JSON.parse(raw) as SessionContextData;
      return {
        ...emptyContext(),
        ...parsed,
      };
    } catch {
      return emptyContext();
    }
  }

  private async write(scope: SessionScope, data: SessionContextData): Promise<void> {
    const redis = await this.redisPromise;
    await redis.set(buildKey(scope), JSON.stringify(data), { EX: this.ttlSeconds });
  }

  private async refreshTtl(scope: SessionScope): Promise<void> {
    const redis = await this.redisPromise;
    await redis.expire(buildKey(scope), this.ttlSeconds);
  }
}

export const sessionContextLedgerKey = buildKey;
export const SESSION_CONTEXT_LEDGER_TTL_SECONDS = DEFAULT_TTL_SECONDS;
