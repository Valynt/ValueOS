"use strict";
/**
 * MCP Financial Ground Truth Server - Main Export
 *
 * Central export point for the MCP Financial Ground Truth Server.
 * Provides easy access to all modules, types, and the main server class.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ESOModule = exports.EntityMappingModule = exports.IndustryBenchmarkModule = exports.PrivateCompanyModule = exports.MarketDataModule = exports.XBRLModule = exports.EDGARModule = exports.BaseModule = exports.UnifiedTruthLayer = exports.MCPFinancialGroundTruthServer = void 0;
exports.createMCPServer = createMCPServer;
exports.createDevServer = createDevServer;
// Core exports
var MCPServer_1 = require("./core/MCPServer");
Object.defineProperty(exports, "MCPFinancialGroundTruthServer", { enumerable: true, get: function () { return MCPServer_1.MCPFinancialGroundTruthServer; } });
var UnifiedTruthLayer_1 = require("./core/UnifiedTruthLayer");
Object.defineProperty(exports, "UnifiedTruthLayer", { enumerable: true, get: function () { return UnifiedTruthLayer_1.UnifiedTruthLayer; } });
var BaseModule_1 = require("./core/BaseModule");
Object.defineProperty(exports, "BaseModule", { enumerable: true, get: function () { return BaseModule_1.BaseModule; } });
// Module exports
var EDGARModule_1 = require("./modules/EDGARModule");
Object.defineProperty(exports, "EDGARModule", { enumerable: true, get: function () { return EDGARModule_1.EDGARModule; } });
var XBRLModule_1 = require("./modules/XBRLModule");
Object.defineProperty(exports, "XBRLModule", { enumerable: true, get: function () { return XBRLModule_1.XBRLModule; } });
var MarketDataModule_1 = require("./modules/MarketDataModule");
Object.defineProperty(exports, "MarketDataModule", { enumerable: true, get: function () { return MarketDataModule_1.MarketDataModule; } });
var PrivateCompanyModule_1 = require("./modules/PrivateCompanyModule");
Object.defineProperty(exports, "PrivateCompanyModule", { enumerable: true, get: function () { return PrivateCompanyModule_1.PrivateCompanyModule; } });
var IndustryBenchmarkModule_1 = require("./modules/IndustryBenchmarkModule");
Object.defineProperty(exports, "IndustryBenchmarkModule", { enumerable: true, get: function () { return IndustryBenchmarkModule_1.IndustryBenchmarkModule; } });
var EntityMappingModule_1 = require("./modules/EntityMappingModule");
Object.defineProperty(exports, "EntityMappingModule", { enumerable: true, get: function () { return EntityMappingModule_1.EntityMappingModule; } });
// Fix: Import from StructuralTruthModule which contains the ESOModule class
var StructuralTruthModule_1 = require("./modules/StructuralTruthModule");
Object.defineProperty(exports, "ESOModule", { enumerable: true, get: function () { return StructuralTruthModule_1.ESOModule; } });
// Type exports
__exportStar(require("./types"), exports);
// Utility function to create a configured server instance
async function createMCPServer(config) {
    const { MCPFinancialGroundTruthServer } = await Promise.resolve().then(() => __importStar(require("./core/MCPServer")));
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
async function createDevServer() {
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