/**
 * Cost Governance Service
 *
 * Provides real-time monitoring and rate gating for LLM usage on a per-deal basis.
 * Enforces circuit breakers when fiscal limits are exceeded.
 */

import { logger } from "../utils/logger";
import { getEnvVar } from "../lib/env";

const DEFAULT_MAX_COST = 50;
const DEFAULT_MAX_TOKENS = 200_000;
const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_CIRCUIT_BREAKER_MINUTES = 30;
const DEFAULT_WARN_RATIO = 0.8;

type DealUsageEntry = {
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

  private readonly buckets = new Map<string, DealUsageBucket>();

  estimatePromptTokens(prompt: string): number {
    if (!prompt) return 0;
    return Math.max(1, Math.ceil(prompt.length / 4));
  }

  checkRequest(params: {
    tenantId?: string;
    dealId?: string;
    estimatedTokens: number;
    estimatedCost: number;
    userId: string;
    model: string;
  }): void {
    if (!this.enabled || !params.dealId) return;

    const now = Date.now();
    const tenantId = params.tenantId || "global";
    const bucket = this.getBucket(tenantId, params.dealId);
    this.pruneBucket(bucket, now);

    if (bucket.circuitOpenUntil && bucket.circuitOpenUntil > now) {
      throw new CostGovernanceError(
        `LLM usage for deal ${params.dealId} is temporarily halted due to cost limits.`,
        this.buildSnapshot(tenantId, params.dealId, bucket)
      );
    }

    const projectedCost = bucket.totalCost + params.estimatedCost;
    const projectedTokens = bucket.totalTokens + params.estimatedTokens;

    if (
      projectedCost > this.maxCostPerDeal ||
      projectedTokens > this.maxTokensPerDeal
    ) {
      bucket.circuitOpenUntil =
        now + this.circuitBreakerMinutes * 60 * 1000;
      logger.warn("LLM cost governance circuit opened", {
        tenantId,
        dealId: params.dealId,
        projectedCost,
        projectedTokens,
        maxCost: this.maxCostPerDeal,
        maxTokens: this.maxTokensPerDeal,
        circuitOpenUntil: bucket.circuitOpenUntil,
      });
      throw new CostGovernanceError(
        `LLM usage for deal ${params.dealId} exceeds the configured fiscal limits.`,
        this.buildSnapshot(tenantId, params.dealId, bucket)
      );
    }

    if (
      projectedCost >= this.maxCostPerDeal * this.warnRatio ||
      projectedTokens >= this.maxTokensPerDeal * this.warnRatio
    ) {
      logger.warn("LLM cost governance nearing limit", {
        tenantId,
        dealId: params.dealId,
        projectedCost,
        projectedTokens,
        maxCost: this.maxCostPerDeal,
        maxTokens: this.maxTokensPerDeal,
      });
    }
  }

  recordUsage(params: {
    tenantId?: string;
    dealId?: string;
    tokens: number;
    cost: number;
    userId: string;
    model: string;
  }): void {
    if (!this.enabled || !params.dealId) return;

    const now = Date.now();
    const tenantId = params.tenantId || "global";
    const bucket = this.getBucket(tenantId, params.dealId);
    this.pruneBucket(bucket, now);

    bucket.entries.push({
      timestamp: now,
      tokens: params.tokens,
      cost: params.cost,
      model: params.model,
      userId: params.userId,
    });
    bucket.totalTokens += params.tokens;
    bucket.totalCost += params.cost;

    if (
      bucket.totalCost > this.maxCostPerDeal ||
      bucket.totalTokens > this.maxTokensPerDeal
    ) {
      bucket.circuitOpenUntil =
        now + this.circuitBreakerMinutes * 60 * 1000;
      logger.warn("LLM cost governance circuit opened after usage", {
        tenantId,
        dealId: params.dealId,
        totalCost: bucket.totalCost,
        totalTokens: bucket.totalTokens,
        maxCost: this.maxCostPerDeal,
        maxTokens: this.maxTokensPerDeal,
        circuitOpenUntil: bucket.circuitOpenUntil,
      });
    }
  }

  getSummary(): {
    enabled: boolean;
    windowHours: number;
    maxCostPerDeal: number;
    maxTokensPerDeal: number;
    activeCircuits: number;
    trackedDeals: number;
  } {
    const now = Date.now();
    let activeCircuits = 0;
    for (const bucket of this.buckets.values()) {
      if (bucket.circuitOpenUntil && bucket.circuitOpenUntil > now) {
        activeCircuits += 1;
      }
    }
    return {
      enabled: this.enabled,
      windowHours: this.windowHours,
      maxCostPerDeal: this.maxCostPerDeal,
      maxTokensPerDeal: this.maxTokensPerDeal,
      activeCircuits,
      trackedDeals: this.buckets.size,
    };
  }

  private getBucket(tenantId: string, dealId: string): DealUsageBucket {
    const key = `${tenantId}:${dealId}`;
    const existing = this.buckets.get(key);
    if (existing) return existing;

    const bucket: DealUsageBucket = {
      entries: [],
      totalTokens: 0,
      totalCost: 0,
    };
    this.buckets.set(key, bucket);
    return bucket;
  }

  private pruneBucket(bucket: DealUsageBucket, now: number): void {
    const windowMs = this.windowHours * 60 * 60 * 1000;
    const cutoff = now - windowMs;
    if (bucket.entries.length === 0) return;

    const retained = bucket.entries.filter((entry) => entry.timestamp >= cutoff);
    if (retained.length === bucket.entries.length) {
      return;
    }

    bucket.entries = retained;
    bucket.totalTokens = retained.reduce((sum, entry) => sum + entry.tokens, 0);
    bucket.totalCost = retained.reduce((sum, entry) => sum + entry.cost, 0);
  }

  private buildSnapshot(
    tenantId: string,
    dealId: string,
    bucket: DealUsageBucket
  ): DealGovernanceSnapshot {
    return {
      dealId,
      tenantId,
      totalTokens: bucket.totalTokens,
      totalCost: bucket.totalCost,
      maxTokens: this.maxTokensPerDeal,
      maxCost: this.maxCostPerDeal,
      windowHours: this.windowHours,
      circuitOpenUntil: bucket.circuitOpenUntil,
    };
  }
}

export const costGovernance = new CostGovernanceService();
