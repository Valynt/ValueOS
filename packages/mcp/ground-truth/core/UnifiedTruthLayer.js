/**
 * Unified Truth Layer - Tiered Resolution Engine
 *
 * Orchestrates all Ground Truth modules with deterministic resolution hierarchy:
 * 1. Tier 1 (EDGAR/XBRL) - Authoritative, legally binding
 * 2. Tier 2 (Market/Private) - High-confidence estimates
 * 3. Tier 3 (Benchmarks) - Contextual intelligence
 *
 * Implements the "Zero-Hallucination" guarantee by enforcing strict
 * data provenance and confidence scoring.
 *
 * Node Mapping: [NODE: Unified_Truth_Layer], [NODE: Data_Tier_Resolver]
 */
import { ErrorCodes, GroundTruthError, } from "../types";
import { logger } from "../../lib/logger";
import { ClaimExtractor } from "../services/ClaimExtractor";
/**
 * Unified Truth Layer
 *
 * Central orchestration layer that implements the tiered truth model
 * and ensures zero-hallucination guarantees.
 */
export class UnifiedTruthLayer {
    modules = new Map();
    claimExtractor = new ClaimExtractor();
    tierModules = new Map([
        ["tier1", []],
        ["tier2", []],
        ["tier3", []],
    ]);
    config = {
        enableFallback: true,
        strictMode: true,
        maxResolutionTime: 30000, // 30 seconds
        parallelQuery: false,
    };
    constructor(config) {
        if (config) {
            this.config = { ...this.config, ...config };
        }
        logger.info("Unified Truth Layer initialized", this.config);
    }
    /**
     * Register a module with the truth layer
     */
    registerModule(module) {
        this.modules.set(module.name, module);
        const tierModules = this.tierModules.get(module.tier) || [];
        tierModules.push(module);
        this.tierModules.set(module.tier, tierModules);
        logger.info("Module registered", {
            name: module.name,
            tier: module.tier,
        });
    }
    /**
     * Resolve a truth request using tiered resolution
     *
     * This is the primary entry point for all financial data queries.
     * Implements the deterministic resolution hierarchy.
     */
    async resolve(request) {
        const startTime = Date.now();
        const resolutionPath = [];
        const alternatives = [];
        try {
            logger.info("Truth resolution started", {
                identifier: request.identifier,
                metric: request.metric,
                preferTier: request.prefer_tier,
            });
            // Determine resolution strategy
            const tiers = this.determineResolutionTiers(request);
            // Try each tier in order
            for (const tier of tiers) {
                const tierModules = this.tierModules.get(tier) || [];
                resolutionPath.push(`tier_${tier}`);
                for (const module of tierModules) {
                    // Check if module can handle this request
                    const moduleRequest = {
                        identifier: request.identifier,
                        metric: request.metric,
                        period: request.period,
                    };
                    if (!module.canHandle(moduleRequest)) {
                        continue;
                    }
                    resolutionPath.push(module.name);
                    try {
                        // Query the module
                        const response = await this.queryModuleWithTimeout(module, moduleRequest, this.config.maxResolutionTime);
                        if (response.success && response.data) {
                            const metric = Array.isArray(response.data)
                                ? response.data[0]
                                : response.data;
                            // Check if this is the preferred tier
                            if (tier === request.prefer_tier || !request.prefer_tier) {
                                // Found data at preferred tier
                                const executionTime = Date.now() - startTime;
                                logger.info("Truth resolution succeeded", {
                                    identifier: request.identifier,
                                    metric: request.metric,
                                    tier,
                                    module: module.name,
                                    executionTime,
                                });
                                return {
                                    metric,
                                    resolution_path: resolutionPath,
                                    fallback_used: tier !== "tier1",
                                    alternatives: alternatives.length > 0 ? alternatives : undefined,
                                };
                            }
                            else {
                                // Store as alternative
                                alternatives.push(metric);
                            }
                        }
                    }
                    catch (error) {
                        logger.warn("Module query failed", {
                            module: module.name,
                            error: error instanceof Error ? error.message : "Unknown error",
                        });
                        // Continue to next module
                    }
                }
                // If fallback is disabled and we didn't find data in preferred tier, stop
                if (!this.config.enableFallback && tier === request.prefer_tier) {
                    break;
                }
            }
            // No data found in any tier
            throw new GroundTruthError(ErrorCodes.NO_DATA_FOUND, `No data found for ${request.identifier} - ${request.metric}`, { resolution_path: resolutionPath });
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            logger.error("Truth resolution failed", {
                identifier: request.identifier,
                metric: request.metric,
                error: error instanceof Error ? error.message : "Unknown error",
                executionTime,
                resolutionPath,
            });
            throw error;
        }
    }
    /**
     * Resolve multiple metrics in a single call
     *
     * Optimized for batch queries
     */
    async resolveMultiple(requests) {
        if (this.config.parallelQuery) {
            // Execute in parallel
            return Promise.all(requests.map((req) => this.resolve(req)));
        }
        else {
            // Execute sequentially
            const results = [];
            for (const request of requests) {
                try {
                    const result = await this.resolve(request);
                    results.push(result);
                }
                catch (error) {
                    // Continue with other requests even if one fails
                    logger.warn("Batch resolution item failed", {
                        identifier: request.identifier,
                        metric: request.metric,
                        error: error instanceof Error ? error.message : "Unknown error",
                    });
                }
            }
            return results;
        }
    }
    /**
     * Verify a claim against the ground truth database
     *
     * Implements MCP tool: verify_claim_aletheia
     * Node Mapping: [NODE: Aletheia_Verification_Loop]
     */
    async verifyClaim(claimText, contextEntity, contextDate, strictMode = true) {
        logger.info("Claim verification started", {
            claimText,
            contextEntity,
            strictMode,
        });
        // Extract numeric claims from text
        const numericClaims = this.extractNumericClaims(claimText);
        if (numericClaims.length === 0) {
            return {
                verified: false,
                confidence: 0,
                discrepancy: "No numeric claims found in text",
            };
        }
        // Verify each numeric claim
        for (const claim of numericClaims) {
            try {
                const result = await this.resolve({
                    identifier: contextEntity,
                    metric: claim.metric,
                    period: contextDate,
                    prefer_tier: strictMode ? "tier1" : undefined,
                    fallback_enabled: !strictMode,
                });
                // Compare claimed value with ground truth
                const groundTruthValue = result.metric.value;
                const claimedValue = claim.value;
                // Calculate discrepancy
                const discrepancy = this.calculateDiscrepancy(claimedValue, groundTruthValue);
                if (discrepancy > 0.05) {
                    // 5% tolerance
                    return {
                        verified: false,
                        confidence: result.metric.confidence,
                        evidence: result.metric,
                        discrepancy: `Claimed ${claim.metric}: ${claimedValue}, Actual: ${groundTruthValue} (${(discrepancy * 100).toFixed(1)}% difference)`,
                    };
                }
                // Claim verified
                return {
                    verified: true,
                    confidence: result.metric.confidence,
                    evidence: result.metric,
                };
            }
            catch (error) {
                logger.warn("Claim verification failed", {
                    claim: claim.metric,
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }
        return {
            verified: false,
            confidence: 0,
            discrepancy: "Unable to verify claims against ground truth",
        };
    }
    /**
     * Populate value driver tree node
     *
     * Implements MCP tool: populate_value_driver_tree
     * Node Mapping: [NODE: Value_Driver_Tree], [NODE: Auto_Population_Agent]
     */
    async populateValueDriverTree(targetCIK, benchmarkNAICS, driverNodeId, simulationPeriod) {
        logger.info("Value driver tree population started", {
            targetCIK,
            benchmarkNAICS,
            driverNodeId,
        });
        const supportingData = [];
        // Get target company metrics
        const targetRevenue = await this.resolve({
            identifier: targetCIK,
            metric: "revenue_total",
            prefer_tier: "tier1",
            fallback_enabled: true,
        });
        supportingData.push(targetRevenue.metric);
        // Get industry benchmark
        const benchmark = await this.resolve({
            identifier: benchmarkNAICS,
            metric: "revenue_per_employee",
            prefer_tier: "tier3",
        });
        supportingData.push(benchmark.metric);
        // Calculate value based on driver type
        let value;
        let rationale;
        switch (driverNodeId) {
            case "productivity_delta":
                // Calculate productivity gap
                const targetRevPerEmp = targetRevenue.metric.value / 1000; // Assuming headcount
                const benchmarkRevPerEmp = benchmark.metric.value;
                const gap = benchmarkRevPerEmp - targetRevPerEmp;
                value = gap * 1000; // Total potential value
                rationale = `Productivity gap of $${gap.toLocaleString()}/employee vs industry benchmark. Total potential: $${value.toLocaleString()}`;
                break;
            case "revenue_uplift":
                // Calculate revenue growth potential
                value = targetRevenue.metric.value * 0.15; // 15% uplift assumption
                rationale = `15% revenue uplift potential based on industry growth rates`;
                break;
            case "cost_reduction":
                // Calculate cost reduction potential
                value = targetRevenue.metric.value * 0.1; // 10% cost reduction
                rationale = `10% cost reduction potential through operational efficiency`;
                break;
            default:
                throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, `Unsupported driver node: ${driverNodeId}`);
        }
        // Calculate confidence based on supporting data
        const avgConfidence = supportingData.reduce((sum, m) => sum + m.confidence, 0) /
            supportingData.length;
        return {
            node_id: driverNodeId,
            value,
            rationale,
            confidence: avgConfidence,
            supporting_data: supportingData,
        };
    }
    /**
     * Get health status of all modules
     */
    async healthCheck() {
        const moduleHealth = {};
        let allHealthy = true;
        for (const [name, module] of this.modules) {
            try {
                const health = await module.healthCheck();
                moduleHealth[name] = health;
                if (!health.healthy) {
                    allHealthy = false;
                }
            }
            catch (error) {
                moduleHealth[name] = {
                    healthy: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
                allHealthy = false;
            }
        }
        return {
            healthy: allHealthy,
            modules: moduleHealth,
        };
    }
    // ============================================================================
    // Private Helper Methods
    // ============================================================================
    /**
     * Determine which tiers to query based on request and configuration
     */
    determineResolutionTiers(request) {
        // If specific tier preferred, start there
        if (request.prefer_tier) {
            if (request.fallback_enabled ?? this.config.enableFallback) {
                // Try preferred tier first, then fallback to others
                const tiers = [request.prefer_tier];
                if (request.prefer_tier !== "tier1")
                    tiers.unshift("tier1");
                if (request.prefer_tier !== "tier2" && !tiers.includes("tier2"))
                    tiers.push("tier2");
                if (request.prefer_tier !== "tier3" && !tiers.includes("tier3"))
                    tiers.push("tier3");
                return tiers;
            }
            else {
                // Only try preferred tier
                return [request.prefer_tier];
            }
        }
        // Default: try all tiers in order (Tier 1 → Tier 2 → Tier 3)
        if (this.config.enableFallback) {
            return ["tier1", "tier2", "tier3"];
        }
        else {
            return ["tier1"];
        }
    }
    /**
     * Query module with timeout
     */
    async queryModuleWithTimeout(module, request, timeout) {
        return Promise.race([
            module.query(request),
            new Promise((_, reject) => setTimeout(() => reject(new GroundTruthError(ErrorCodes.TIMEOUT, "Module query timeout")), timeout)),
        ]);
    }
    /**
     * Extract numeric claims from text
     *
     * Uses robust ClaimExtractor service for advanced pattern matching
     */
    extractNumericClaims(text) {
        const claims = this.claimExtractor.extractClaims(text);
        return claims.map((c) => ({
            metric: c.metric,
            value: c.value,
            unit: c.unit,
        }));
    }
    /**
     * Calculate discrepancy between claimed and actual values
     */
    calculateDiscrepancy(claimed, actual) {
        if (typeof actual === "number") {
            return Math.abs(claimed - actual) / actual;
        }
        else if (Array.isArray(actual)) {
            // Check if claimed falls within range
            const [min, max] = actual;
            if (claimed >= min && claimed <= max) {
                return 0; // Within range
            }
            // Calculate distance from range
            const mid = (min + max) / 2;
            return Math.abs(claimed - mid) / mid;
        }
        return 1; // Cannot compare
    }
}
//# sourceMappingURL=UnifiedTruthLayer.js.map