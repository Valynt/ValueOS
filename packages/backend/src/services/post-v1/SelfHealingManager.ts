/**
 * Self-Healing Manager for ValueOS Agent Fabric
 *
 * Orchestrates autonomous self-healing capabilities:
 * - Global rate limit management with exponential backoff
 * - Stall detection and automatic agent reset
 * - Reasoning trace persistence for debugging
 * - Telemetric feedback loops
 *
 * @version 1.0.0
 * @security Level: Critical - Manages system stability
 */

import { logger } from "../lib/logger.js";

import { AgentRetryManager } from "./agents/resilience/AgentRetryManager.js";
import { agentTelemetryService } from "./agents/telemetry/AgentTelemetryService.js";
import { getIntelligentCoordinator } from "./IntelligentCoordinator.js";
import { AuditTrailService } from "./security/AuditTrailService.js";

// ============================================================================
// Types
// ============================================================================

export interface SelfHealingConfig {
  /** Enable global rate limit management */
  enableGlobalRateLimit: boolean;
  /** Enable stall detection */
  enableStallDetection: boolean;
  /** Enable reasoning trace persistence */
  enableReasoningTrace: boolean;
  /** Stall timeout in milliseconds */
  stallTimeoutMs: number;
  /** Rate limit backoff base delay */
  rateLimitBaseDelayMs: number;
  /** Maximum rate limit backoff */
  rateLimitMaxDelayMs: number;
}

export interface HealingEvent {
  type: "rate_limit_triggered" | "stall_detected" | "agent_reset" | "reasoning_logged";
  traceId: string;
  agentId?: string;
  details: Record<string, any>;
  timestamp: number;
}

// ============================================================================
// Self-Healing Manager
// ============================================================================

export class SelfHealingManager {
  private static instance: SelfHealingManager;
  private config: SelfHealingConfig;
  private retryManager: AgentRetryManager;
  private coordinator = getIntelligentCoordinator();
  private auditTrail: AuditTrailService;
  private healingEvents: HealingEvent[] = [];
  private maxEventsHistory = 1000;

  private constructor(config: Partial<SelfHealingConfig> = {}) {
    this.config = {
      enableGlobalRateLimit: true,
      enableStallDetection: true,
      enableReasoningTrace: true,
      stallTimeoutMs: 30000,
      rateLimitBaseDelayMs: 1000,
      rateLimitMaxDelayMs: 300000,
      ...config,
    };

    this.retryManager = AgentRetryManager.getInstance();
    this.auditTrail = new AuditTrailService();

    this.initializeSelfHealing();
    logger.info("SelfHealingManager initialized", { config: this.config });
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<SelfHealingConfig>): SelfHealingManager {
    if (!SelfHealingManager.instance) {
      SelfHealingManager.instance = new SelfHealingManager(config);
    }
    return SelfHealingManager.instance;
  }

  /**
   * Initialize self-healing components
   */
  private initializeSelfHealing(): void {
    if (this.config.enableGlobalRateLimit) {
      this.initializeGlobalRateLimit();
    }

    if (this.config.enableStallDetection) {
      this.initializeStallDetection();
    }

    if (this.config.enableReasoningTrace) {
      this.initializeReasoningTrace();
    }
  }

  /**
   * Initialize global rate limit management
   */
  private initializeGlobalRateLimit(): void {
    logger.info("Global rate limit management enabled");
    // Rate limit logic is integrated into AgentRetryManager
  }

  /**
   * Initialize stall detection
   */
  private initializeStallDetection(): void {
    logger.info("Stall detection enabled", { stallTimeoutMs: this.config.stallTimeoutMs });
    // Stall detection is integrated into IntelligentCoordinator
  }

  /**
   * Initialize reasoning trace persistence
   */
  private initializeReasoningTrace(): void {
    logger.info("Reasoning trace persistence enabled");
    // Reasoning trace is integrated into BaseAgent
  }

  // ============================================================================
  // Healing Event Management
  // ============================================================================

  /**
   * Record a healing event
   */
  recordHealingEvent(event: Omit<HealingEvent, "timestamp">): void {
    const healingEvent: HealingEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.healingEvents.push(healingEvent);

    // Maintain history limit
    if (this.healingEvents.length > this.maxEventsHistory) {
      this.healingEvents.shift();
    }

    // Log to audit trail
    this.auditTrail.log({
      eventType: "compliance_violation", // Using existing type, could add new one
      actorId: "self-healing-manager",
      actorType: "system",
      resourceId: event.traceId,
      resourceType: "agent_execution",
      action: event.type,
      outcome: "success",
      details: event.details,
      ipAddress: "internal",
      userAgent: "SelfHealingManager",
      sessionId: event.traceId,
      correlationId: event.traceId,
      riskScore: 0,
      complianceFlags: ["self_healing"],
      tenantId: event.details.tenantId,
    });

    // Record telemetry
    agentTelemetryService.recordTelemetryEvent({
      type: `self_healing_${event.type}`,
      agentType: "system" as any,
      data: {
        traceId: event.traceId,
        agentId: event.agentId,
        ...event.details,
      },
      severity: "info",
    });

    logger.info("Self-healing event recorded", healingEvent);
  }

  /**
   * Get recent healing events
   */
  getRecentHealingEvents(limit = 100): HealingEvent[] {
    return this.healingEvents.slice(-limit);
  }

  // ============================================================================
  // Health Monitoring
  // ============================================================================

  /**
   * Get self-healing health status
   */
  getHealthStatus(): {
    globalRateLimitActive: boolean;
    activeExecutions: number;
    recentHealingEvents: number;
    config: SelfHealingConfig;
  } {
    return {
      globalRateLimitActive: (this.retryManager as any).globalRateLimitActive || false,
      activeExecutions: (this.coordinator as any).activeExecutions?.size || 0,
      recentHealingEvents: this.healingEvents.length,
      config: this.config,
    };
  }

  /**
   * Force reset of global rate limit
   */
  forceResetGlobalRateLimit(): void {
    const retryManager = this.retryManager as any;
    retryManager.globalRateLimitActive = false;
    retryManager.globalRateLimitUntil = 0;
    retryManager.rateLimitIncidents = 0;

    this.recordHealingEvent({
      type: "rate_limit_triggered",
      traceId: "system-reset",
      details: { action: "force_reset", reason: "manual" },
    });

    logger.info("Global rate limit manually reset");
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.coordinator.stopStallDetection?.();
    logger.info("SelfHealingManager cleanup completed");
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let selfHealingManagerInstance: SelfHealingManager | null = null;

export function getSelfHealingManager(config?: Partial<SelfHealingConfig>): SelfHealingManager {
  if (!selfHealingManagerInstance) {
    selfHealingManagerInstance = new SelfHealingManager(config);
  }
  return selfHealingManagerInstance;
}
