/**
 * ValyntApp MCP Ground Truth compatibility layer.
 *
 * Canonical implementation ownership lives in packages/mcp/ground-truth.
 * This adapter preserves app-local import paths while delegating runtime behavior.
 */

import {
  createDevServer as createCanonicalDevServer,
  createMCPServer as createCanonicalMCPServer,
  type MCPFinancialGroundTruthServer,
} from "../../../../packages/mcp/ground-truth/index.ts";

export {
  BaseModule,
  EDGARModule,
  ESOModule,
  EntityMappingModule,
  IndustryBenchmarkModule,
  MarketDataModule,
  MCPFinancialGroundTruthServer,
  PrivateCompanyModule,
  UnifiedTruthLayer,
  XBRLModule,
} from "../../../../packages/mcp/ground-truth/index.ts";

export * from "../../../../packages/mcp/ground-truth/types/index.ts";

export interface AppGroundTruthServerConfig {
  edgar?: {
    userAgent: string;
    rateLimit?: number;
  };
  xbrl?: {
    userAgent: string;
    rateLimit?: number;
  };
  marketData?: {
    provider: "alphavantage" | "polygon" | "tiingo";
    apiKey: string;
    rateLimit?: number;
  };
  privateCompany?: {
    crunchbaseApiKey?: string;
    zoomInfoApiKey?: string;
    linkedInApiKey?: string;
    enableWebScraping?: boolean;
  };
  industryBenchmark?: {
    blsApiKey?: string;
    censusApiKey?: string;
    enableStaticData?: boolean;
  };
  truthLayer?: {
    enableFallback?: boolean;
    strictMode?: boolean;
    maxResolutionTime?: number;
    parallelQuery?: boolean;
  };
  security?: {
    enableWhitelist?: boolean;
    enableRateLimiting?: boolean;
    enableAuditLogging?: boolean;
  };
}

const DEFAULT_MARKET_DATA_PROVIDER = "alphavantage" as const;
const DEFAULT_MARKET_DATA_RATE_LIMIT = 5;
const DEFAULT_MARKET_DATA_API_KEY = "demo";

function withCompatibilityDefaults(config: AppGroundTruthServerConfig): AppGroundTruthServerConfig {
  if (config.marketData?.apiKey) {
    return config;
  }

  return {
    ...config,
    marketData: {
      provider: config.marketData?.provider ?? DEFAULT_MARKET_DATA_PROVIDER,
      rateLimit: config.marketData?.rateLimit ?? DEFAULT_MARKET_DATA_RATE_LIMIT,
      apiKey: process.env.ALPHA_VANTAGE_API_KEY || DEFAULT_MARKET_DATA_API_KEY,
    },
  };
}

export async function createMCPServer(
  config: AppGroundTruthServerConfig
): Promise<MCPFinancialGroundTruthServer> {
  return createCanonicalMCPServer(withCompatibilityDefaults(config));
}

export async function createDevServer(): Promise<MCPFinancialGroundTruthServer> {
  return createCanonicalDevServer();
}
