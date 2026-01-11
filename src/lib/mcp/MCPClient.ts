/**
 * MCP Client Singleton
 *
 * Provides a shared instance of the MCPFinancialGroundTruthServer
 * to be used across the application.
 */

import { MCPFinancialGroundTruthServer } from '../../mcp-ground-truth';
import { logger } from '../logger';

let serverInstance: MCPFinancialGroundTruthServer | null = null;
let initializationPromise: Promise<MCPFinancialGroundTruthServer> | null = null;

export const getMCPServer = async (): Promise<MCPFinancialGroundTruthServer> => {
  if (serverInstance) {
    return serverInstance;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    logger.info('Initializing MCP Server Singleton');

    // Configuration would typically come from environment variables or settings
    const config = {
      edgar: {
        userAgent: process.env.EDGAR_USER_AGENT || "ValueCanvas contact@valuecanvas.com",
        rateLimit: 10,
      },
      xbrl: {
        userAgent: process.env.XBRL_USER_AGENT || "ValueCanvas contact@valuecanvas.com",
        rateLimit: 10,
      },
      marketData: {
        provider: "alphavantage" as const,
        apiKey: process.env.ALPHA_VANTAGE_API_KEY || "",
        rateLimit: 5,
      },
      privateCompany: {
        enableWebScraping: false,
      },
      industryBenchmark: {
        enableStaticData: true,
        blsApiKey: process.env.BLS_API_KEY,
        censusApiKey: process.env.CENSUS_API_KEY,
      },
      truthLayer: {
        enableFallback: true,
        strictMode: true,
        maxResolutionTime: 30000,
        parallelQuery: false,
      },
      security: {
        enableWhitelist: true,
        enableRateLimiting: true,
        enableAuditLogging: true,
      },
    };

    const server = new MCPFinancialGroundTruthServer(config);
    await server.initialize();

    serverInstance = server;
    return server;
  })();

  return initializationPromise;
};
