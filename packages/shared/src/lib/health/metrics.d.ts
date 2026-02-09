/**
 * Health check metrics collector
 * Tracks latency and failure rates for health checks
 */
import type { HealthCheckResult } from "./checkUtils";
interface HealthCheckMetric {
    service: string;
    timestamp: number;
    latency: number;
    success: boolean;
    error?: string;
}
interface HealthStatusSnapshot {
    timestamp: number;
    overallStatus: "healthy" | "degraded" | "unhealthy";
    checks: Record<string, {
        status: "healthy" | "degraded" | "unhealthy" | "not_configured";
        latency?: number;
        message?: string;
    }>;
}
declare class HealthMetricsCollector {
    private metrics;
    private healthHistory;
    private readonly maxMetrics;
    private readonly maxHistory;
    recordMetric(service: string, latency: number, success: boolean, error?: string): void;
    recordHealthSnapshot(overallStatus: "healthy" | "degraded" | "unhealthy", checks: Record<string, any>): void;
    getHealthHistory(timeWindowMs?: number): HealthStatusSnapshot[];
    getHealthTrends(timeWindowMs?: number): {
        overall: {
            healthy: number;
            degraded: number;
            unhealthy: number;
            total: number;
        };
        services: Record<string, {
            healthy: number;
            degraded: number;
            unhealthy: number;
            notConfigured: number;
            total: number;
        }>;
    };
    getMetrics(service?: string, timeWindowMs?: number): HealthCheckMetric[];
    getStats(service?: string, timeWindowMs?: number): {
        total: number;
        successful: number;
        failed: number;
        successRate: number;
        avgLatency: number;
        p95Latency: number;
        p99Latency: number;
    };
    getServiceStats(timeWindowMs?: number): Record<string, any>;
}
export declare const healthMetrics: HealthMetricsCollector;
/**
 * Enhanced health check result with metrics tracking
 */
export interface EnhancedHealthCheckResult {
    healthy: boolean;
    message: string;
    latency?: number;
    service: string;
}
/**
 * Wrapper to track metrics for health check functions
 */
export declare function withMetrics<T extends any[], R extends Promise<HealthCheckResult> | HealthCheckResult>(service: string, fn: (...args: T) => R): (...args: T) => R;
export {};
//# sourceMappingURL=metrics.d.ts.map