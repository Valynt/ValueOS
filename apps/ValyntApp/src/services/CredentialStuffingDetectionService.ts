/**
 * Credential Stuffing Detection Service
 *
 * Specialized service for detecting credential stuffing attacks:
 * - High failure rate analysis across multiple accounts
 * - Pattern recognition for automated login attempts
 * - IP and user agent correlation analysis
 * - Real-time detection and response
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TenantAwareService } from './TenantAwareService';
import { log } from '../lib/logger';
import { SecurityEvent } from './AdvancedThreatDetectionService';
import { RateLimitEscalationService } from './RateLimitEscalationService';

export interface CredentialStuffingPattern {
  id: string;
  type: 'high_failure_rate' | 'rapid_account_switching' | 'automated_patterns' | 'ip_correlation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  riskScore: number;
  description: string;
  indicators: string[];
  timeWindow: number; // minutes
  affectedAccounts: string[];
  sourceIPs: string[];
  userAgents: string[];
  metadata: Record<string, any>;
}

export interface LoginAttempt {
  id: string;
  timestamp: Date;
  userId?: string;
  email?: string;
  username?: string;
  ip: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
  endpoint: string;
  tenantId: string;
  sessionId?: string;
  metadata: Record<string, any>;
}

export interface CredentialStuffingAlert {
  id: string;
  patternId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  detectedAt: Date;
  tenantId: string;
  affectedAccounts: string[];
  sourceIPs: string[];
  recommendedActions: string[];
  isActive: boolean;
  resolvedAt?: Date;
  responseActions: string[];
}

export interface CredentialStuffingMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  uniqueAccounts: number;
  uniqueIPs: number;
  failureRate: number;
  averageAttemptsPerAccount: number;
  topSourceIPs: Array<{
    ip: string;
    attempts: number;
    failureRate: number;
  }>;
  suspiciousPatterns: CredentialStuffingPattern[];
  activeAlerts: number;
}

export class CredentialStuffingDetectionService extends TenantAwareService {
  private readonly HIGH_FAILURE_RATE_THRESHOLD = 0.9; // 90% failure rate
  private readonly MIN_ACCOUNTS_FOR_PATTERN = 10; // Minimum accounts to consider
  private readonly RAPID_SWITCHING_THRESHOLD = 5; // Accounts per minute
  private readonly AUTOMATED_PATTERN_THRESHOLD = 20; // Attempts per minute per IP
  private readonly IP_CORRELATION_THRESHOLD = 3; // IPs with similar patterns

  private activeAlerts = new Map<string, CredentialStuffingAlert>();
  private recentAttempts = new Map<string, LoginAttempt[]>(); // Key: tenantId
  private blockedIPs = new Set<string>();
  private suspiciousUserAgents = new Set<string>();

  constructor(
    supabase: SupabaseClient,
    private escalationService: RateLimitEscalationService
  ) {
    super('CredentialStuffingDetectionService');
    this.supabase = supabase;

    // Initialize cleanup and monitoring
    this.initializeMonitoring();
  }

  /**
   * Process login attempt for credential stuffing detection
   */
  async processLoginAttempt(attempt: LoginAttempt): Promise<{
    isSuspicious: boolean;
    patterns: CredentialStuffingPattern[];
    alerts: CredentialStuffingAlert[];
    recommendedActions: string[];
  }> {
    const startTime = Date.now();

    try {
      // Store attempt for analysis
      await this.storeLoginAttempt(attempt);

      // Analyze for credential stuffing patterns
      const patterns = await this.analyzeCredentialStuffingPatterns(attempt.tenantId);

      // Generate alerts if suspicious patterns found
      const alerts = await this.generateAlerts(patterns, attempt);

      // Calculate recommended actions
      const recommendedActions = this.generateRecommendedActions(patterns, alerts);

      // Update metrics
      await this.updateMetrics(attempt.tenantId);

      const isSuspicious = patterns.length > 0 || alerts.length > 0;

      log.debug('Login attempt processed', {
        tenantId: attempt.tenantId,
        isSuspicious,
        patternsFound: patterns.length,
        alertsGenerated: alerts.length,
        duration: Date.now() - startTime
      });

      return {
        isSuspicious,
        patterns,
        alerts,
        recommendedActions
      };

    } catch (error) {
      log.error('Failed to process login attempt', error as Error, {
        tenantId: attempt.tenantId,
        ip: attempt.ip
      });

      // Return safe defaults on error
      return {
        isSuspicious: false,
        patterns: [],
        alerts: [],
        recommendedActions: ['Monitor for continued issues']
      };
    }
  }

  /**
   * Analyze credential stuffing patterns
   */
  private async analyzeCredentialStuffingPatterns(tenantId: string): Promise<CredentialStuffingPattern[]> {
    const patterns: CredentialStuffingPattern[] = [];
    const recentAttempts = this.getRecentAttempts(tenantId, 60); // Last hour

    if (recentAttempts.length < 20) {
      return patterns; // Not enough data for analysis
    }

    // Pattern 1: High failure rate across multiple accounts
    const highFailurePattern = this.detectHighFailureRatePattern(recentAttempts);
    if (highFailurePattern) {
      patterns.push(highFailurePattern);
    }

    // Pattern 2: Rapid account switching
    const rapidSwitchingPattern = this.detectRapidAccountSwitching(recentAttempts);
    if (rapidSwitchingPattern) {
      patterns.push(rapidSwitchingPattern);
    }

    // Pattern 3: Automated patterns
    const automatedPattern = this.detectAutomatedPatterns(recentAttempts);
    if (automatedPattern) {
      patterns.push(automatedPattern);
    }

    // Pattern 4: IP correlation
    const ipCorrelationPattern = this.detectIPCorrelation(recentAttempts);
    if (ipCorrelationPattern) {
      patterns.push(ipCorrelationPattern);
    }

    return patterns.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Detect high failure rate pattern
   */
  private detectHighFailureRatePattern(attempts: LoginAttempt[]): CredentialStuffingPattern | null {
    // Group by IP
    const ipGroups = attempts.reduce((groups, attempt) => {
      if (!groups[attempt.ip]) groups[attempt.ip] = [];
      groups[attempt.ip]!.push(attempt);
      return groups;
    }, {} as Record<string, LoginAttempt[]>);

    for (const [ip, ipAttempts] of Object.entries(ipGroups)) {
      // Need attempts against multiple accounts
      const uniqueAccounts = new Set(
        ipAttempts.map(a => a.email || a.username || a.userId).filter(Boolean)
      );

      if (uniqueAccounts.size < this.MIN_ACCOUNTS_FOR_PATTERN) {
        continue;
      }

      // Calculate failure rate
      const failedAttempts = ipAttempts.filter(a => !a.success);
      const failureRate = failedAttempts.length / ipAttempts.length;

      if (failureRate >= this.HIGH_FAILURE_RATE_THRESHOLD) {
        return {
          id: `high_failure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'high_failure_rate',
          severity: failureRate >= 0.95 ? 'critical' : 'high',
          confidence: Math.min(failureRate / this.HIGH_FAILURE_RATE_THRESHOLD, 1),
          riskScore: failureRate * 100,
          description: `High failure rate detected: ${Math.round(failureRate * 100)}% failure across ${uniqueAccounts.size} accounts from IP ${ip}`,
          indicators: [
            `Failure rate: ${Math.round(failureRate * 100)}%`,
            `Unique accounts: ${uniqueAccounts.size}`,
            `Total attempts: ${ipAttempts.length}`,
            `Source IP: ${ip}`
          ],
          timeWindow: 60,
          affectedAccounts: Array.from(uniqueAccounts).filter(Boolean) as string[],
          sourceIPs: [ip],
          userAgents: [...new Set(ipAttempts.map(a => a.userAgent))],
          metadata: {
            failureRate,
            totalAttempts: ipAttempts.length,
            uniqueAccountsCount: uniqueAccounts.size,
            timeSpan: this.calculateTimeSpan(ipAttempts)
          }
        };
      }
    }

    return null;
  }

  /**
   * Detect rapid account switching pattern
   */
  private detectRapidAccountSwitching(attempts: LoginAttempt[]): CredentialStuffingPattern | null {
    // Group by IP and analyze timing
    const ipGroups = attempts.reduce((groups, attempt) => {
      if (!groups[attempt.ip]) groups[attempt.ip] = [];
      groups[attempt.ip]!.push(attempt);
      return groups;
    }, {} as Record<string, LoginAttempt[]>);

    for (const [ip, ipAttempts] of Object.entries(ipGroups)) {
      // Sort by timestamp
      const sortedAttempts = ipAttempts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Look for rapid switching between accounts
      let rapidSwitchingCount = 0;
      const accountSwitches: Array<{ timestamp: Date; account: string }> = [];

      for (let i = 1; i < sortedAttempts.length; i++) {
        const prev = sortedAttempts[i - 1];
        const curr = sortedAttempts[i];

        const prevAccount = prev.email || prev.username || prev.userId || '';
        const currAccount = curr.email || curr.username || curr.userId || '';

        const timeDiff = curr.timestamp.getTime() - prev.timestamp.getTime();
        const accountChanged = prevAccount !== currAccount && prevAccount && currAccount;

        // Account switching within 30 seconds
        if (accountChanged && timeDiff < 30000) {
          rapidSwitchingCount++;
          accountSwitches.push({
            timestamp: curr.timestamp,
            account: currAccount
          });
        }
      }

      if (rapidSwitchingCount >= this.RAPID_SWITCHING_THRESHOLD) {
        const uniqueAccounts = new Set(
          ipAttempts.map(a => a.email || a.username || a.userId).filter(Boolean)
        );

        return {
          id: `rapid_switching_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'rapid_account_switching',
          severity: 'high',
          confidence: Math.min(rapidSwitchingCount / this.RAPID_SWITCHING_THRESHOLD, 1),
          riskScore: Math.min((rapidSwitchingCount / this.RAPID_SWITCHING_THRESHOLD) * 80, 100),
          description: `Rapid account switching detected: ${rapidSwitchingCount} switches between ${uniqueAccounts.size} accounts from IP ${ip}`,
          indicators: [
            `Account switches: ${rapidSwitchingCount}`,
            `Unique accounts: ${uniqueAccounts.size}`,
            `Average switch interval: ${Math.round(this.calculateAverageSwitchInterval(accountSwitches) / 1000)}s`,
            `Source IP: ${ip}`
          ],
          timeWindow: 60,
          affectedAccounts: Array.from(uniqueAccounts).filter(Boolean) as string[],
          sourceIPs: [ip],
          userAgents: [...new Set(ipAttempts.map(a => a.userAgent))],
          metadata: {
            rapidSwitchingCount,
            averageSwitchInterval: this.calculateAverageSwitchInterval(accountSwitches),
            uniqueAccountsCount: uniqueAccounts.size,
            accountSwitches
          }
        };
      }
    }

    return null;
  }

  /**
   * Detect automated patterns
   */
  private detectAutomatedPatterns(attempts: LoginAttempt[]): CredentialStuffingPattern | null {
    // Group by IP and check for automated behavior
    const ipGroups = attempts.reduce((groups, attempt) => {
      if (!groups[attempt.ip]) groups[attempt.ip] = [];
      groups[attempt.ip]!.push(attempt);
      return groups;
    }, {} as Record<string, LoginAttempt[]>);

    for (const [ip, ipAttempts] of Object.entries(ipGroups)) {
      // Check attempt frequency
      const attemptsPerMinute = this.calculateAttemptsPerMinute(ipAttempts);

      if (attemptsPerMinute >= this.AUTOMATED_PATTERN_THRESHOLD) {
        // Check for automated user agents
        const automatedUserAgents = ipAttempts
          .map(a => a.userAgent)
          .filter(ua => this.isAutomatedUserAgent(ua));

        const hasAutomatedUA = automatedUserAgents.length > 0;
        const uaConsistency = this.calculateUserAgentConsistency(ipAttempts);

        // Additional automated indicators
        const consistentTiming = this.hasConsistentTiming(ipAttempts);
        const sequentialPattern = this.hasSequentialPattern(ipAttempts);

        const automationScore = (
          (attemptsPerMinute / this.AUTOMATED_PATTERN_THRESHOLD) * 0.3 +
          (hasAutomatedUA ? 0.3 : 0) +
          (uaConsistency * 0.2) +
          (consistentTiming ? 0.1 : 0) +
          (sequentialPattern ? 0.1 : 0)
        );

        if (automationScore >= 0.7) {
          const uniqueAccounts = new Set(
            ipAttempts.map(a => a.email || a.username || a.userId).filter(Boolean)
          );

          return {
            id: `automated_pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'automated_patterns',
            severity: automationScore >= 0.9 ? 'critical' : 'high',
            confidence: automationScore,
            riskScore: automationScore * 100,
            description: `Automated credential stuffing detected: ${Math.round(attemptsPerMinute)} attempts/minute from IP ${ip}`,
            indicators: [
              `Attempts per minute: ${Math.round(attemptsPerMinute)}`,
              `Automation score: ${Math.round(automationScore * 100)}%`,
              `Automated user agent: ${hasAutomatedUA ? 'Yes' : 'No'}`,
              `Consistent timing: ${consistentTiming ? 'Yes' : 'No'}`,
              `Sequential pattern: ${sequentialPattern ? 'Yes' : 'No'}`
            ],
            timeWindow: 60,
            affectedAccounts: Array.from(uniqueAccounts).filter(Boolean) as string[],
            sourceIPs: [ip],
            userAgents: [...new Set(ipAttempts.map(a => a.userAgent))],
            metadata: {
              attemptsPerMinute,
              automationScore,
              hasAutomatedUA,
              uaConsistency,
              consistentTiming,
              sequentialPattern,
              automatedUserAgents
            }
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect IP correlation patterns
   */
  private detectIPCorrelation(attempts: LoginAttempt[]): CredentialStuffingPattern | null {
    // Group by user agent and timing patterns
    const uaGroups = attempts.reduce((groups, attempt) => {
      const ua = attempt.userAgent;
      if (!groups[ua]) groups[ua] = [];
      groups[ua]!.push(attempt);
      return groups;
    }, {} as Record<string, LoginAttempt[]>);

    for (const [userAgent, uaAttempts] of Object.entries(uaGroups)) {
      // Group by IP within this user agent
      const ipGroups = uaAttempts.reduce((groups, attempt) => {
        if (!groups[attempt.ip]) groups[attempt.ip] = [];
        groups[attempt.ip]!.push(attempt);
        return groups;
      }, {} as Record<string, LoginAttempt[]>);

      // Look for correlated IPs with similar patterns
      const correlatedIPs: string[] = [];

      for (const [ip1, attempts1] of Object.entries(ipGroups)) {
        for (const [ip2, attempts2] of Object.entries(ipGroups)) {
          if (ip1 >= ip2) continue; // Avoid duplicate comparisons

          const correlation = this.calculateIPCorrelation(attempts1, attempts2);

          if (correlation >= 0.8) {
            correlatedIPs.push(ip1, ip2);
          }
        }
      }

      if (correlatedIPs.length >= this.IP_CORRELATION_THRESHOLD) {
        const uniqueIPs = new Set(correlatedIPs);
        const uniqueAccounts = new Set(
          uaAttempts.map(a => a.email || a.username || a.userId).filter(Boolean)
        );

        return {
          id: `ip_correlation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'ip_correlation',
          severity: 'high',
          confidence: 0.8,
          riskScore: 75,
          description: `Coordinated credential stuffing detected: ${uniqueIPs.size} correlated IPs using same user agent`,
          indicators: [
            `Correlated IPs: ${uniqueIPs.size}`,
            `Common user agent: ${userAgent.substring(0, 50)}...`,
            `Total attempts: ${uaAttempts.length}`,
            `Unique accounts: ${uniqueAccounts.size}`
          ],
          timeWindow: 60,
          affectedAccounts: Array.from(uniqueAccounts).filter(Boolean) as string[],
          sourceIPs: Array.from(uniqueIPs),
          userAgents: [userAgent],
          metadata: {
            correlatedIPs: Array.from(uniqueIPs),
            userAgent,
            totalAttempts: uaAttempts.length,
            uniqueAccountsCount: uniqueAccounts.size
          }
        };
      }
    }

    return null;
  }

  /**
   * Generate alerts for detected patterns
   */
  private async generateAlerts(
    patterns: CredentialStuffingPattern[],
    attempt: LoginAttempt
  ): Promise<CredentialStuffingAlert[]> {
    const alerts: CredentialStuffingAlert[] = [];

    for (const pattern of patterns) {
      // Check if similar alert already exists
      const existingAlert = this.findSimilarAlert(pattern);

      if (!existingAlert) {
        const alert: CredentialStuffingAlert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          patternId: pattern.id,
          severity: pattern.severity,
          message: pattern.description,
          detectedAt: new Date(),
          tenantId: attempt.tenantId,
          affectedAccounts: pattern.affectedAccounts,
          sourceIPs: pattern.sourceIPs,
          recommendedActions: this.generatePatternSpecificActions(pattern),
          isActive: true,
          responseActions: []
        };

        alerts.push(alert);
        this.activeAlerts.set(alert.id, alert);

        // Trigger escalation for high-severity patterns
        if (pattern.severity === 'high' || pattern.severity === 'critical') {
          await this.triggerEscalation(pattern, attempt);
        }

        // Log alert
        log.warn('Credential stuffing alert generated', {
          alertId: alert.id,
          patternType: pattern.type,
          severity: pattern.severity,
          tenantId: attempt.tenantId,
          affectedAccounts: pattern.affectedAccounts.length,
          sourceIPs: pattern.sourceIPs.length
        });
      }
    }

    return alerts;
  }

  /**
   * Generate recommended actions
   */
  private generateRecommendedActions(
    patterns: CredentialStuffingPattern[],
    alerts: CredentialStuffingAlert[]
  ): string[] {
    const actions: string[] = [];

    if (patterns.length === 0 && alerts.length === 0) {
      return actions;
    }

    // Base recommendations
    actions.push('Monitor for continued suspicious activity');
    actions.push('Review affected accounts for compromise');

    // Pattern-specific recommendations
    for (const pattern of patterns) {
      switch (pattern.type) {
        case 'high_failure_rate':
          actions.push('Consider temporary IP blocks for high-failure sources');
          actions.push('Implement additional authentication challenges');
          break;

        case 'rapid_account_switching':
          actions.push('Implement rate limiting for account switching');
          actions.push('Add CAPTCHA for suspicious login attempts');
          break;

        case 'automated_patterns':
          actions.push('Block automated user agents');
          actions.push('Implement bot detection measures');
          break;

        case 'ip_correlation':
          actions.push('Investigate coordinated attack sources');
          actions.push('Consider geographic blocking if applicable');
          break;
      }
    }

    // Severity-based recommendations
    const hasHighSeverity = patterns.some(p => p.severity === 'high' || p.severity === 'critical');
    if (hasHighSeverity) {
      actions.push('Immediate security team notification required');
      actions.push('Consider temporary account lockdowns');
    }

    return [...new Set(actions)]; // Remove duplicates
  }

  // Helper methods
  private async storeLoginAttempt(attempt: LoginAttempt): Promise<void> {
    const tenantAttempts = this.recentAttempts.get(attempt.tenantId) || [];
    tenantAttempts.push(attempt);

    // Keep only recent attempts (last 2 hours)
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const filtered = tenantAttempts.filter(a => a.timestamp.getTime() > cutoff);

    this.recentAttempts.set(attempt.tenantId, filtered);
  }

  private getRecentAttempts(tenantId: string, minutes: number): LoginAttempt[] {
    const attempts = this.recentAttempts.get(tenantId) || [];
    const cutoff = Date.now() - minutes * 60 * 1000;

    return attempts.filter(a => a.timestamp.getTime() > cutoff);
  }

  private calculateTimeSpan(attempts: LoginAttempt[]): number {
    if (attempts.length < 2) return 0;

    const times = attempts.map(a => a.timestamp.getTime());
    return Math.max(...times) - Math.min(...times);
  }

  private calculateAverageSwitchInterval(switches: Array<{ timestamp: Date; account: string }>): number {
    if (switches.length < 2) return 0;

    let totalInterval = 0;
    for (let i = 1; i < switches.length; i++) {
      totalInterval += switches[i]!.timestamp.getTime() - switches[i - 1]!.timestamp.getTime();
    }

    return totalInterval / (switches.length - 1);
  }

  private calculateAttemptsPerMinute(attempts: LoginAttempt[]): number {
    if (attempts.length < 2) return attempts.length;

    const timeSpan = this.calculateTimeSpan(attempts);
    const minutes = timeSpan / (60 * 1000);

    return minutes > 0 ? attempts.length / minutes : attempts.length;
  }

  private isAutomatedUserAgent(userAgent: string): boolean {
    const automatedPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /curl/i, /wget/i, /python/i, /java/i, /go-http/i,
      /postman/i, /insomnia/i, /httpie/i
    ];

    return automatedPatterns.some(pattern => pattern.test(userAgent));
  }

  private calculateUserAgentConsistency(attempts: LoginAttempt[]): number {
    const userAgents = attempts.map(a => a.userAgent);
    const uniqueUserAgents = new Set(userAgents);

    return 1 - (uniqueUserAgents.size - 1) / userAgents.length;
  }

  private hasConsistentTiming(attempts: LoginAttempt[]): boolean {
    if (attempts.length < 3) return false;

    const intervals = [];
    for (let i = 1; i < attempts.length; i++) {
      intervals.push(attempts[i].timestamp.getTime() - attempts[i - 1].timestamp.getTime());
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) =>
      sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

    const coefficientOfVariation = Math.sqrt(variance) / avgInterval;

    return coefficientOfVariation < 0.2; // Low variation = consistent timing
  }

  private hasSequentialPattern(attempts: LoginAttempt[]): boolean {
    // Check for sequential usernames or emails
    const identifiers = attempts
      .map(a => a.email || a.username)
      .filter(Boolean) as string[];

    if (identifiers.length < 3) return false;

    // Look for patterns like user1, user2, user3
    const sequentialPattern = /^(.*?)(\d+)$/;

    for (let i = 0; i < identifiers.length - 2; i++) {
      const match1 = identifiers[i].match(sequentialPattern);
      const match2 = identifiers[i + 1].match(sequentialPattern);
      const match3 = identifiers[i + 2].match(sequentialPattern);

      if (match1 && match2 && match3) {
        const prefix1 = match1[1];
        const prefix2 = match2[1];
        const prefix3 = match3[1];

        const num1 = parseInt(match1[2]);
        const num2 = parseInt(match2[2]);
        const num3 = parseInt(match3[2]);

        if (prefix1 === prefix2 && prefix2 === prefix3 &&
            num2 === num1 + 1 && num3 === num2 + 1) {
          return true;
        }
      }
    }

    return false;
  }

  private calculateIPCorrelation(attempts1: LoginAttempt[], attempts2: LoginAttempt[]): number {
    // Calculate correlation based on timing patterns, user agents, and targets
    let correlation = 0;

    // User agent correlation
    const ua1 = attempts1[0]?.userAgent || '';
    const ua2 = attempts2[0]?.userAgent || '';

    if (ua1 === ua2) {
      correlation += 0.4;
    } else if (this.calculateStringSimilarity(ua1, ua2) > 0.8) {
      correlation += 0.2;
    }

    // Timing correlation
    const timing1 = this.getTimingPattern(attempts1);
    const timing2 = this.getTimingPattern(attempts2);

    if (Math.abs(timing1 - timing2) < 0.1) {
      correlation += 0.3;
    }

    // Target correlation (similar accounts being targeted)
    const targets1 = new Set(attempts1.map(a => a.email || a.username).filter(Boolean));
    const targets2 = new Set(attempts2.map(a => a.email || a.username).filter(Boolean));

    const intersection = new Set([...targets1].filter(x => targets2.has(x)));
    const union = new Set([...targets1, ...targets2]);

    if (union.size > 0) {
      correlation += intersection.size / union.size * 0.3;
    }

    return Math.min(correlation, 1);
  }

  private getTimingPattern(attempts: LoginAttempt[]): number {
    if (attempts.length < 2) return 0;

    const intervals = [];
    for (let i = 1; i < attempts.length; i++) {
      intervals.push(attempts[i].timestamp.getTime() - attempts[i - 1].timestamp.getTime());
    }

    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private findSimilarAlert(pattern: CredentialStuffingPattern): CredentialStuffingAlert | null {
    for (const alert of this.activeAlerts.values()) {
      if (!alert.isActive) continue;

      // Check for similar patterns
      if (alert.patternId === pattern.id ||
          (alert.sourceIPs.some(ip => pattern.sourceIPs.includes(ip)) &&
           alert.severity === pattern.severity)) {
        return alert;
      }
    }

    return null;
  }

  private generatePatternSpecificActions(pattern: CredentialStuffingPattern): string[] {
    const actions: string[] = [];

    switch (pattern.type) {
      case 'high_failure_rate':
        actions.push('Block source IP temporarily');
        actions.push('Increase authentication requirements');
        break;

      case 'rapid_account_switching':
        actions.push('Implement account switching rate limits');
        actions.push('Add behavioral challenges');
        break;

      case 'automated_patterns':
        actions.push('Block automated user agents');
        actions.push('Implement bot detection');
        break;

      case 'ip_correlation':
        actions.push('Investigate coordinated attack');
        actions.push('Consider geographic blocking');
        break;
    }

    return actions;
  }

  private async triggerEscalation(pattern: CredentialStuffingPattern, attempt: LoginAttempt): Promise<void> {
    try {
      const context = {
        tenantId: attempt.tenantId,
        userId: attempt.userId,
        ip: attempt.ip,
        endpoint: attempt.endpoint,
        riskScore: pattern.riskScore / 100,
        threatTypes: ['credential_stuffing'],
        timeWindow: pattern.timeWindow,
        additionalData: {
          patternType: pattern.type,
          patternId: pattern.id,
          affectedAccounts: pattern.affectedAccounts.length,
          sourceIPs: pattern.sourceIPs
        }
      };

      await this.escalationService.escalate(attempt.ip, pattern.riskScore / 100, context);

      log.info('Escalation triggered for credential stuffing', {
        patternType: pattern.type,
        riskScore: pattern.riskScore,
        tenantId: attempt.tenantId
      });

    } catch (error) {
      log.error('Failed to trigger escalation', error as Error);
    }
  }

  private async updateMetrics(tenantId: string): Promise<void> {
    // This would update analytics dashboard
    // Implementation depends on specific metrics system
  }

  private initializeMonitoring(): void {
    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);

    log.info('Credential stuffing detection service initialized');
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old attempts
    for (const [tenantId, attempts] of this.recentAttempts.entries()) {
      const filtered = attempts.filter(a => a.timestamp.getTime() > cutoff);
      if (filtered.length === 0) {
        this.recentAttempts.delete(tenantId);
      } else {
        this.recentAttempts.set(tenantId, filtered);
      }
    }

    // Clean up old alerts
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.detectedAt.getTime() < cutoff) {
        alert.isActive = false;
        alert.resolvedAt = new Date();
      }
    }
  }

  // Public API methods
  public getMetrics(tenantId: string): CredentialStuffingMetrics {
    const attempts = this.getRecentAttempts(tenantId, 60);
    const successfulAttempts = attempts.filter(a => a.success);
    const failedAttempts = attempts.filter(a => !a.success);
    const uniqueAccounts = new Set(
      attempts.map(a => a.email || a.username || a.userId).filter(Boolean)
    );
    const uniqueIPs = new Set(attempts.map(a => a.ip));

    // Top source IPs
    const ipCounts = attempts.reduce((counts, attempt) => {
      if (!counts[attempt.ip]) {
        counts[attempt.ip] = { attempts: 0, failures: 0 };
      }
      counts[attempt.ip].attempts++;
      if (!attempt.success) counts[attempt.ip].failures++;
      return counts;
    }, {} as Record<string, { attempts: number; failures: number }>);

    const topSourceIPs = Object.entries(ipCounts)
      .map(([ip, data]) => ({
        ip,
        attempts: data.attempts,
        failureRate: data.failures / data.attempts
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 10);

    return {
      totalAttempts: attempts.length,
      successfulAttempts: successfulAttempts.length,
      failedAttempts: failedAttempts.length,
      uniqueAccounts: uniqueAccounts.size,
      uniqueIPs: uniqueIPs.size,
      failureRate: attempts.length > 0 ? failedAttempts.length / attempts.length : 0,
      averageAttemptsPerAccount: uniqueAccounts.size > 0 ? attempts.length / uniqueAccounts.size : 0,
      topSourceIPs,
      suspiciousPatterns: [], // Would be populated by current analysis
      activeAlerts: Array.from(this.activeAlerts.values()).filter(a => a.isActive).length
    };
  }

  public getActiveAlerts(tenantId?: string): CredentialStuffingAlert[] {
    const alerts = Array.from(this.activeAlerts.values()).filter(a => a.isActive);

    if (tenantId) {
      return alerts.filter(a => a.tenantId === tenantId);
    }

    return alerts;
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.isActive = false;
      alert.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  public blockIP(ip: string): void {
    this.blockedIPs.add(ip);
    log.info('IP blocked for credential stuffing protection', { ip });
  }

  public unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    log.info('IP unblocked', { ip });
  }

  public isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }
}
