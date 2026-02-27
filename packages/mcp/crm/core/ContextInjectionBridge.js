"use strict";
/**
 * CRM Context Injection Bridge
 *
 * Connects live CRM deal data to the Ground Truth Engine and Financial Templates.
 * This service transforms normalized CRM context into template-ready data sources.
 *
 * Flow: CRM Deal → crm_get_deal_context → ContextInjectionBridge → TemplateDataSource
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextInjectionBridge = void 0;
exports.getContextInjectionBridge = getContextInjectionBridge;
const logger_1 = require("../../lib/logger");
const MCPCRMServer_1 = require("./MCPCRMServer");
class ContextInjectionBridge {
    tenantId;
    userId;
    crmServer = null;
    contextCache = new Map();
    cacheTTLMs;
    enableAutoCleanup;
    autoCleanupIntervalMs;
    cleanupIntervalId;
    // Cache statistics
    cacheStats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        sets: 0,
    };
    constructor(tenantId, userId, options = {}) {
        this.tenantId = tenantId;
        this.userId = userId;
        this.cacheTTLMs = options.cacheTTLMs ?? 5 * 60 * 1000; // 5 minutes default
        this.enableAutoCleanup = options.enableAutoCleanup ?? true;
        this.autoCleanupIntervalMs =
            options.autoCleanupIntervalMs ?? 10 * 60 * 1000; // 10 minutes default
    }
    /**
     * Initialize the bridge with CRM connection
     */
    async initialize() {
        this.crmServer = await (0, MCPCRMServer_1.getMCPCRMServer)(this.tenantId, this.userId);
        // Start auto cleanup if enabled
        if (this.enableAutoCleanup) {
            this.startAutoCleanup();
        }
        logger_1.logger.info("ContextInjectionBridge initialized", {
            tenantId: this.tenantId,
            cacheTTLMs: this.cacheTTLMs,
            enableAutoCleanup: this.enableAutoCleanup,
        });
    }
    /**
     * Get live deal context from CRM
     */
    async getDealContext(dealId, includeHistory = false) {
        // Check cache first
        const cached = this.contextCache.get(dealId);
        if (cached && cached.expires > Date.now()) {
            this.cacheStats.hits++;
            cached.lastAccessed = Date.now();
            logger_1.logger.debug("Using cached deal context", { dealId });
            return cached.data;
        }
        // Cache miss or expired
        this.cacheStats.misses++;
        if (cached) {
            this.cacheStats.evictions++;
            this.contextCache.delete(dealId);
        }
        if (!this.crmServer) {
            await this.initialize();
        }
        const result = await this.crmServer.executeTool("crm_get_deal_context", {
            deal_id: dealId,
            include_history: includeHistory,
        });
        if (!result.success || !result.data) {
            logger_1.logger.warn("Failed to get deal context", {
                dealId,
                error: result.error,
            });
            return null;
        }
        const context = result.data.context;
        // Cache the result
        this.contextCache.set(dealId, {
            data: context,
            expires: Date.now() + this.cacheTTLMs,
            lastAccessed: Date.now(),
        });
        this.cacheStats.sets++;
        return context;
    }
    /**
     * Transform CRM deal context into TemplateDataSource for financial templates
     */
    async injectIntoTemplate(dealId, options = {}) {
        const context = await this.getDealContext(dealId, options.includeHistory);
        if (!context)
            return null;
        const multiplier = options.scenarioMultiplier ?? 1.0;
        const config = options.templateConfig ?? {};
        const timeHorizon = config.timeHorizonMonths ?? 36;
        const discountRate = config.discountRate ?? 0.1;
        // Transform to TemplateDataSource
        const dataSource = this.buildTemplateDataSource(context, multiplier, timeHorizon, discountRate, options.metricOverrides);
        return {
            dataSource,
            metadata: {
                dealId: context.dealId,
                provider: context.provider,
                injectedAt: new Date().toISOString(),
                cacheKey: `${dealId}-${multiplier}-${timeHorizon}`,
            },
        };
    }
    /**
     * Build complete TemplateDataSource from deal context
     */
    buildTemplateDataSource(context, multiplier, timeHorizonMonths, discountRate, overrides) {
        const dealValue = context.financial.dealValue * multiplier;
        const expectedValue = context.financial.expectedValue * multiplier;
        // Calculate derived metrics
        const annualValue = dealValue;
        const monthlyValue = annualValue / 12;
        const projectedRevenue = annualValue * (timeHorizonMonths / 12);
        // Estimate cost savings (typically 15-25% of deal value for B2B)
        const costSavingsRatio = 0.2;
        const estimatedCostSavings = dealValue * costSavingsRatio;
        // Risk reduction estimate (5-10% of deal value)
        const riskReductionRatio = 0.08;
        const estimatedRiskReduction = dealValue * riskReductionRatio;
        // Calculate ROI (simplified: net benefit / investment)
        const estimatedImplementationCost = dealValue * 0.15; // 15% implementation cost
        const netBenefit = dealValue +
            estimatedCostSavings +
            estimatedRiskReduction -
            estimatedImplementationCost;
        const roi = estimatedImplementationCost > 0
            ? (netBenefit / estimatedImplementationCost) * 100
            : 0;
        // Calculate NPV
        const npv = this.calculateNPV(annualValue, timeHorizonMonths, discountRate, estimatedImplementationCost);
        // Payback period (months)
        const paybackMonths = monthlyValue > 0
            ? Math.ceil(estimatedImplementationCost / monthlyValue)
            : 0;
        // Build metrics array
        const metrics = [
            {
                id: "deal-value",
                name: "Deal Value",
                value: dealValue,
                unit: "currency",
                category: "revenue",
                confidence: context.financial.probability / 100,
                source: `${context.provider}:${context.externalId}`,
            },
            {
                id: "expected-value",
                name: "Expected Value",
                value: expectedValue,
                unit: "currency",
                category: "revenue",
                confidence: context.financial.probability / 100,
            },
            {
                id: "monthly-revenue",
                name: "Monthly Revenue",
                value: monthlyValue,
                unit: "currency",
                category: "revenue",
                confidence: 0.8,
            },
            {
                id: "cost-savings",
                name: "Estimated Cost Savings",
                value: estimatedCostSavings,
                unit: "currency",
                category: "cost",
                confidence: 0.6,
            },
            {
                id: "risk-reduction",
                name: "Risk Reduction Value",
                value: estimatedRiskReduction,
                unit: "currency",
                category: "risk",
                confidence: 0.5,
            },
            {
                id: "roi",
                name: "Return on Investment",
                value: Math.round(roi),
                unit: "percentage",
                category: "financial",
                confidence: 0.7,
            },
            {
                id: "npv",
                name: "Net Present Value",
                value: Math.round(npv),
                unit: "currency",
                category: "financial",
                confidence: 0.7,
            },
            {
                id: "payback-period",
                name: "Payback Period",
                value: paybackMonths,
                unit: "months",
                category: "financial",
                confidence: 0.75,
            },
        ];
        // Apply overrides
        if (overrides) {
            for (const metric of metrics) {
                if (overrides[metric.id] !== undefined) {
                    metric.value = overrides[metric.id];
                }
            }
        }
        // Build outcomes based on stage
        const outcomes = this.buildOutcomes(context);
        // Build financial summary
        const financials = {
            totalValue: projectedRevenue,
            revenueImpact: dealValue,
            costSavings: estimatedCostSavings,
            riskReduction: estimatedRiskReduction,
            currency: context.financial.currency,
            timeframe: `${timeHorizonMonths} months`,
            confidence: context.financial.probability / 100,
        };
        return {
            metrics,
            outcomes,
            financials,
        };
    }
    /**
     * Build outcomes based on deal stage
     */
    buildOutcomes(context) {
        const outcomes = [];
        const stage = context.stage.normalized;
        // Current state outcome
        outcomes.push({
            id: "current-state",
            name: "Current Deal Status",
            description: `Deal with ${context.company.name} currently in ${context.stage.current} stage`,
            category: "operational",
            status: stage === "closed_won"
                ? "achieved"
                : stage === "closed_lost"
                    ? "at-risk"
                    : "in-progress",
            metrics: [
                {
                    id: "probability",
                    name: "Win Probability",
                    value: context.financial.probability,
                    unit: "percentage",
                },
            ],
        });
        // Revenue outcome
        outcomes.push({
            id: "revenue-outcome",
            name: "Revenue Generation",
            description: `Expected ${context.financial.currency} ${context.financial.dealValue.toLocaleString()} in annual revenue`,
            category: "revenue",
            status: context.financial.probability >= 70
                ? "on-track"
                : context.financial.probability >= 40
                    ? "in-progress"
                    : "at-risk",
            metrics: [
                {
                    id: "deal-value",
                    name: "Deal Value",
                    value: context.financial.dealValue,
                    unit: "currency",
                },
            ],
        });
        // Timeline outcome
        if (context.stage.daysToClose !== null) {
            outcomes.push({
                id: "timeline",
                name: "Close Timeline",
                description: context.stage.daysToClose > 0
                    ? `${context.stage.daysToClose} days until expected close`
                    : "Close date has passed",
                category: "operational",
                status: context.stage.daysToClose > 30
                    ? "on-track"
                    : context.stage.daysToClose > 0
                        ? "in-progress"
                        : "at-risk",
            });
        }
        // Engagement outcome (if history available)
        if (context.history) {
            outcomes.push({
                id: "engagement",
                name: "Stakeholder Engagement",
                description: `${context.history.recentActivityCount} recent activities (${context.history.activityTypes.join(", ")})`,
                category: "operational",
                status: context.history.recentActivityCount >= 5
                    ? "on-track"
                    : context.history.recentActivityCount >= 2
                        ? "in-progress"
                        : "at-risk",
            });
        }
        return outcomes;
    }
    /**
     * Calculate Net Present Value
     */
    calculateNPV(annualCashFlow, months, discountRate, initialInvestment) {
        const years = months / 12;
        let npv = -initialInvestment;
        for (let year = 1; year <= Math.ceil(years); year++) {
            const fraction = year <= years ? 1 : years - Math.floor(years);
            npv += (annualCashFlow * fraction) / Math.pow(1 + discountRate, year);
        }
        return npv;
    }
    /**
     * Sync calculated metrics back to CRM
     */
    async syncMetricsToCRM(dealId, metrics, dryRun = false) {
        if (!this.crmServer) {
            await this.initialize();
        }
        const result = await this.crmServer.executeTool("crm_sync_metrics", {
            deal_id: dealId,
            metrics,
            dry_run: dryRun,
        });
        return {
            success: result.success,
            message: result.success
                ? result.data?.message || "Metrics synced successfully"
                : result.error || "Failed to sync metrics",
        };
    }
    /**
     * Start automatic cleanup of expired cache entries
     */
    startAutoCleanup() {
        if (this.cleanupIntervalId) {
            clearInterval(this.cleanupIntervalId);
        }
        this.cleanupIntervalId = setInterval(() => {
            this.cleanupExpiredEntries();
        }, this.autoCleanupIntervalMs);
        logger_1.logger.debug("Started cache auto cleanup", {
            intervalMs: this.autoCleanupIntervalMs,
            tenantId: this.tenantId,
        });
    }
    /**
     * Manually cleanup expired cache entries
     */
    cleanupExpiredEntries() {
        const now = Date.now();
        let cleaned = 0;
        for (const [dealId, entry] of this.contextCache.entries()) {
            if (entry.expires <= now) {
                this.contextCache.delete(dealId);
                this.cacheStats.evictions++;
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger_1.logger.debug("Cleaned up expired cache entries", {
                cleaned,
                remaining: this.contextCache.size,
                tenantId: this.tenantId,
            });
        }
    }
    /**
     * Clear context cache with advanced options
     */
    clearCache(options) {
        if (!options || options.force) {
            // Clear all cache
            const size = this.contextCache.size;
            this.contextCache.clear();
            this.cacheStats.evictions += size;
            logger_1.logger.info("Cleared entire cache", {
                tenantId: this.tenantId,
                entriesCleared: size,
            });
            return;
        }
        if (options.dealId) {
            // Clear specific deal
            if (this.contextCache.has(options.dealId)) {
                this.contextCache.delete(options.dealId);
                this.cacheStats.evictions++;
                logger_1.logger.debug("Cleared cache for deal", { dealId: options.dealId });
            }
            return;
        }
        if (options.olderThan) {
            // Clear entries older than specified time
            const cutoff = Date.now() - options.olderThan;
            let cleared = 0;
            for (const [dealId, entry] of this.contextCache.entries()) {
                if (entry.lastAccessed < cutoff) {
                    this.contextCache.delete(dealId);
                    this.cacheStats.evictions++;
                    cleared++;
                }
            }
            logger_1.logger.debug("Cleared old cache entries", {
                cleared,
                olderThan: options.olderThan,
            });
        }
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const totalRequests = this.cacheStats.hits + this.cacheStats.misses;
        const hitRate = totalRequests > 0 ? (this.cacheStats.hits / totalRequests) * 100 : 0;
        return {
            ...this.cacheStats,
            currentSize: this.contextCache.size,
            hitRate: Math.round(hitRate * 100) / 100,
            ttlMs: this.cacheTTLMs,
            tenantId: this.tenantId,
        };
    }
    /**
     * Shutdown and cleanup resources
     */
    shutdown() {
        if (this.cleanupIntervalId) {
            clearInterval(this.cleanupIntervalId);
            this.cleanupIntervalId = undefined;
        }
        this.contextCache.clear();
        logger_1.logger.info("ContextInjectionBridge shutdown", { tenantId: this.tenantId });
    }
}
exports.ContextInjectionBridge = ContextInjectionBridge;
// ============================================================================
// Factory Function
// ============================================================================
const bridgeInstances = new Map();
async function getContextInjectionBridge(tenantId, userId) {
    const key = `${tenantId}:${userId}`;
    if (!bridgeInstances.has(key)) {
        const bridge = new ContextInjectionBridge(tenantId, userId);
        await bridge.initialize();
        bridgeInstances.set(key, bridge);
    }
    return bridgeInstances.get(key);
}
//# sourceMappingURL=ContextInjectionBridge.js.map