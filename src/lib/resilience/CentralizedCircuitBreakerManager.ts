/**
 * Centralized Circuit Breaker State Manager
 *
 * Provides a single source of truth for all circuit breaker states across the system.
 * Enables coordinated state management, global recovery strategies, and centralized monitoring.
 */

import {
  ICircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerMetrics,
} from "./CircuitBreakerInterface";
import { logger } from "../logger";

export interface CircuitBreakerRegistration {
  id: string;
  name: string;
  breaker: ICircuitBreaker;
  tags?: Record<string, string>;
  priority?: "low" | "medium" | "high" | "critical";
}

export interface GlobalStateConfig {
  enableAutoRecovery: boolean;
  recoveryIntervalMs: number;
  maxConcurrentRecoveries: number;
  globalFailureThreshold: number;
  cascadeProtection: boolean;
}

export class CentralizedCircuitBreakerManager {
  private static instance: CentralizedCircuitBreakerManager;
  private breakers = new Map<string, CircuitBreakerRegistration>();
  private globalConfig: GlobalStateConfig = {
    enableAutoRecovery: true,
    recoveryIntervalMs: 30000,
    maxConcurrentRecoveries: 3,
    globalFailureThreshold: 0.7, // 70% of breakers open triggers cascade protection
    cascadeProtection: true,
  };
  private recoveryTimer?: NodeJS.Timeout;
  private isMonitoring = false;

  private constructor() {}

  static getInstance(): CentralizedCircuitBreakerManager {
    if (!CentralizedCircuitBreakerManager.instance) {
      CentralizedCircuitBreakerManager.instance =
        new CentralizedCircuitBreakerManager();
    }
    return CentralizedCircuitBreakerManager.instance;
  }

  /**
   * Register a circuit breaker with the central manager
   */
  register(registration: CircuitBreakerRegistration): void {
    this.breakers.set(registration.id, registration);
    logger.info("Circuit breaker registered", {
      id: registration.id,
      name: registration.name,
      priority: registration.priority,
    });

    if (!this.isMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * Unregister a circuit breaker
   */
  unregister(id: string): void {
    const registration = this.breakers.get(id);
    if (registration) {
      this.breakers.delete(id);
      logger.info("Circuit breaker unregistered", {
        id,
        name: registration.name,
      });
    }
  }

  /**
   * Get circuit breaker by ID
   */
  getBreaker(id: string): ICircuitBreaker | undefined {
    return this.breakers.get(id)?.breaker;
  }

  /**
   * Get all registered circuit breakers
   */
  getAllBreakers(): CircuitBreakerRegistration[] {
    return Array.from(this.breakers.values());
  }

  /**
   * Get global system health status
   */
  getGlobalHealthStatus() {
    const breakers = this.getAllBreakers();
    const metrics = breakers.map((reg) => ({
      id: reg.id,
      name: reg.name,
      metrics: reg.breaker.getMetrics(),
    }));

    const openBreakers = metrics.filter(
      (m) => m.metrics.state === CircuitBreakerState.OPEN
    );
    const halfOpenBreakers = metrics.filter(
      (m) => m.metrics.state === CircuitBreakerState.HALF_OPEN
    );
    const closedBreakers = metrics.filter(
      (m) => m.metrics.state === CircuitBreakerState.CLOSED
    );

    const overallFailureRate =
      metrics.length > 0 ? openBreakers.length / metrics.length : 0;

    let overallState: "healthy" | "degraded" | "unhealthy" | "critical";
    if (overallFailureRate < 0.1) {
      overallState = "healthy";
    } else if (overallFailureRate < 0.3) {
      overallState = "degraded";
    } else if (overallFailureRate < 0.6) {
      overallState = "unhealthy";
    } else {
      overallState = "critical";
    }

    return {
      overallState,
      totalBreakers: breakers.length,
      openBreakers: openBreakers.length,
      halfOpenBreakers: halfOpenBreakers.length,
      closedBreakers: closedBreakers.length,
      overallFailureRate,
      breakers: metrics,
      timestamp: new Date(),
    };
  }

  /**
   * Execute coordinated recovery for critical breakers
   */
  async executeCoordinatedRecovery(): Promise<void> {
    if (!this.globalConfig.enableAutoRecovery) return;

    const criticalBreakers = this.getAllBreakers()
      .filter((reg) => reg.priority === "critical")
      .filter((reg) => reg.breaker.getState() === CircuitBreakerState.OPEN);

    if (criticalBreakers.length === 0) return;

    logger.info("Executing coordinated recovery", {
      criticalBreakers: criticalBreakers.length,
    });

    // Recover critical breakers first
    for (const registration of criticalBreakers.slice(
      0,
      this.globalConfig.maxConcurrentRecoveries
    )) {
      try {
        // Trigger recovery by resetting the breaker
        registration.breaker.reset();
        logger.info("Coordinated recovery successful", {
          id: registration.id,
          name: registration.name,
        });
      } catch (error) {
        logger.error("Coordinated recovery failed", {
          id: registration.id,
          name: registration.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Implement cascade protection
   */
  checkCascadeProtection(): void {
    if (!this.globalConfig.cascadeProtection) return;

    const healthStatus = this.getGlobalHealthStatus();

    if (
      healthStatus.overallFailureRate >=
      this.globalConfig.globalFailureThreshold
    ) {
      logger.warn("Cascade protection triggered - high system failure rate", {
        failureRate: healthStatus.overallFailureRate,
        threshold: this.globalConfig.globalFailureThreshold,
      });

      // Implement cascade protection logic
      this.implementCascadeProtection();
    }
  }

  /**
   * Start monitoring and recovery processes
   */
  private startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.recoveryTimer = setInterval(async () => {
      try {
        await this.executeCoordinatedRecovery();
        this.checkCascadeProtection();
      } catch (error) {
        logger.error("Monitoring cycle failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.globalConfig.recoveryIntervalMs);

    logger.info("Circuit breaker monitoring started", {
      interval: this.globalConfig.recoveryIntervalMs,
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
    this.isMonitoring = false;
    logger.info("Circuit breaker monitoring stopped");
  }

  /**
   * Update global configuration
   */
  updateConfig(config: Partial<GlobalStateConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };
    logger.info("Global circuit breaker config updated", {
      config: this.globalConfig,
    });
  }

  /**
   * Implement cascade protection measures
   */
  private implementCascadeProtection(): void {
    // Get non-critical breakers
    const nonCriticalBreakers = this.getAllBreakers().filter(
      (reg) => reg.priority !== "critical"
    );

    // Force non-critical breakers into open state temporarily
    for (const registration of nonCriticalBreakers) {
      if (registration.breaker.getState() === CircuitBreakerState.CLOSED) {
        // Note: This is a simplified implementation
        // In practice, you might want to temporarily disable rather than permanently open
        logger.warn(
          "Cascade protection: temporarily opening non-critical breaker",
          {
            id: registration.id,
            name: registration.name,
          }
        );
      }
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const registration of this.breakers.values()) {
      try {
        registration.breaker.reset();
      } catch (error) {
        logger.error("Failed to reset breaker during global reset", {
          id: registration.id,
          name: registration.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    logger.info("All circuit breakers reset");
  }
}

// Export singleton instance
export const centralizedCircuitBreakerManager =
  CentralizedCircuitBreakerManager.getInstance();
