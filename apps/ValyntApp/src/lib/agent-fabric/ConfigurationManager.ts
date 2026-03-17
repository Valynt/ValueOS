import { logger } from "../../utils/logger";
import type { LLMProvider, LLMProviderConfig } from "./LLMGateway";

export interface SafetyPolicy {
  maxTokensPerRequest?: number;
  maxRequestsPerMinute?: number;
  allowedModels?: string[];
  blockPII?: boolean;
}

export interface FabricConfig {
  costs: {
    budget: Record<string, number>; // env -> budget amount
    currentSpend: Record<string, number>; // env -> current spend
    alerts: { threshold: number; email: string }[];
  };
  safety: {
    global: SafetyPolicy;
    perAgent: Record<string, SafetyPolicy>;
  };
  providers: {
    enabled: LLMProvider[];
    fallbackOrder: LLMProvider[];
    configs: Record<LLMProvider, LLMProviderConfig>;
  };
}

export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: FabricConfig;

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  public getConfig(): FabricConfig {
    return this.config;
  }

  public updateConfig(partialConfig: Partial<FabricConfig>): void {
    this.config = {
      ...this.config,
      ...partialConfig,
      costs: partialConfig.costs ? { ...this.config.costs, ...partialConfig.costs } : this.config.costs,
      safety: partialConfig.safety ? { ...this.config.safety, ...partialConfig.safety } : this.config.safety,
      providers: partialConfig.providers ? { ...this.config.providers, ...partialConfig.providers } : this.config.providers,
    };
    logger.info("Configuration updated");
  }

  public reset(): void {
    this.config = this.getDefaultConfig();
  }

  public checkSafety(agentId: string, request: any): { safe: boolean; reason?: string } {
    const globalPolicy = this.config.safety.global;
    const agentPolicy = this.config.safety.perAgent[agentId] || {};
    const effectivePolicy = { ...globalPolicy, ...agentPolicy };

    if (
      effectivePolicy.maxTokensPerRequest &&
      request.maxTokens &&
      request.maxTokens > effectivePolicy.maxTokensPerRequest
    ) {
      return {
        safe: false,
        reason: `Max tokens per request exceeded: ${request.maxTokens} > ${effectivePolicy.maxTokensPerRequest}`,
      };
    }
    return { safe: true };
  }

  public trackCost(env: string, cost: number): void {
    if (!this.config.costs.currentSpend[env]) {
      this.config.costs.currentSpend[env] = 0;
    }
    this.config.costs.currentSpend[env] += cost;

    const budget = this.config.costs.budget[env];
    if (budget) {
      const spend = this.config.costs.currentSpend[env];
      const percentage = (spend / budget) * 100;
      this.config.costs.alerts.forEach((alert) => {
        if (percentage >= alert.threshold) {
          logger.warn(`Budget alert: ${percentage.toFixed(1)}% used`, { env, spend, budget });
        }
      });
    }
  }

  private getDefaultConfig(): FabricConfig {
    return {
      costs: {
        budget: { development: 100, staging: 500, production: 1000 },
        currentSpend: {},
        alerts: [{ threshold: 80, email: "admin@example.com" }],
      },
      safety: {
        global: { maxTokensPerRequest: 4000, blockPII: true },
        perAgent: {},
      },
      providers: {
        enabled: ["openai"],
        fallbackOrder: ["openai"],
        configs: {} as Record<LLMProvider, LLMProviderConfig>,
      },
    };
  }
}
