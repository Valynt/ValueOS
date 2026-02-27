/**
 * MCP Financial Ground Truth Server - Main Export
 *
 * Central export point for the MCP Financial Ground Truth Server.
 * Provides easy access to all modules, types, and the main server class.
 */
// Core exports
export { MCPFinancialGroundTruthServer } from "./core/MCPServer";
export { UnifiedTruthLayer } from "./core/UnifiedTruthLayer";
export { BaseModule } from "./core/BaseModule";
// Module exports
export { EDGARModule } from "./modules/EDGARModule";
export { XBRLModule } from "./modules/XBRLModule";
export { MarketDataModule } from "./modules/MarketDataModule";
export { PrivateCompanyModule } from "./modules/PrivateCompanyModule";
export { IndustryBenchmarkModule } from "./modules/IndustryBenchmarkModule";
export { EntityMappingModule } from "./modules/EntityMappingModule";
// Fix: Import from StructuralTruthModule which contains the ESOModule class
export { ESOModule } from "./modules/StructuralTruthModule";
// Type exports
export * from "./types";
// Utility function to create a configured server instance
export async function createMCPServer(config) {
    const { MCPFinancialGroundTruthServer } = await import("./core/MCPServer");
    // Set defaults
    const serverConfig = {
        edgar: config.edgar || {
            userAgent: "ValueCanvas contact@valuecanvas.com",
            rateLimit: 10,
        },
        xbrl: config.xbrl || {
            userAgent: "ValueCanvas contact@valuecanvas.com",
            rateLimit: 10,
        },
        marketData: config.marketData || {
            provider: "alphavantage",
            apiKey: process.env.ALPHA_VANTAGE_API_KEY || "",
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
    // Validate required API keys
    if (!serverConfig.marketData.apiKey) {
        throw new Error("ALPHA_VANTAGE_API_KEY environment variable is required for market data functionality");
    }
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
            userAgent: "ValueCanvas Development contact@valuecanvas.com",
        },
        xbrl: {
            userAgent: "ValueCanvas Development contact@valuecanvas.com",
        },
        marketData: {
            provider: "alphavantage",
            apiKey: process.env.ALPHA_VANTAGE_API_KEY || "demo",
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
//# sourceMappingURL=index.js.map