/**
 * Health check utilities for ValueOS agents
 * Provides standardized health endpoints and checks
 */

import { Request, Response } from "express";

export interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptime: number;
  version?: string;
  checks?: Record<string, HealthCheckResult>;
}

export interface HealthCheckResult {
  status: "pass" | "fail" | "warn";
  timestamp: string;
  responseTime?: number;
  error?: string;
  details?: any;
}

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult> | HealthCheckResult;
  critical?: boolean; // If true, failure makes overall health unhealthy
}

/**
 * Health checker class
 */
export class HealthChecker {
  private checks: HealthCheck[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Add a health check
   */
  addCheck(check: HealthCheck): void {
    this.checks.push(check);
  }

  /**
   * Run all health checks
   */
  async runChecks(): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};

    for (const check of this.checks) {
      const startTime = Date.now();
      try {
        const result = await check.check();
        result.timestamp = new Date().toISOString();
        result.responseTime = Date.now() - startTime;
        results[check.name] = result;
      } catch (error) {
        results[check.name] = {
          status: "fail",
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return results;
  }

  /**
   * Get overall health status
   */
  async getHealthStatus(version?: string): Promise<HealthStatus> {
    const checks = await this.runChecks();
    const criticalChecks = this.checks.filter((c) => c.critical);
    const hasCriticalFailure = criticalChecks.some((c) => checks[c.name]?.status === "fail");

    const overallStatus = hasCriticalFailure ? "unhealthy" : "healthy";

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version,
      checks,
    };
  }
}

/**
 * Default health check functions
 */
export const defaultHealthChecks = {
  /**
   * Basic liveness check
   */
  liveness: (): HealthCheckResult => ({
    status: "pass",
    timestamp: new Date().toISOString(),
  }),

  /**
   * Memory usage check
   */
  memory: (): HealthCheckResult => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    return {
      status: usagePercent > 90 ? "fail" : usagePercent > 75 ? "warn" : "pass",
      timestamp: new Date().toISOString(),
      details: {
        heapUsed: Math.round(heapUsedMB),
        heapTotal: Math.round(heapTotalMB),
        usagePercent: Math.round(usagePercent),
      },
    };
  },
};

/**
 * Express middleware for health endpoint
 */
export function healthMiddleware(healthChecker: HealthChecker, version?: string) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const health = await healthChecker.getHealthStatus(version);
      const statusCode = health.status === "healthy" ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
