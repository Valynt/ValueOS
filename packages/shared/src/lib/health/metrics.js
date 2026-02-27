"use strict";
/**
 * Health check metrics collector
 * Tracks latency and failure rates for health checks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthMetrics = void 0;
exports.withMetrics = withMetrics;
class HealthMetricsCollector {
    metrics = [];
    healthHistory = [];
    maxMetrics = 1000; // Keep last 1000 metrics
    maxHistory = 100; // Keep last 100 health snapshots
    recordMetric(service, latency, success, error) {
        const metric = {
            service,
            timestamp: Date.now(),
            latency,
            success,
            error,
        };
        this.metrics.push(metric);
        // Keep only recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
    }
    recordHealthSnapshot(overallStatus, checks) {
        const snapshot = {
            timestamp: Date.now(),
            overallStatus,
            checks: { ...checks },
        };
        this.healthHistory.push(snapshot);
        // Keep only recent snapshots
        if (this.healthHistory.length > this.maxHistory) {
            this.healthHistory = this.healthHistory.slice(-this.maxHistory);
        }
    }
    getHealthHistory(timeWindowMs = 86400000) {
        // Default 24 hours
        const cutoff = Date.now() - timeWindowMs;
        return this.healthHistory.filter((snapshot) => snapshot.timestamp >= cutoff);
    }
    getHealthTrends(timeWindowMs = 3600000) {
        const history = this.getHealthHistory(timeWindowMs);
        const overall = {
            healthy: 0,
            degraded: 0,
            unhealthy: 0,
            total: history.length,
        };
        const services = {};
        for (const snapshot of history) {
            // Count overall status
            overall[snapshot.overallStatus]++;
            // Count service statuses
            for (const [service, check] of Object.entries(snapshot.checks)) {
                if (!services[service]) {
                    services[service] = {
                        healthy: 0,
                        degraded: 0,
                        unhealthy: 0,
                        notConfigured: 0,
                        total: 0,
                    };
                }
                services[service][check.status]++;
                services[service].total++;
            }
        }
        return { overall, services };
    }
    getMetrics(service, timeWindowMs = 3600000) {
        // Default 1 hour
        const cutoff = Date.now() - timeWindowMs;
        return this.metrics
            .filter((m) => m.timestamp >= cutoff)
            .filter((m) => !service || m.service === service);
    }
    getStats(service, timeWindowMs = 3600000) {
        const relevantMetrics = this.getMetrics(service, timeWindowMs);
        if (relevantMetrics.length === 0) {
            return {
                total: 0,
                successful: 0,
                failed: 0,
                successRate: 0,
                avgLatency: 0,
                p95Latency: 0,
                p99Latency: 0,
            };
        }
        const successful = relevantMetrics.filter((m) => m.success);
        const failed = relevantMetrics.filter((m) => !m.success);
        const latencies = relevantMetrics.map((m) => m.latency).sort((a, b) => a - b);
        const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        const p95Index = Math.floor(latencies.length * 0.95);
        const p99Index = Math.floor(latencies.length * 0.99);
        return {
            total: relevantMetrics.length,
            successful: successful.length,
            failed: failed.length,
            successRate: successful.length / relevantMetrics.length,
            avgLatency,
            p95Latency: latencies[p95Index] || 0,
            p99Latency: latencies[p99Index] || 0,
        };
    }
    getServiceStats(timeWindowMs = 3600000) {
        const services = [...new Set(this.metrics.map((m) => m.service))];
        const stats = {};
        for (const service of services) {
            stats[service] = this.getStats(service, timeWindowMs);
        }
        return stats;
    }
}
// Global metrics collector
exports.healthMetrics = new HealthMetricsCollector();
/**
 * Wrapper to track metrics for health check functions
 */
function withMetrics(service, fn) {
    return (...args) => {
        const startTime = Date.now();
        try {
            const result = fn(...args);
            if (result instanceof Promise) {
                return result
                    .then((res) => {
                    const latency = Date.now() - startTime;
                    exports.healthMetrics.recordMetric(service, latency, res.healthy);
                    return res;
                })
                    .catch((error) => {
                    const latency = Date.now() - startTime;
                    exports.healthMetrics.recordMetric(service, latency, false, error.message);
                    throw error;
                });
            }
            else {
                const latency = Date.now() - startTime;
                exports.healthMetrics.recordMetric(service, latency, result.healthy);
                return result;
            }
        }
        catch (error) {
            const latency = Date.now() - startTime;
            exports.healthMetrics.recordMetric(service, latency, false, error instanceof Error ? error.message : "Unknown error");
            throw error;
        }
    };
}
//# sourceMappingURL=metrics.js.map