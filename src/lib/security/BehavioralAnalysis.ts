/**
 * Behavioral Analysis for Anomaly Detection
 *
 * Implements machine learning-based anomaly detection for agent communications,
 * behavioral profiling, and threat intelligence integration.
 */

import { logger } from '../logger';
import { AgentIdentity } from '../auth/AgentIdentity';

// ============================================================================
// Types
// ============================================================================

export interface AgentBehaviorProfile {
  agentId: string;
  baselineMetrics: {
    averageMessageFrequency: number; // messages per hour
    averageMessageSize: number; // bytes
    typicalRecipients: string[];
    typicalMessageTypes: string[];
    communicationPatterns: Map<string, number>; // time of day patterns
    errorRate: number; // percentage
    responseTime: number; // milliseconds
  };
  currentMetrics: {
    messageFrequency: number;
    messageSize: number;
    recipients: Set<string>;
    messageTypes: Set<string>;
    communicationPatterns: Map<string, number>;
    errorRate: number;
    responseTime: number;
  };
  riskScore: number; // 0-100
  lastUpdated: Date;
  anomalies: AnomalyEvent[];
}

export interface AnomalyEvent {
  id: string;
  type: 'frequency' | 'size' | 'recipients' | 'timing' | 'content' | 'behavior' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  agentId: string;
  metrics: {
    expected: number;
    actual: number;
    deviation: number; // standard deviations
    confidence: number; // 0-1
  };
  context: {
    sourceIP?: string;
    userAgent?: string;
    messageId?: string;
    recipientId?: string;
    messageType?: string;
  };
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: string;
}

export interface ThreatIntelligence {
  maliciousIPs: Set<string>;
  suspiciousDomains: Set<string>;
  knownAttackPatterns: Map<string, AttackPattern>;
  reputationScores: Map<string, number>; // IP/domain reputation
  lastUpdated: Date;
}

export interface AttackPattern {
  id: string;
  name: string;
  description: string;
  indicators: {
    messageFrequency?: { min: number; max: number };
    messageSize?: { min: number; max: number };
    recipientCount?: { min: number; max: number };
    timingPatterns?: string[];
    contentSignatures?: string[];
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation: string[];
}

export interface BehavioralAnalysisConfig {
  enabled: boolean;
  learningPeriod: number; // hours to establish baseline
  anomalyThreshold: number; // standard deviations
  riskScoreThreshold: number; // 0-100
  maxAnomaliesPerAgent: number;
  threatIntelUpdateInterval: number; // minutes
  mlModelUpdateInterval: number; // hours
  enableRealTimeDetection: boolean;
  enablePredictiveAnalysis: boolean;
}

// ============================================================================
// Behavioral Analysis Engine
// ============================================================================

export class BehavioralAnalysisEngine {
  private static instance: BehavioralAnalysisEngine;
  private config: BehavioralAnalysisConfig;
  private agentProfiles: Map<string, AgentBehaviorProfile> = new Map();
  private threatIntelligence: ThreatIntelligence;
  private anomalyEvents: Map<string, AnomalyEvent> = new Map();
  private globalMetrics: {
    totalAgents: number;
    totalMessages: number;
    totalAnomalies: number;
    averageRiskScore: number;
    highRiskAgents: number;
  };
  private mlModels: {
    frequencyModel: FrequencyAnomalyModel;
    sizeModel: SizeAnomalyModel;
    timingModel: TimingAnomalyModel;
    behaviorModel: BehaviorAnomalyModel;
  };

  private constructor(config: BehavioralAnalysisConfig) {
    this.config = config;
    this.threatIntelligence = {
      maliciousIPs: new Set(),
      suspiciousDomains: new Set(),
      knownAttackPatterns: new Map(),
      reputationScores: new Map(),
      lastUpdated: new Date(),
    };

    this.globalMetrics = {
      totalAgents: 0,
      totalMessages: 0,
      totalAnomalies: 0,
      averageRiskScore: 0,
      highRiskAgents: 0,
    };

    this.mlModels = {
      frequencyModel: new FrequencyAnomalyModel(),
      sizeModel: new SizeAnomalyModel(),
      timingModel: new TimingAnomalyModel(),
      behaviorModel: new BehaviorAnomalyModel(),
    };

    this.initializeThreatIntelligence();
    this.startPeriodicTasks();
  }

  static getInstance(config?: BehavioralAnalysisConfig): BehavioralAnalysisEngine {
    if (!BehavioralAnalysisEngine.instance) {
      if (!config) {
        throw new Error('Behavioral analysis config required for first initialization');
      }
      BehavioralAnalysisEngine.instance = new BehavioralAnalysisEngine(config);
    }
    return BehavioralAnalysisEngine.instance;
  }

  /**
   * Initialize threat intelligence data
   */
  private initializeThreatIntelligence(): void {
    // Load known attack patterns
    const attackPatterns: AttackPattern[] = [
      {
        id: 'message-flood',
        name: 'Message Flood Attack',
        description: 'Agent sending unusually high volume of messages',
        indicators: {
          messageFrequency: { min: 1000, max: 10000 },
          timingPatterns: ['rapid-fire'],
        },
        severity: 'high',
        mitigation: ['rate-limiting', 'temporarily-block'],
      },
      {
        id: 'data-exfiltration',
        name: 'Data Exfiltration',
        description: 'Large data transfers to unusual recipients',
        indicators: {
          messageSize: { min: 10485760, max: 1073741824 }, // 10MB - 1GB
          recipientCount: { min: 1, max: 5 },
        },
        severity: 'critical',
        mitigation: ['block-transfers', 'investigate-recipient'],
      },
      {
        id: 'unusual-timing',
        name: 'Unusual Timing Pattern',
        description: 'Communication outside normal business hours',
        indicators: {
          timingPatterns: ['after-hours', 'weekend'],
        },
        severity: 'medium',
        mitigation: ['require-additional-auth', 'audit-log'],
      },
      {
        id: 'recipient-anomaly',
        name: 'Unusual Recipient Pattern',
        description: 'Communication with unexpected or unauthorized agents',
        indicators: {
          recipientCount: { min: 10, max: 100 },
        },
        severity: 'medium',
        mitigation: ['verify-permissions', 'audit-access'],
      },
    ];

    attackPatterns.forEach(pattern => {
      this.threatIntelligence.knownAttackPatterns.set(pattern.id, pattern);
    });

    // Load threat intelligence feeds (in production, integrate with external feeds)
    this.updateThreatIntelligence();

    logger.info('Threat intelligence initialized', {
      attackPatterns: this.threatIntelligence.knownAttackPatterns.size,
      maliciousIPs: this.threatIntelligence.maliciousIPs.size,
    });
  }

  /**
   * Update threat intelligence from external sources
   */
  private async updateThreatIntelligence(): Promise<void> {
    try {
      // In production, integrate with:
      // - VirusTotal
      // - AlienVault OTX
      // - Recorded Future
      // - Internal threat feeds

      // For now, simulate with some sample data
      const sampleMaliciousIPs = [
        '192.168.1.100',
        '10.0.0.50',
        '172.16.0.25',
      ];

      const sampleSuspiciousDomains = [
        'malicious-domain.com',
        'suspicious-site.net',
        'threat-actor.org',
      ];

      sampleMaliciousIPs.forEach(ip => {
        this.threatIntelligence.maliciousIPs.add(ip);
        this.threatIntelligence.reputationScores.set(ip, 0);
      });

      sampleSuspiciousDomains.forEach(domain => {
        this.threatIntelligence.suspiciousDomains.add(domain);
        this.threatIntelligence.reputationScores.set(domain, 10);
      });

      this.threatIntelligence.lastUpdated = new Date();

      logger.info('Threat intelligence updated', {
        maliciousIPs: this.threatIntelligence.maliciousIPs.size,
        suspiciousDomains: this.threatIntelligence.suspiciousDomains.size,
      });
    } catch (error) {
      logger.error('Failed to update threat intelligence', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Analyze agent communication for anomalies
   */
  public analyzeCommunication(
    agentId: string,
    messageId: string,
    recipientId: string,
    messageType: string,
    messageSize: number,
    sourceIP: string,
    userAgent?: string
  ): AnomalyEvent[] {
    if (!this.config.enabled) {
      return [];
    }

    const anomalies: AnomalyEvent[] = [];
    const now = new Date();

    // Get or create agent profile
    let profile = this.agentProfiles.get(agentId);
    if (!profile) {
      profile = this.createAgentProfile(agentId);
      this.agentProfiles.set(agentId, profile);
    }

    // Update current metrics
    this.updateAgentMetrics(profile, recipientId, messageType, messageSize, now);

    // Check if baseline is established
    const timeSinceCreation = now.getTime() - profile.lastUpdated.getTime();
    if (timeSinceCreation < this.config.learningPeriod * 60 * 60 * 1000) {
      // Still in learning period, just collect data
      profile.lastUpdated = now;
      return [];
    }

    // Perform anomaly detection
    anomalies.push(...this.detectFrequencyAnomalies(profile, messageId));
    anomalies.push(...this.detectSizeAnomalies(profile, messageId, messageSize));
    anomalies.push(...this.detectRecipientAnomalies(profile, messageId, recipientId));
    anomalies.push(...this.detectTimingAnomalies(profile, messageId, now));
    anomalies.push(...this.detectBehaviorAnomalies(profile, messageId));
    anomalies.push(...this.detectSecurityAnomalies(profile, messageId, sourceIP, userAgent));

    // Update risk score
    profile.riskScore = this.calculateRiskScore(profile, anomalies);
    profile.lastUpdated = now;

    // Store anomalies
    anomalies.forEach(anomaly => {
      this.anomalyEvents.set(anomaly.id, anomaly);
      profile.anomalies.push(anomaly);
    });

    // Update global metrics
    this.updateGlobalMetrics();

    // Log significant anomalies
    const significantAnomalies = anomalies.filter(a => a.severity === 'high' || a.severity === 'critical');
    if (significantAnomalies.length > 0) {
      logger.warn('Significant anomalies detected', {
        agentId,
        anomalies: significantAnomalies.map(a => ({
          type: a.type,
          severity: a.severity,
          description: a.description,
        })),
        riskScore: profile.riskScore,
      });
    }

    return anomalies;
  }

  /**
   * Create new agent behavior profile
   */
  private createAgentProfile(agentId: string): AgentBehaviorProfile {
    return {
      agentId,
      baselineMetrics: {
        averageMessageFrequency: 0,
        averageMessageSize: 0,
        typicalRecipients: [],
        typicalMessageTypes: [],
        communicationPatterns: new Map(),
        errorRate: 0,
        responseTime: 0,
      },
      currentMetrics: {
        messageFrequency: 0,
        messageSize: 0,
        recipients: new Set(),
        messageTypes: new Set(),
        communicationPatterns: new Map(),
        errorRate: 0,
        responseTime: 0,
      },
      riskScore: 0,
      lastUpdated: new Date(),
      anomalies: [],
    };
  }

  /**
   * Update agent metrics with new communication data
   */
  private updateAgentMetrics(
    profile: AgentBehaviorProfile,
    recipientId: string,
    messageType: string,
    messageSize: number,
    timestamp: Date
  ): void {
    const current = profile.currentMetrics;

    // Update frequency (messages per hour)
    current.messageFrequency++;

    // Update message size
    current.messageSize = (current.messageSize + messageSize) / 2;

    // Update recipients
    current.recipients.add(recipientId);

    // Update message types
    current.messageTypes.add(messageType);

    // Update communication patterns (time of day)
    const hour = timestamp.getHours().toString();
    const currentCount = current.communicationPatterns.get(hour) || 0;
    current.communicationPatterns.set(hour, currentCount + 1);

    // Update baseline periodically
    if (profile.anomalies.length % 100 === 0) {
      this.updateBaseline(profile);
    }
  }

  /**
   * Update agent baseline metrics
   */
  private updateBaseline(profile: AgentBehaviorProfile): void {
    const current = profile.currentMetrics;
    const baseline = profile.baselineMetrics;

    // Update baseline with exponential moving average
    const alpha = 0.1; // Smoothing factor

    baseline.averageMessageFrequency = alpha * current.messageFrequency + (1 - alpha) * baseline.averageMessageFrequency;
    baseline.averageMessageSize = alpha * current.messageSize + (1 - alpha) * baseline.averageMessageSize;
    baseline.typicalRecipients = Array.from(current.recipients);
    baseline.typicalMessageTypes = Array.from(current.messageTypes);

    // Update communication patterns
    for (const [hour, count] of current.communicationPatterns) {
      const baselineCount = baseline.communicationPatterns.get(hour) || 0;
      baseline.communicationPatterns.set(hour, alpha * count + (1 - alpha) * baselineCount);
    }
  }

  /**
   * Detect frequency anomalies
   */
  private detectFrequencyAnomalies(profile: AgentBehaviorProfile, messageId: string): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];
    const baseline = profile.baselineMetrics;
    const current = profile.currentMetrics;

    if (baseline.averageMessageFrequency === 0) {
      return anomalies; // No baseline yet
    }

    const deviation = Math.abs(current.messageFrequency - baseline.averageMessageFrequency) / baseline.averageMessageFrequency;

    if (deviation > this.config.anomalyThreshold) {
      const anomaly: AnomalyEvent = {
        id: `freq-${profile.agentId}-${messageId}`,
        type: 'frequency',
        severity: deviation > 3 ? 'critical' : deviation > 2 ? 'high' : 'medium',
        description: `Unusual message frequency: ${current.messageFrequency} (baseline: ${baseline.averageMessageFrequency.toFixed(2)})`,
        detectedAt: new Date(),
        agentId: profile.agentId,
        metrics: {
          expected: baseline.averageMessageFrequency,
          actual: current.messageFrequency,
          deviation,
          confidence: Math.min(deviation / this.config.anomalyThreshold, 1),
        },
        context: {
          messageId,
        },
        resolved: false,
      };

      anomalies.push(anomaly);
    }

    return anomalies;
  }

  /**
   * Detect size anomalies
   */
  private detectSizeAnomalies(profile: AgentBehaviorProfile, messageId: string, messageSize: number): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];
    const baseline = profile.baselineMetrics;

    if (baseline.averageMessageSize === 0) {
      return anomalies; // No baseline yet
    }

    const deviation = Math.abs(messageSize - baseline.averageMessageSize) / baseline.averageMessageSize;

    if (deviation > this.config.anomalyThreshold) {
      const anomaly: AnomalyEvent = {
        id: `size-${profile.agentId}-${messageId}`,
        type: 'size',
        severity: messageSize > 10485760 ? 'critical' : deviation > 3 ? 'high' : 'medium', // > 10MB is critical
        description: `Unusual message size: ${messageSize} bytes (baseline: ${baseline.averageMessageSize.toFixed(2)} bytes)`,
        detectedAt: new Date(),
        agentId: profile.agentId,
        metrics: {
          expected: baseline.averageMessageSize,
          actual: messageSize,
          deviation,
          confidence: Math.min(deviation / this.config.anomalyThreshold, 1),
        },
        context: {
          messageId,
        },
        resolved: false,
      };

      anomalies.push(anomaly);
    }

    return anomalies;
  }

  /**
   * Detect recipient anomalies
   */
  private detectRecipientAnomalies(profile: AgentBehaviorProfile, messageId: string, recipientId: string): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];
    const baseline = profile.baselineMetrics;

    if (baseline.typicalRecipients.length === 0) {
      return anomalies; // No baseline yet
    }

    const isTypicalRecipient = baseline.typicalRecipients.includes(recipientId);

    if (!isTypicalRecipient) {
      const anomaly: AnomalyEvent = {
        id: `rec-${profile.agentId}-${messageId}`,
        type: 'recipients',
        severity: 'medium',
        description: `Communication with unusual recipient: ${recipientId}`,
        detectedAt: new Date(),
        agentId: profile.agentId,
        metrics: {
          expected: 0,
          actual: 1,
          deviation: 1,
          confidence: 0.8,
        },
        context: {
          messageId,
          recipientId,
        },
        resolved: false,
      };

      anomalies.push(anomaly);
    }

    return anomalies;
  }

  /**
   * Detect timing anomalies
   */
  private detectTimingAnomalies(profile: AgentBehaviorProfile, messageId: string, timestamp: Date): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];
    const hour = timestamp.getHours().toString();
    const baseline = profile.baselineMetrics.communicationPatterns;
    const current = profile.currentMetrics.communicationPatterns;

    const baselineCount = baseline.get(hour) || 0;
    const currentCount = current.get(hour) || 0;

    if (baselineCount > 0) {
      const deviation = Math.abs(currentCount - baselineCount) / baselineCount;

      if (deviation > this.config.anomalyThreshold) {
        const anomaly: AnomalyEvent = {
          id: `time-${profile.agentId}-${messageId}`,
          type: 'timing',
          severity: this.isAfterHours(timestamp) ? 'high' : 'medium',
          description: `Unusual timing pattern at ${hour}:00 (current: ${currentCount}, baseline: ${baselineCount})`,
          detectedAt: new Date(),
          agentId: profile.agentId,
          metrics: {
            expected: baselineCount,
            actual: currentCount,
            deviation,
            confidence: Math.min(deviation / this.config.anomalyThreshold, 1),
          },
          context: {
            messageId,
          },
          resolved: false,
        };

        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  /**
   * Detect behavioral anomalies using ML models
   */
  private detectBehaviorAnomalies(profile: AgentBehaviorProfile, messageId: string): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];

    try {
      // Use ML models to detect complex behavioral patterns
      const behaviorScore = this.mlModels.behaviorModel.analyze(profile);

      if (behaviorScore > this.config.anomalyThreshold) {
        const anomaly: AnomalyEvent = {
          id: `beh-${profile.agentId}-${messageId}`,
          type: 'behavior',
          severity: behaviorScore > 5 ? 'high' : 'medium',
          description: `Behavioral anomaly detected with score: ${behaviorScore.toFixed(2)}`,
          detectedAt: new Date(),
          agentId: profile.agentId,
          metrics: {
            expected: 0,
            actual: behaviorScore,
            deviation: behaviorScore,
            confidence: Math.min(behaviorScore / 5, 1),
          },
          context: {
            messageId,
          },
          resolved: false,
        };

        anomalies.push(anomaly);
      }
    } catch (error) {
      logger.error('Behavioral analysis failed', error instanceof Error ? error : undefined, {
        agentId: profile.agentId,
      });
    }

    return anomalies;
  }

  /**
   * Detect security-related anomalies
   */
  private detectSecurityAnomalies(
    profile: AgentBehaviorProfile,
    messageId: string,
    sourceIP: string,
    userAgent?: string
  ): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];

    // Check against threat intelligence
    if (this.threatIntelligence.maliciousIPs.has(sourceIP)) {
      const anomaly: AnomalyEvent = {
        id: `sec-ip-${profile.agentId}-${messageId}`,
        type: 'security',
        severity: 'critical',
        description: `Communication from malicious IP: ${sourceIP}`,
        detectedAt: new Date(),
        agentId: profile.agentId,
        metrics: {
          expected: 0,
          actual: 1,
          deviation: 1,
          confidence: 1,
        },
        context: {
          messageId,
          sourceIP,
          userAgent,
        },
        resolved: false,
      };

      anomalies.push(anomaly);
    }

    // Check for suspicious user agent
    if (userAgent && this.isSuspiciousUserAgent(userAgent)) {
      const anomaly: AnomalyEvent = {
        id: `sec-ua-${profile.agentId}-${messageId}`,
        type: 'security',
        severity: 'medium',
        description: `Suspicious user agent detected: ${userAgent}`,
        detectedAt: new Date(),
        agentId: profile.agentId,
        metrics: {
          expected: 0,
          actual: 1,
          deviation: 1,
          confidence: 0.7,
        },
        context: {
          messageId,
          sourceIP,
          userAgent,
        },
        resolved: false,
      };

      anomalies.push(anomaly);
    }

    return anomalies;
  }

  /**
   * Check if time is after business hours
   */
  private isAfterHours(timestamp: Date): boolean {
    const hour = timestamp.getHours();
    const day = timestamp.getDay();

    // Weekend or before 9 AM or after 5 PM
    return day === 0 || day === 6 || hour < 9 || hour > 17;
  }

  /**
   * Check if user agent is suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /scanner/i,
      /hack/i,
      /exploit/i,
      /curl/i,
      /wget/i,
      /python/i,
      /perl/i,
      /ruby/i,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Calculate risk score for agent
   */
  private calculateRiskScore(profile: AgentBehaviorProfile, recentAnomalies: AnomalyEvent[]): number {
    let score = 0;

    // Base score from recent anomalies
    recentAnomalies.forEach(anomaly => {
      switch (anomaly.severity) {
        case 'critical':
          score += 25;
          break;
        case 'high':
          score += 15;
          break;
        case 'medium':
          score += 10;
          break;
        case 'low':
          score += 5;
          break;
      }
    });

    // Factor in historical anomaly rate
    const historicalAnomalies = profile.anomalies.length;
    if (historicalAnomalies > 100) {
      score += 20;
    } else if (historicalAnomalies > 50) {
      score += 10;
    }

    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Update global metrics
   */
  private updateGlobalMetrics(): void {
    this.globalMetrics.totalAgents = this.agentProfiles.size;
    this.globalMetrics.totalAnomalies = this.anomalyEvents.size;

    let totalRiskScore = 0;
    let highRiskCount = 0;

    for (const profile of this.agentProfiles.values()) {
      totalRiskScore += profile.riskScore;
      if (profile.riskScore > this.config.riskScoreThreshold) {
        highRiskCount++;
      }
    }

    this.globalMetrics.averageRiskScore = this.agentProfiles.size > 0 ? totalRiskScore / this.agentProfiles.size : 0;
    this.globalMetrics.highRiskAgents = highRiskCount;
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Update threat intelligence
    setInterval(() => {
      this.updateThreatIntelligence();
    }, this.config.threatIntelUpdateInterval * 60 * 1000);

    // Update ML models
    setInterval(() => {
      this.updateMLModels();
    }, this.config.mlModelUpdateInterval * 60 * 60 * 1000);

    // Cleanup old data
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000); // Daily

    logger.info('Behavioral analysis periodic tasks started');
  }

  /**
   * Update machine learning models
   */
  private updateMLModels(): void {
    try {
      // Retrain models with new data
      const profiles = Array.from(this.agentProfiles.values());

      this.mlModels.frequencyModel.train(profiles);
      this.mlModels.sizeModel.train(profiles);
      this.mlModels.timingModel.train(profiles);
      this.mlModels.behaviorModel.train(profiles);

      logger.info('ML models updated', {
        profiles: profiles.length,
      });
    } catch (error) {
      logger.error('Failed to update ML models', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Clean old anomalies
    for (const [id, anomaly] of this.anomalyEvents) {
      if (anomaly.detectedAt < cutoffTime) {
        this.anomalyEvents.delete(id);
      }
    }

    // Clean agent profile anomalies
    for (const profile of this.agentProfiles.values()) {
      profile.anomalies = profile.anomalies.filter(a => a.detectedAt >= cutoffTime);
    }

    logger.info('Old data cleaned up', {
      remainingAnomalies: this.anomalyEvents.size,
    });
  }

  /**
   * Get agent risk assessment
   */
  public getAgentRiskAssessment(agentId: string): {
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    recentAnomalies: AnomalyEvent[];
    recommendations: string[];
  } {
    const profile = this.agentProfiles.get(agentId);
    if (!profile) {
      return {
        riskScore: 0,
        riskLevel: 'low',
        recentAnomalies: [],
        recommendations: [],
      };
    }

    const recentAnomalies = profile.anomalies
      .filter(a => !a.resolved)
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
      .slice(0, 10);

    const riskLevel = profile.riskScore > 75 ? 'critical' :
                     profile.riskScore > 50 ? 'high' :
                     profile.riskScore > 25 ? 'medium' : 'low';

    const recommendations = this.generateRecommendations(profile, recentAnomalies);

    return {
      riskScore: profile.riskScore,
      riskLevel,
      recentAnomalies,
      recommendations,
    };
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(profile: AgentBehaviorProfile, anomalies: AnomalyEvent[]): string[] {
    const recommendations: string[] = [];

    if (profile.riskScore > 75) {
      recommendations.push('Immediate investigation required');
      recommendations.push('Consider temporary suspension');
    }

    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    if (criticalAnomalies.length > 0) {
      recommendations.push('Block malicious communications');
      recommendations.push('Review security policies');
    }

    const frequencyAnomalies = anomalies.filter(a => a.type === 'frequency');
    if (frequencyAnomalies.length > 0) {
      recommendations.push('Implement rate limiting');
      recommendations.push('Monitor message patterns');
    }

    const securityAnomalies = anomalies.filter(a => a.type === 'security');
    if (securityAnomalies.length > 0) {
      recommendations.push('Update firewall rules');
      recommendations.push('Review access controls');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring');
    }

    return recommendations;
  }

  /**
   * Resolve anomaly
   */
  public resolveAnomaly(anomalyId: string, resolution: string): void {
    const anomaly = this.anomalyEvents.get(anomalyId);
    if (anomaly) {
      anomaly.resolved = true;
      anomaly.resolvedAt = new Date();
      anomaly.resolution = resolution;

      // Update agent profile
      const profile = this.agentProfiles.get(anomaly.agentId);
      if (profile) {
        const profileAnomaly = profile.anomalies.find(a => a.id === anomalyId);
        if (profileAnomaly) {
          profileAnomaly.resolved = true;
          profileAnomaly.resolvedAt = new Date();
          profileAnomaly.resolution = resolution;
        }

        // Recalculate risk score
        const unresolvedAnomalies = profile.anomalies.filter(a => !a.resolved);
        profile.riskScore = this.calculateRiskScore(profile, unresolvedAnomalies);
      }

      logger.info('Anomaly resolved', {
        anomalyId,
        resolution,
        agentId: anomaly.agentId,
      });
    }
  }

  /**
   * Get global metrics
   */
  public getGlobalMetrics(): any {
    return {
      ...this.globalMetrics,
      threatIntelLastUpdated: this.threatIntelligence.lastUpdated,
      maliciousIPs: this.threatIntelligence.maliciousIPs.size,
      suspiciousDomains: this.threatIntelligence.suspiciousDomains.size,
      knownAttackPatterns: this.threatIntelligence.knownAttackPatterns.size,
    };
  }
}

// ============================================================================
// Simple ML Models for Anomaly Detection
// ============================================================================

class FrequencyAnomalyModel {
  analyze(profile: AgentBehaviorProfile): number {
    const baseline = profile.baselineMetrics.averageMessageFrequency;
    const current = profile.currentMetrics.messageFrequency;

    if (baseline === 0) return 0;

    const ratio = current / baseline;
    return ratio > 5 ? 5 : ratio < 0.2 ? 5 : Math.abs(ratio - 1) * 2;
  }

  train(profiles: AgentBehaviorProfile[]): void {
    // Simple training - would use more sophisticated ML in production
  }
}

class SizeAnomalyModel {
  analyze(profile: AgentBehaviorProfile): number {
    const baseline = profile.baselineMetrics.averageMessageSize;
    const current = profile.currentMetrics.messageSize;

    if (baseline === 0) return 0;

    const ratio = current / baseline;
    return ratio > 10 ? 5 : ratio < 0.1 ? 5 : Math.abs(ratio - 1) * 2;
  }

  train(profiles: AgentBehaviorProfile[]): void {
    // Simple training - would use more sophisticated ML in production
  }
}

class TimingAnomalyModel {
  analyze(profile: AgentBehaviorProfile): number {
    // Analyze timing patterns
    let score = 0;
    const current = profile.currentMetrics.communicationPatterns;
    const baseline = profile.baselineMetrics.communicationPatterns;

    for (const [hour, count] of current) {
      const baselineCount = baseline.get(hour) || 0;
      if (baselineCount > 0) {
        const ratio = count / baselineCount;
        if (ratio > 3 || ratio < 0.3) {
          score += 1;
        }
      }
    }

    return Math.min(score, 5);
  }

  train(profiles: AgentBehaviorProfile[]): void {
    // Simple training - would use more sophisticated ML in production
  }
}

class BehaviorAnomalyModel {
  analyze(profile: AgentBehaviorProfile): number {
    // Complex behavioral analysis
    let score = 0;

    // Check for unusual recipient patterns
    const typicalRecipients = profile.baselineMetrics.typicalRecipients.length;
    const currentRecipients = profile.currentMetrics.recipients.size;

    if (typicalRecipients > 0 && currentRecipients > typicalRecipients * 2) {
      score += 2;
    }

    // Check for unusual message types
    const typicalTypes = profile.baselineMetrics.typicalMessageTypes.length;
    const currentTypes = profile.currentMetrics.messageTypes.size;

    if (typicalTypes > 0 && currentTypes > typicalTypes * 2) {
      score += 2;
    }

    // Check error rate
    if (profile.currentMetrics.errorRate > profile.baselineMetrics.errorRate * 2) {
      score += 1;
    }

    return Math.min(score, 5);
  }

  train(profiles: AgentBehaviorProfile[]): void {
    // Simple training - would use more sophisticated ML in production
  }
}

// ============================================================================
// Exports
// ============================================================================

export function getBehavioralAnalysis(config: BehavioralAnalysisConfig): BehavioralAnalysisEngine {
  return BehavioralAnalysisEngine.getInstance(config);
}

export default {
  BehavioralAnalysisEngine,
  getBehavioralAnalysis,
};
