/**
 * MCP Financial Ground Truth Server - Main Export
 * 
 * Central export point for the MCP Financial Ground Truth Server.
 * Provides easy access to all modules, types, and the main server class.
 */

// Core exports
export { MCPFinancialGroundTruthServer } from './core/MCPServer';
export { UnifiedTruthLayer } from './core/UnifiedTruthLayer';
export { BaseModule } from './core/BaseModule';

// Module exports
export { EDGARModule } from './modules/EDGARModule';
export { XBRLModule } from './modules/XBRLModule';
export { MarketDataModule } from './modules/MarketDataModule';
export { PrivateCompanyModule } from './modules/PrivateCompanyModule';
export { IndustryBenchmarkModule } from './modules/IndustryBenchmarkModule';

// Type exports
export * from './types';

// Utility function to create a configured server instance
export async function createMCPServer(config: {
  edgar?: {
    userAgent: string;
    rateLimit?: number;
  };
  xbrl?: {
    userAgent: string;
    rateLimit?: number;
  };
  marketData?: {
    provider: 'alphavantage' | 'polygon' | 'tiingo';
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
}) {
  const { MCPFinancialGroundTruthServer } = await import('./core/MCPServer');
  
  // Set defaults
  const serverConfig = {
    edgar: config.edgar || {
      userAgent: 'ValueCanvas contact@valuecanvas.com',
      rateLimit: 10,
    },
    xbrl: config.xbrl || {
      userAgent: 'ValueCanvas contact@valuecanvas.com',
      rateLimit: 10,
    },
    marketData: config.marketData || {
      provider: 'alphavantage' as const,
      apiKey: process.env.ALPHA_VANTAGE_API_KEY || '',
      rateLimit: 5,
    },
    privateCompany: config.privateCompany || {
      enableWebScraping: false,
    },
    industryBenchmark: config.industryBenchmark || {
      enableStaticData: true,
    },
    truthLayer: config.truthLayer || {
      enableFallback: true,
      strictMode: true,
      maxResolutionTime: 30000,
      parallelQuery: false,
    },
    security: config.security || {
      enableWhitelist: true,
      enableRateLimiting: true,
      enableAuditLogging: true,
    },
  };

  const server = new MCPFinancialGroundTruthServer(serverConfig);
  await server.initialize();
  
  return server;
}

/**
 * Quick start function for development/testing
 */
export async function createDevServer() {
  return createMCPServer({
    edgar: {
      userAgent: 'ValueCanvas Development contact@valuecanvas.com',
    },
    xbrl: {
      userAgent: 'ValueCanvas Development contact@valuecanvas.com',
    },
    marketData: {
      provider: 'alphavantage',
      apiKey: process.env.ALPHA_VANTAGE_API_KEY || 'demo',
    },
    industryBenchmark: {
      enableStaticData: true,
    },
    truthLayer: {
      enableFallback: true,
      strictMode: false, // More lenient for development
    },
  });
}
