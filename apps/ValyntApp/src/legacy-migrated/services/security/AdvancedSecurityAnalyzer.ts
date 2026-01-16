/**
 * Advanced Security Analyzer with ML-based Threat Detection
 *
 * Provides intelligent security analysis including:
 * - Machine learning-based anomaly detection
 * - Adaptive rate limiting based on usage patterns
 * - Behavioral analysis for security threats
 * - Automated security incident response
 */

import { logger } from "../../utils/logger";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: "low" | "medium" | "high" | "critical";
  source: string;
  userId?: string;
  agentId?: string;
  sessionId?: string;
  description: string;
  data: Record<string, any>;
  confidence: number; // 0-1
  mitigations: string[];
}

export interface SecurityPattern {
  id: string;
  name: string;
  description: string;
  pattern: RegExp;
  severity: "low" | "medium" | "high" | "critical";
  category:
    | "injection"
    | "data_exfiltration"
    | "privilege_escalation"
    | "resource_abuse"
    | "anomaly";
  enabled: boolean;
}

export interface ThreatIntelligence {
  indicators: ThreatIndicator[];
  patterns: SecurityPattern[];
  riskFactors: RiskFactor[];
  lastUpdated: Date;
}

export interface ThreatIndicator {
  type: "ip" | "domain" | "hash" | "pattern" | "behavior";
  value: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  source: string;
  confidence: number;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  threshold: number;
  currentValue: number;
  category: "behavioral" | "technical" | "contextual";
}

export interface SecurityMetrics {
  totalEvents: number;
  criticalEvents: number;
  highEvents: number;
  mediumEvents: number;
  lowEvents: number;
  blockedRequests: number;
  falsePositives: number;
  detectionAccuracy: number;
  averageResponseTime: number;
}

export interface AdaptiveRateLimit {
  baseLimit: number;
  currentLimit: number;
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  adaptiveMultiplier: number;
  lastAdjusted: Date;
}

export type SecurityEventType =
  | "sql_injection_attempt"
  | "xss_attempt"
  | "command_injection"
  | "path_traversal"
  | "data_exfiltration"
  | "privilege_escalation"
  | "resource_abuse"
  | "anomalous_behavior"
  | "rate_limit_exceeded"
  | "unauthorized_access"
  | "malicious_payload"
  | "suspicious_pattern";

export class AdvancedSecurityAnalyzer extends EventEmitter {
  private threatIntelligence: ThreatIntelligence;
  private securityEvents: SecurityEvent[] = [];
  private metrics: SecurityMetrics;
  private rateLimits: Map<string, AdaptiveRateLimit> = new Map();
  private behaviorProfiles: Map<string, BehaviorProfile> = new Map();
  private mlModels: Map<string, MLModel> = new Map();
  private maxEventsHistory = 10000;

  constructor() {
    super();
    this.threatIntelligence = this.initializeThreatIntelligence();
    this.metrics = this.initializeMetrics();
    this.initializeMLModels();
    this.startPeriodicAnalysis();
  }

  /**
   * Analyze security event with ML-based detection
   */
  async analyzeSecurityEvent(event: Partial<SecurityEvent>): Promise<SecurityEvent> {
    const securityEvent: SecurityEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type: event.type || "anomalous_behavior",
      severity: event.severity || "medium",
      source: event.source || "unknown",
      userId: event.userId,
      agentId: event.agentId,
      sessionId: event.sessionId,
      description: event.description || "Security event detected",
      data: event.data || {},
      confidence: 0,
      mitigations: [],
    };

    // ML-based threat detection
    const mlScore = await this.mlThreatDetection(securityEvent);
    securityEvent.confidence = mlScore;

    // Pattern matching
    const patternMatch = this.patternMatching(securityEvent);
    if (patternMatch) {
      const currentSeverity = this.getSeverityLevel(securityEvent.severity);
      const patternSeverity = this.getSeverityLevel(patternMatch.severity);
      const maxSeverity = Math.max(currentSeverity, patternSeverity);
      securityEvent.severity = this.getSeverityName(maxSeverity);
      securityEvent.confidence = Math.max(securityEvent.confidence, 0.8);
    }

    // Behavioral analysis
    const behaviorScore = this.behavioralAnalysis(securityEvent);
    securityEvent.confidence = Math.max(securityEvent.confidence, behaviorScore);

    // Generate mitigations
    securityEvent.mitigations = this.generateMitigations(securityEvent);

    // Update metrics
    this.updateMetrics(securityEvent);

    // Store event
    this.securityEvents.push(securityEvent);
    if (this.securityEvents.length > this.maxEventsHistory) {
      this.securityEvents.shift();
    }

    // Emit event
    this.emit("securityEvent", securityEvent);

    // Auto-respond if critical
    if (securityEvent.severity === "critical") {
      await this.autoResponse(securityEvent);
    }

    return securityEvent;
  }

  /**
   * Machine learning-based threat detection
   */
  private async mlThreatDetection(event: SecurityEvent): Promise<number> {
    const model = this.mlModels.get("threat_detection");
    if (!model) return 0.5; // Default confidence

    try {
      const features = this.extractFeatures(event);
      const prediction = await model.predict(features);
      return prediction.confidence;
    } catch (error) {
      logger.error("ML threat detection failed", error);
      return 0.5;
    }
  }

  /**
   * Extract features for ML model
   */
  private extractFeatures(event: SecurityEvent): number[] {
    const features = [
      this.getSeverityLevel(event.severity) / 3, // Normalized severity
      event.data.requestSize || 0,
      event.data.responseTime || 0,
      event.data.errorCount || 0,
      event.data.authFailures || 0,
      event.data.suspiciousPatterns || 0,
      event.data.anomalyScore || 0,
      event.data.riskScore || 0,
    ];

    return features;
  }

  /**
   * Pattern matching against known threats
   */
  private patternMatching(event: SecurityEvent): SecurityPattern | null {
    const content = JSON.stringify(event.data);

    for (const pattern of this.threatIntelligence.patterns) {
      if (!pattern.enabled) continue;

      if (pattern.pattern.test(content)) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Behavioral analysis for anomaly detection
   */
  private behavioralAnalysis(event: SecurityEvent): number {
    if (!event.userId && !event.agentId) return 0.5;

    const profileKey = event.userId || event.agentId || "unknown";
    const profile = this.behaviorProfiles.get(profileKey);

    if (!profile) {
      // Create new profile
      this.behaviorProfiles.set(profileKey, {
        id: profileKey,
        baselineEvents: 0,
        anomalyScore: 0,
        lastActivity: new Date(),
        riskFactors: [],
      });
      return 0.5;
    }

    // Analyze deviation from baseline
    const deviation = this.calculateBehavioralDeviation(event, profile);
    return Math.min(1, deviation);
  }

  /**
   * Calculate behavioral deviation
   */
  private calculateBehavioralDeviation(event: SecurityEvent, profile: BehaviorProfile): number {
    // Simple deviation calculation based on event patterns
    const recentEvents = this.securityEvents.filter(
      (e) =>
        (e.userId === profile.id || e.agentId === profile.id) &&
        e.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (recentEvents.length < 5) return 0.5; // Not enough data

    const avgSeverity =
      recentEvents.reduce((sum, e) => sum + this.getSeverityLevel(e.severity), 0) /
      recentEvents.length;
    const currentSeverity = this.getSeverityLevel(event.severity);

    return Math.abs(currentSeverity - avgSeverity) / 3; // Normalized deviation
  }

  /**
   * Generate automated mitigations
   */
  private generateMitigations(event: SecurityEvent): string[] {
    const mitigations: string[] = [];

    switch (event.type) {
      case "sql_injection_attempt":
        mitigations.push(
          "Block SQL injection patterns",
          "Sanitize input parameters",
          "Log attempt for review"
        );
        break;
      case "xss_attempt":
        mitigations.push("Sanitize HTML output", "Implement CSP headers", "Rate limit source IP");
        break;
      case "rate_limit_exceeded":
        mitigations.push("Apply rate limiting", "Temporarily block source", "Notify administrator");
        break;
      case "unauthorized_access":
        mitigations.push("Revoke session", "Require re-authentication", "Log security incident");
        break;
      default:
        mitigations.push(
          "Monitor for further activity",
          "Log event for analysis",
          "Review user permissions"
        );
    }

    if (event.severity === "critical") {
      mitigations.push(
        "Immediate account lockdown",
        "Security team notification",
        "Forensic analysis"
      );
    }

    return mitigations;
  }

  /**
   * Adaptive rate limiting based on behavior
   */
  getAdaptiveRateLimit(identifier: string): AdaptiveRateLimit {
    let rateLimit = this.rateLimits.get(identifier);

    if (!rateLimit) {
      rateLimit = {
        baseLimit: 100,
        currentLimit: 100,
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        adaptiveMultiplier: 1.0,
        lastAdjusted: new Date(),
      };
      this.rateLimits.set(identifier, rateLimit);
    }

    // Adjust based on recent security events
    this.adjustRateLimit(identifier, rateLimit);

    return rateLimit;
  }

  /**
   * Adjust rate limit based on security events
   */
  private adjustRateLimit(identifier: string, rateLimit: AdaptiveRateLimit): void {
    const recentEvents = this.securityEvents.filter(
      (e) =>
        (e.userId === identifier || e.agentId === identifier || e.sessionId === identifier) &&
        e.timestamp > new Date(Date.now() - rateLimit.windowMs)
    );

    const criticalEvents = recentEvents.filter((e) => e.severity === "critical").length;
    const highEvents = recentEvents.filter((e) => e.severity === "high").length;

    // Reduce limit for security events
    if (criticalEvents > 0) {
      rateLimit.currentLimit = Math.max(10, rateLimit.baseLimit * 0.1);
      rateLimit.adaptiveMultiplier = 0.1;
    } else if (highEvents > 2) {
      rateLimit.currentLimit = Math.max(20, rateLimit.baseLimit * 0.3);
      rateLimit.adaptiveMultiplier = 0.3;
    } else if (highEvents > 0) {
      rateLimit.currentLimit = Math.max(50, rateLimit.baseLimit * 0.7);
      rateLimit.adaptiveMultiplier = 0.7;
    } else {
      // Gradually restore limit if no security events
      rateLimit.currentLimit = Math.min(rateLimit.baseLimit, rateLimit.currentLimit * 1.1);
      rateLimit.adaptiveMultiplier = Math.min(1.0, rateLimit.adaptiveMultiplier * 1.05);
    }

    rateLimit.lastAdjusted = new Date();
  }

  /**
   * Automated response for critical security events
   */
  private async autoResponse(event: SecurityEvent): Promise<void> {
    logger.warn("Critical security event detected - initiating auto-response", event);

    // Block source if applicable
    if (event.userId) {
      await this.blockUser(event.userId);
    }

    if (event.agentId) {
      await this.blockAgent(event.agentId);
    }

    // Notify security team
    this.emit("criticalSecurityEvent", event);

    // Create incident ticket
    await this.createSecurityIncident(event);
  }

  /**
   * Block user account
   */
  private async blockUser(userId: string): Promise<void> {
    // Implementation would integrate with auth system
    logger.info(`Blocking user ${userId} due to critical security event`);
  }

  /**
   * Block agent
   */
  private async blockAgent(agentId: string): Promise<void> {
    // Implementation would disable agent
    logger.info(`Blocking agent ${agentId} due to critical security event`);
  }

  /**
   * Create security incident
   */
  private async createSecurityIncident(event: SecurityEvent): Promise<void> {
    // Implementation would create incident in ticketing system
    logger.info(`Creating security incident for event ${event.id}`);
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Get threat intelligence
   */
  getThreatIntelligence(): ThreatIntelligence {
    return { ...this.threatIntelligence };
  }

  /**
   * Update threat intelligence
   */
  updateThreatIntelligence(update: Partial<ThreatIntelligence>): void {
    this.threatIntelligence = { ...this.threatIntelligence, ...update, lastUpdated: new Date() };
    logger.info("Threat intelligence updated");
  }

// Create incident ticket
await this.createSecurityIncident(event);
}

/**
 * Block user account
 */
private async blockUser(userId: string): Promise<void> {
// Implementation would integrate with auth system
logger.info(`Blocking user ${userId} due to critical security event`);
}
      patterns: [
        {
          id: "sql_injection",
          name: "SQL Injection Pattern",
          description: "Detects common SQL injection patterns",
          pattern:
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|ALTER)\b.*(\b(FROM|INTO|SET|WHERE|TABLE|DATABASE)\b)/i,
          severity: "high",
          category: "injection",
          enabled: true,
        },
        {
          id: "xss_pattern",
          name: "XSS Pattern",
          description: "Detects cross-site scripting patterns",
          pattern: /(<script|javascript:|on\w+\s*=)/i,
          severity: "high",
          category: "injection",
          enabled: true,
        },
        {
          id: "path_traversal",
          name: "Path Traversal Pattern",
          description: "Detects path traversal attempts",
          pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/i,
          severity: "high",
          category: "injection",
          enabled: true,
        },
      ],
      riskFactors: [],
      lastUpdated: new Date(),
    };
  }

  private initializeMetrics(): SecurityMetrics {
    return {
      totalEvents: 0,
      criticalEvents: 0,
      highEvents: 0,
      mediumEvents: 0,
      lowEvents: 0,
      blockedRequests: 0,
      falsePositives: 0,
      detectionAccuracy: 0,
      averageResponseTime: 0,
    };
  }

  private initializeMLModels(): void {
    // Initialize ML models (simplified for demo)
    this.mlModels.set("threat_detection", {
      predict: async (features: number[]) => ({
        confidence: Math.random() * 0.3 + 0.7, // Mock prediction
        prediction: "threat",
      }),
    });
  }

  private updateMetrics(event: SecurityEvent): void {
    this.metrics.totalEvents++;

    switch (event.severity) {
      case "critical":
        this.metrics.criticalEvents++;
        break;
      case "high":
        this.metrics.highEvents++;
        break;
      case "medium":
        this.metrics.mediumEvents++;
        break;
      case "low":
        this.metrics.lowEvents++;
        break;
    }
  }

  private startPeriodicAnalysis(): void {
    setInterval(
      () => {
        this.performPeriodicAnalysis();
      },
      5 * 60 * 1000
    ); // Every 5 minutes
  }

  private performPeriodicAnalysis(): void {
    // Analyze trends, update models, etc.
    logger.debug("Performing periodic security analysis");
  }
}

interface BehaviorProfile {
  id: string;
  baselineEvents: number;
  anomalyScore: number;
  lastActivity: Date;
  riskFactors: string[];
}

interface MLModel {
  predict(features: number[]): Promise<{
    confidence: number;
    prediction: string;
  }>;
}

export const advancedSecurityAnalyzer = new AdvancedSecurityAnalyzer();
