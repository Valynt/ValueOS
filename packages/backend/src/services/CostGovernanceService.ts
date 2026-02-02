/**
 * Cost Governance Service
 *
 * Provides real-time monitoring and rate gating for LLM usage on a per-deal basis.
 * Enforces circuit breakers when fiscal limits are exceeded.
 */

import { logger } from "../utils/logger.js";
import { getEnvVar } from "@shared/lib/env";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";

const DEFAULT_MAX_COST = 50;
const DEFAULT_MAX_TOKENS = 200_000;
const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_CIRCUIT_BREAKER_MINUTES = 30;
const DEFAULT_WARN_RATIO = 0.8;

type DealUsageEntry = {
  id: string;
  timestamp: number;
  tokens: number;
  cost: number;
  model: string;
  userId: string;
};

type DealUsageBucket = {
  entries: DealUsageEntry[];
  totalTokens: number;
  totalCost: number;
  circuitOpenUntil?: number;
};

export type DealGovernanceSnapshot = {
  dealId: string;
  tenantId: string;
  totalTokens: number;
  totalCost: number;
  maxTokens: number;
  maxCost: number;
  windowHours: number;
  circuitOpenUntil?: number;
};

export class CostGovernanceError extends Error {
  constructor(message: string, public readonly snapshot?: DealGovernanceSnapshot) {
    super(message);
    this.name = "CostGovernanceError";
  }
}

export class CostGovernanceService {
  private redis: Redis | null = null;

  private readonly enabled =
    getEnvVar("LLM_COST_GOVERNANCE_ENABLED", { defaultValue: "true" }) !==
    "false";
  private readonly maxCostPerDeal = parseFloat(
    getEnvVar("LLM_DEAL_COST_LIMIT", {
      defaultValue: DEFAULT_MAX_COST.toString(),
    }) || DEFAULT_MAX_COST.toString()
  );
  private readonly maxTokensPerDeal = parseInt(
    getEnvVar("LLM_DEAL_TOKEN_LIMIT", {
      defaultValue: DEFAULT_MAX_TOKENS.toString(),
    }) || DEFAULT_MAX_TOKENS.toString(),
    10
  );
  private readonly windowHours = parseInt(
    getEnvVar("LLM_DEAL_WINDOW_HOURS", {
      defaultValue: DEFAULT_WINDOW_HOURS.toString(),
    }) || DEFAULT_WINDOW_HOURS.toString(),
    10
  );
  private readonly circuitBreakerMinutes = parseInt(
    getEnvVar("LLM_DEAL_CIRCUIT_BREAKER_MINUTES", {
      defaultValue: DEFAULT_CIRCUIT_BREAKER_MINUTES.toString(),
    }) || DEFAULT_CIRCUIT_BREAKER_MINUTES.toString(),
    10
  );
  private readonly warnRatio = parseFloat(
    getEnvVar("LLM_DEAL_WARN_THRESHOLD", {
      defaultValue: DEFAULT_WARN_RATIO.toString(),
    }) || DEFAULT_WARN_RATIO.toString()
  );

  private async getRedis(): Promise<Redis> {
    if (!this.redis) {
      this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
      this.redis.on('error', (err) => logger.error('CostGovernance Redis error', err));
    }
    return this.redis;
  }

  estimatePromptTokens(prompt: string): number {
    if (!prompt) return 0;
    return Math.max(1, Math.ceil(prompt.length / 4));
  }

  async checkRequest(params: {
    tenantId?: string;
    dealId?: string;
    estimatedTokens: number;
    estimatedCost: number;
    userId: string;
    model: string;
  }): Promise<void> {
    if (!this.enabled || !params.dealId) return;

    const tenantId = params.tenantId || "global";
    const result = await this.runGovernanceScript({
      tenantId,
      dealId: params.dealId,
      tokens: params.estimatedTokens,
      cost: params.estimatedCost,
      record: false
    });

    if (result.status === 'blocked') {
      throw new CostGovernanceError(
        `LLM usage for deal ${params.dealId} is temporarily halted due to cost limits.`,
        this.buildSnapshot(tenantId, params.dealId, result)
      );
    }

    if (result.status === 'limit_exceeded') {
       logger.warn("LLM cost governance circuit opened", {
        tenantId,
        dealId: params.dealId,
        projectedCost: result.totalCost,
        projectedTokens: result.totalTokens,
        maxCost: this.maxCostPerDeal,
        maxTokens: this.maxTokensPerDeal,
        circuitOpenUntil: result.circuitOpenUntil,
      });
      throw new CostGovernanceError(
        `LLM usage for deal ${params.dealId} exceeds the configured fiscal limits.`,
        this.buildSnapshot(tenantId, params.dealId, result)
      );
    }

    if (
      result.totalCost >= this.maxCostPerDeal * this.warnRatio ||
      result.totalTokens >= this.maxTokensPerDeal * this.warnRatio
    ) {
      logger.warn("LLM cost governance nearing limit", {
        tenantId,
        dealId: params.dealId,
        projectedCost: result.totalCost,
        projectedTokens: result.totalTokens,
        maxCost: this.maxCostPerDeal,
        maxTokens: this.maxTokensPerDeal,
      });
    }
  }

  async recordUsage(params: {
    tenantId?: string;
    dealId?: string;
    tokens: number;
    cost: number;
    userId: string;
    model: string;
  }): Promise<void> {
    if (!this.enabled || !params.dealId) return;

    const tenantId = params.tenantId || "global";
    const result = await this.runGovernanceScript({
      tenantId,
      dealId: params.dealId,
      tokens: params.tokens,
      cost: params.cost,
      record: true,
      entry: {
        id: randomUUID(),
        timestamp: Date.now(), // Will be overridden by script "now"
        tokens: params.tokens,
        cost: params.cost,
        model: params.model,
        userId: params.userId,
      }
    });

    if (result.status === 'limit_exceeded') {
      logger.warn("LLM cost governance circuit opened after usage", {
        tenantId,
        dealId: params.dealId,
        totalCost: result.totalCost,
        totalTokens: result.totalTokens,
        maxCost: this.maxCostPerDeal,
        maxTokens: this.maxTokensPerDeal,
        circuitOpenUntil: result.circuitOpenUntil,
      });
    }
  }

  async getSummary(): Promise<{
    enabled: boolean;
    windowHours: number;
    maxCostPerDeal: number;
    maxTokensPerDeal: number;
    activeCircuits: number;
    trackedDeals: number;
  }> {
    const redis = await this.getRedis();
    const now = Date.now();
    const openCircuitsKey = 'cost_gov:open_circuits';
    const activeDealsKey = 'cost_gov:active_deals';
    const activeWindow = this.windowHours * 60 * 60 * 1000;

    // Prune expired circuits and inactive deals
    await redis.zremrangebyscore(openCircuitsKey, '-inf', `(${now}`);
    await redis.zremrangebyscore(activeDealsKey, '-inf', `(${now - activeWindow}`);

    const activeCircuits = await redis.zcard(openCircuitsKey);
    const trackedDeals = await redis.zcard(activeDealsKey);

    return {
      enabled: this.enabled,
      windowHours: this.windowHours,
      maxCostPerDeal: this.maxCostPerDeal,
      maxTokensPerDeal: this.maxTokensPerDeal,
      activeCircuits,
      trackedDeals,
    };
  }

  private async runGovernanceScript(params: {
    tenantId: string;
    dealId: string;
    tokens: number;
    cost: number;
    record: boolean;
    entry?: Omit<DealUsageEntry, 'timestamp'> & { timestamp: number };
  }): Promise<{
    status: 'allowed' | 'blocked' | 'limit_exceeded';
    circuitOpenUntil: number;
    totalTokens: number;
    totalCost: number;
  }> {
    const redis = await this.getRedis();
    const entriesKey = `cost_gov:bucket:${params.tenantId}:${params.dealId}:entries`;
    const metaKey = `cost_gov:bucket:${params.tenantId}:${params.dealId}:meta`;
    const openCircuitsKey = 'cost_gov:open_circuits';
    const activeDealsKey = 'cost_gov:active_deals';

    const now = Date.now();
    const windowMs = this.windowHours * 60 * 60 * 1000;
    const cutoff = now - windowMs;
    const breakerDurationMs = this.circuitBreakerMinutes * 60 * 1000;
    const memberId = `${params.tenantId}:${params.dealId}`;

    const entryJson = params.record && params.entry ? JSON.stringify(params.entry) : "";

    const script = `
      local entries_key = KEYS[1]
      local meta_key = KEYS[2]
      local open_circuits_key = KEYS[3]
      local active_deals_key = KEYS[4]

      local now = tonumber(ARGV[1])
      local cutoff = tonumber(ARGV[2])
      local entry_json = ARGV[3]
      local tokens = tonumber(ARGV[4])
      local cost = tonumber(ARGV[5])
      local max_tokens = tonumber(ARGV[6])
      local max_cost = tonumber(ARGV[7])
      local breaker_duration = tonumber(ARGV[8])
      local member_id = ARGV[9]

      -- Update active deals (last access = now)
      redis.call('ZADD', active_deals_key, now, member_id)

      -- 1. Prune expired entries
      local expired = redis.call('ZRANGEBYSCORE', entries_key, '-inf', '(' .. cutoff)
      local expired_tokens = 0
      local expired_cost = 0

      for _, entry in ipairs(expired) do
          local decoded = cjson.decode(entry)
          expired_tokens = expired_tokens + (decoded.tokens or 0)
          expired_cost = expired_cost + (decoded.cost or 0)
      end

      if #expired > 0 then
          redis.call('ZREMRANGEBYSCORE', entries_key, '-inf', '(' .. cutoff)
          redis.call('HINCRBYFLOAT', meta_key, 'totalTokens', -expired_tokens)
          redis.call('HINCRBYFLOAT', meta_key, 'totalCost', -expired_cost)
      end

      -- 2. Check circuit breaker (ONLY FOR CHECK REQUEST)
      local circuit_open_until = tonumber(redis.call('HGET', meta_key, 'circuitOpenUntil') or '0')

      if entry_json == "" and circuit_open_until > now then
          -- Ensure it is in open_circuits set
          redis.call('ZADD', open_circuits_key, circuit_open_until, member_id)
          return cjson.encode({status = 'blocked', circuitOpenUntil = circuit_open_until, totalTokens = 0, totalCost = 0})
      end

      local current_tokens = tonumber(redis.call('HGET', meta_key, 'totalTokens') or '0')
      local current_cost = tonumber(redis.call('HGET', meta_key, 'totalCost') or '0')

      -- If recording, apply updates FIRST
      if entry_json ~= "" then
          redis.call('ZADD', entries_key, now, entry_json)
          redis.call('HINCRBYFLOAT', meta_key, 'totalTokens', tokens)
          redis.call('HINCRBYFLOAT', meta_key, 'totalCost', cost)
          redis.call('EXPIRE', entries_key, 172800) -- 48h
          redis.call('EXPIRE', meta_key, 172800)

          current_tokens = current_tokens + tokens
          current_cost = current_cost + cost
      end

      local projected_tokens = current_tokens
      local projected_cost = current_cost

      if entry_json == "" then
         projected_tokens = projected_tokens + tokens
         projected_cost = projected_cost + cost
      end

      if projected_tokens > max_tokens or projected_cost > max_cost then
          local new_circuit_until = now + breaker_duration
          redis.call('HSET', meta_key, 'circuitOpenUntil', new_circuit_until)
          redis.call('ZADD', open_circuits_key, new_circuit_until, member_id)
          return cjson.encode({status = 'limit_exceeded', circuitOpenUntil = new_circuit_until, totalTokens = projected_tokens, totalCost = projected_cost})
      end

      -- If allowed, ensure we remove from open circuits (if it was there and expired or manually closed)
      -- But only if we are sure it's closed. Here 'allowed' implies circuit is closed/not tripped.
      redis.call('ZREM', open_circuits_key, member_id)

      return cjson.encode({status = 'allowed', circuitOpenUntil = 0, totalTokens = projected_tokens, totalCost = projected_cost})
    `;

    const resultStr = await redis.eval(script, 4, entriesKey, metaKey, openCircuitsKey, activeDealsKey,
        now.toString(),
        cutoff.toString(),
        entryJson,
        params.tokens.toString(),
        params.cost.toString(),
        this.maxTokensPerDeal.toString(),
        this.maxCostPerDeal.toString(),
        breakerDurationMs.toString(),
        memberId
    ) as string;

    return JSON.parse(resultStr);
  }

  private buildSnapshot(
    tenantId: string,
    dealId: string,
    result: { totalTokens: number; totalCost: number; circuitOpenUntil: number }
  ): DealGovernanceSnapshot {
    return {
      dealId,
      tenantId,
      totalTokens: result.totalTokens,
      totalCost: result.totalCost,
      maxTokens: this.maxTokensPerDeal,
      maxCost: this.maxCostPerDeal,
      windowHours: this.windowHours,
      circuitOpenUntil: result.circuitOpenUntil > 0 ? result.circuitOpenUntil : undefined,
    };
  }
}

export const costGovernance = new CostGovernanceService();
