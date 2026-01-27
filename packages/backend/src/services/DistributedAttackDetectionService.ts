/**
 * Distributed Attack Detection Service
 *
 * Detects coordinated attacks across multiple IPs and sources:
 * - DDoS attacks from botnets
 * - Credential stuffing campaigns
 * - API abuse patterns
 * - Distributed brute force attempts
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TenantAwareService } from './TenantAwareService.js'
import { log } from '../lib/logger.js'
import { SecurityEvent } from './AdvancedThreatDetectionService.js'

export interface AttackPattern {
  type: 'ddos' | 'credential_stuffing' | 'api_abuse' | 'brute_force';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  riskScore: number;
  affectedIPs: string[];
  affectedUsers: string[];
  timeWindow: number;
  description: string;
  indicators: string[];
}

export interface RequestCluster {
  id: string;
  ips: string[];
  userAgents: string[];
  endpoints: string[];
  patterns: {
    timingSimilarity: number;
    endpointSimilarity: number;
    userAgentSimilarity: number;
    payloadSimilarity: number;
  };
  requestCount: number;
  timeSpan: number;
  riskScore: number;
}

export interface IPAnalysis {
  ip: string;
  reputation: {
    score: number;
    source: string;
    lastUpdated: Date;
  };
  geolocation: {
    country: string;
    region: string;
    isProxy: boolean;
    isVPN: boolean;
    isTor: boolean;
    isDatacenter: boolean;
  };
  behavior: {
    requestCount: number;
    uniqueEndpoints: number;
    errorRate: number;
    avgRequestInterval: number;
    burstScore: number;
  };
  correlations: {
    similarIPs: string[];
    coordinatedPatterns: string[];
  };
}

export class DistributedAttackDetectionService extends TenantAwareService {
  private readonly CLUSTERING_THRESHOLD = 0.7;
  private readonly DDoS_THRESHOLD = 1000; // requests per minute
  private readonly CREDENTIAL_STUFFING_THRESHOLD = 50; // failed logins per minute
  private readonly API_ABUSE_THRESHOLD = 500; // API calls per minute

  // Cache for IP analysis results
  private ipAnalysisCache = new Map<string, IPAnalysis>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor(supabase: SupabaseClient) {
    super('DistributedAttackDetectionService');
    this.supabase = supabase;
  }

  /**
   * Analyze recent requests for distributed attack patterns
   */
  async analyzeDistributedPatterns(tenantId: string, timeWindowMinutes: number = 5): Promise<{
    attacks: AttackPattern[];
    clusters: RequestCluster[];
    highRiskIPs: IPAnalysis[];
    recommendations: string[];
  }> {
    log.info('Starting distributed attack analysis', { tenantId, timeWindowMinutes });

    try {
      // Get recent requests across all users
      const recentRequests = await this.getRecentRequests(tenantId, timeWindowMinutes);

      // Analyze request clusters
      const clusters = await this.identifyRequestClusters(recentRequests);

      // Analyze high-risk IPs
      const highRiskIPs = await this.analyzeHighRiskIPs(recentRequests);

      // Detect attack patterns
      const attacks = await this.detectAttackPatterns(clusters, highRiskIPs, recentRequests);

      // Generate recommendations
      const recommendations = this.generateAttackRecommendations(attacks, clusters, highRiskIPs);

      log.info('Distributed attack analysis completed', {
        tenantId,
        attacksDetected: attacks.length,
        clustersFound: clusters.length,
        highRiskIPs: highRiskIPs.length
      });

      return {
        attacks,
        clusters,
        highRiskIPs,
        recommendations
      };
    } catch (error) {
      log.error('Distributed attack analysis failed', error as Error);
      throw error;
    }
  }

  /**
   * Process security event for distributed attack detection
   */
  async processSecurityEvent(event: SecurityEvent): Promise<{
    isDistributedAttack: boolean;
    attackPatterns: AttackPattern[];
    recommendedActions: string[];
  }> {
    // Check if this event is part of a distributed pattern
    const relatedEvents = await this.getRelatedEvents(event, 5); // 5 minute window

    if (relatedEvents.length < 10) {
      // Not enough events for distributed analysis
      return {
        isDistributedAttack: false,
        attackPatterns: [],
        recommendedActions: []
      };
    }

    // Analyze for distributed patterns
    const attacks = await this.detectAttackPatterns([], [], relatedEvents);
    const isDistributedAttack = attacks.length > 0;
    const recommendedActions = this.generateEventSpecificRecommendations(attacks, event);

    return {
      isDistributedAttack,
      attackPatterns: attacks,
      recommendedActions
    };
  }

  /**
   * Identify clusters of correlated requests
   */
  private async identifyRequestClusters(requests: any[]): Promise<RequestCluster[]> {
    const clusters: RequestCluster[] = [];
    const processedRequests = new Set<string>();

    for (const request of requests) {
      if (processedRequests.has(request.id)) continue;

      // Find similar requests
      const similarRequests = requests.filter((r: any) =>
        !processedRequests.has(r.id) && this.areRequestsSimilar(request, r)
      );

      if (similarRequests.length >= 5) { // Minimum cluster size
        const cluster = await this.createRequestCluster(similarRequests);
        clusters.push(cluster);

        // Mark all requests in cluster as processed
        similarRequests.forEach(r => processedRequests.add(r.id));
      }
    }

    return clusters;
  }

  /**
   * Check if two requests are similar enough to be in the same cluster
   */
  private areRequestsSimilar(req1: any, req2: any): boolean {
    const similarities = {
      timing: this.calculateTimingSimilarity(req1, req2),
      endpoint: this.calculateEndpointSimilarity(req1, req2),
      userAgent: this.calculateUserAgentSimilarity(req1, req2),
      payload: this.calculatePayloadSimilarity(req1, req2)
    };

    // Calculate overall similarity
    const overallSimilarity = Object.values(similarities).reduce((sum, sim) => sum + sim, 0) / 4;

    return overallSimilarity >= this.CLUSTERING_THRESHOLD;
  }

  /**
   * Calculate timing similarity between two requests
   */
  private calculateTimingSimilarity(req1: any, req2: any): number {
    const timeDiff = Math.abs(new Date(req1.timestamp).getTime() - new Date(req2.timestamp).getTime());
    const maxTimeDiff = 5 * 60 * 1000; // 5 minutes
    return Math.max(0, 1 - timeDiff / maxTimeDiff);
  }

  /**
   * Calculate endpoint similarity between two requests
   */
  private calculateEndpointSimilarity(req1: any, req2: any): number {
    const endpoint1 = req1.details?.endpoint || req1.path || '';
    const endpoint2 = req2.details?.endpoint || req2.path || '';

    if (endpoint1 === endpoint2) return 1;

    // Check if endpoints follow similar patterns
    const pattern1 = this.extractEndpointPattern(endpoint1);
    const pattern2 = this.extractEndpointPattern(endpoint2);

    return pattern1 === pattern2 ? 0.8 : 0;
  }

  /**
   * Calculate user agent similarity between two requests
   */
  private calculateUserAgentSimilarity(req1: any, req2: any): number {
    const ua1 = req1.details?.userAgent || req1.headers?.['user-agent'] || '';
    const ua2 = req2.details?.userAgent || req2.headers?.['user-agent'] || '';

    if (ua1 === ua2) return 1;

    // Check for similar bot/automation patterns
    const isBot1 = this.isBotUserAgent(ua1);
    const isBot2 = this.isBotUserAgent(ua2);

    if (isBot1 && isBot2) return 0.9;
    if (isBot1 || isBot2) return 0.1;

    // Calculate string similarity
    return this.calculateStringSimilarity(ua1, ua2);
  }

  /**
   * Calculate payload similarity between two requests
   */
  private calculatePayloadSimilarity(req1: any, req2: any): number {
    const payload1 = JSON.stringify(req1.details?.payload || req1.body || {});
    const payload2 = JSON.stringify(req2.details?.payload || req2.body || {});

    if (payload1 === payload2) return 1;

    return this.calculateStringSimilarity(payload1, payload2);
  }

  /**
   * Create a request cluster from similar requests
   */
  private async createRequestCluster(requests: any[]): Promise<RequestCluster> {
    const ips = [...new Set(requests.map(r => r.details?.ip || r.ip))];
    const userAgents = [...new Set(requests.map(r => r.details?.userAgent || r.headers?.['user-agent']))];
    const endpoints = [...new Set(requests.map(r => r.details?.endpoint || r.path))];

    // Calculate pattern similarities
    const timingSimilarity = this.calculateClusterTimingSimilarity(requests);
    const endpointSimilarity = this.calculateClusterEndpointSimilarity(requests);
    const userAgentSimilarity = this.calculateClusterUserAgentSimilarity(requests);
    const payloadSimilarity = this.calculateClusterPayloadSimilarity(requests);

    // Calculate risk score
    const riskScore = this.calculateClusterRiskScore(requests, ips, endpoints);

    const timeSpan = Math.max(...requests.map(r => new Date(r.timestamp).getTime())) -
                     Math.min(...requests.map(r => new Date(r.timestamp).getTime()));

    return {
      id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ips,
      userAgents,
      endpoints,
      patterns: {
        timingSimilarity,
        endpointSimilarity,
        userAgentSimilarity,
        payloadSimilarity
      },
      requestCount: requests.length,
      timeSpan,
      riskScore
    };
  }

  /**
   * Analyze high-risk IPs
   */
  private async analyzeHighRiskIPs(requests: any[]): Promise<IPAnalysis[]> {
    const ipGroups = requests.reduce((groups, request) => {
      const ip = request.details?.ip || request.ip;
      if (!groups[ip]) groups[ip] = [];
      groups[ip].push(request);
      return groups;
    }, {} as Record<string, any[]>);

    const analyses: IPAnalysis[] = [];

    for (const [ip, ipRequests] of Object.entries(ipGroups)) {
      // Check cache first
      const cached = this.ipAnalysisCache.get(ip);
      if (cached && Date.now() - cached.reputation.lastUpdated.getTime() < this.cacheExpiry) {
        analyses.push(cached);
        continue;
      }

      const analysis = await this.analyzeIP(ip, ipRequests as any[]);
      this.ipAnalysisCache.set(ip, analysis);
      analyses.push(analysis);
    }

    return analyses.filter(analysis =>
      analysis.reputation.score < 0.3 || // Low reputation
      analysis.behavior.errorRate > 0.5 || // High error rate
      analysis.behavior.burstScore > 0.8 // High burst activity
    );
  }

  /**
   * Analyze individual IP
   */
  private async analyzeIP(ip: string, requests: any[]): Promise<IPAnalysis> {
    // Get IP reputation
    const reputation = await this.getIPReputation(ip);

    // Get geolocation
    const geolocation = await this.getIPGeolocation(ip);

    // Analyze behavior
    const behavior = this.analyzeIPBehavior(requests);

    // Find correlations
    const correlations = await this.findIPCorrelations(ip, requests);

    return {
      ip,
      reputation,
      geolocation,
      behavior,
      correlations
    };
  }

  /**
   * Detect attack patterns from clusters and IP analysis
   */
  private async detectAttackPatterns(
    clusters: RequestCluster[],
    highRiskIPs: IPAnalysis[],
    requests: any[]
  ): Promise<AttackPattern[]> {
    const attacks: AttackPattern[] = [];

    // Detect DDoS attacks
    const ddosAttacks = this.detectDDoSAttacks(clusters, highRiskIPs, requests);
    attacks.push(...ddosAttacks);

    // Detect credential stuffing
    const credentialStuffing = this.detectCredentialStuffing(requests);
    attacks.push(...credentialStuffing);

    // Detect API abuse
    const apiAbuse = this.detectAPIAbuse(clusters, requests);
    attacks.push(...apiAbuse);

    // Detect distributed brute force
    const bruteForce = this.detectDistributedBruteForce(requests);
    attacks.push(...bruteForce);

    return attacks.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Detect DDoS attacks
   */
  private detectDDoSAttacks(
    clusters: RequestCluster[],
    highRiskIPs: IPAnalysis[],
    requests: any[]
  ): AttackPattern[] {
    const attacks: AttackPattern[] = [];

    // Check for high request volume
    const requestsPerMinute = requests.length / 5; // Assuming 5 minute window
    if (requestsPerMinute > this.DDoS_THRESHOLD) {
      attacks.push({
        type: 'ddos',
        severity: 'critical',
        confidence: Math.min(requestsPerMinute / this.DDoS_THRESHOLD, 1),
        riskScore: Math.min((requestsPerMinute / this.DDoS_THRESHOLD) * 100, 100),
        affectedIPs: [...new Set(requests.map(r => r.details?.ip || r.ip))],
        affectedUsers: [...new Set(requests.map(r => r.userId).filter(Boolean))],
        timeWindow: 5,
        description: `High-volume DDoS attack detected: ${requestsPerMinute.toFixed(0)} requests/minute`,
        indicators: [
          'High request volume',
          'Multiple source IPs',
          'Similar request patterns'
        ]
      });
    }

    // Check for coordinated clusters
    const coordinatedClusters = clusters.filter(c =>
      c.ips.length > 10 &&
      c.patterns.timingSimilarity > 0.8 &&
      c.patterns.endpointSimilarity > 0.7
    );

    for (const cluster of coordinatedClusters) {
      attacks.push({
        type: 'ddos',
        severity: 'high',
        confidence: cluster.patterns.timingSimilarity,
        riskScore: cluster.riskScore,
        affectedIPs: cluster.ips,
        affectedUsers: [],
        timeWindow: Math.ceil(cluster.timeSpan / 60000), // Convert to minutes
        description: `Coordinated attack cluster: ${cluster.requestCount} requests from ${cluster.ips.length} IPs`,
        indicators: [
          'Coordinated timing',
          'Similar endpoints',
          'Multiple source IPs'
        ]
      });
    }

    return attacks;
  }

  /**
   * Detect credential stuffing attacks
   */
  private detectCredentialStuffing(requests: any[]): AttackPattern[] {
    const attacks: AttackPattern[] = [];

    // Group failed login attempts
    const failedLogins = requests.filter(r =>
      r.eventType === 'auth.failed' ||
      r.details?.reason === 'invalid_credentials'
    );

    // Group by time windows
    const timeWindows = this.groupByTimeWindow(failedLogins, 1); // 1 minute windows

    for (const [timestamp, windowRequests] of Object.entries(timeWindows)) {
      if (windowRequests.length > this.CREDENTIAL_STUFFING_THRESHOLD) {
        const uniqueAccounts = new Set(windowRequests.map(r => r.details?.email || r.userId));
        const uniqueIPs = new Set(windowRequests.map(r => r.details?.ip || r.ip));

        attacks.push({
          type: 'credential_stuffing',
          severity: 'high',
          confidence: Math.min(windowRequests.length / this.CREDENTIAL_STUFFING_THRESHOLD, 1),
          riskScore: Math.min((windowRequests.length / this.CREDENTIAL_STUFFING_THRESHOLD) * 80, 100),
          affectedIPs: Array.from(uniqueIPs),
          affectedUsers: Array.from(uniqueAccounts),
          timeWindow: 1,
          description: `Credential stuffing detected: ${windowRequests.length} failed logins targeting ${uniqueAccounts.size} accounts`,
          indicators: [
            'High failed login rate',
            'Multiple target accounts',
            'Low success rate'
          ]
        });
      }
    }

    return attacks;
  }

  /**
   * Detect API abuse patterns
   */
  private detectAPIAbuse(clusters: RequestCluster[], requests: any[]): AttackPattern[] {
    const attacks: AttackPattern[] = [];

    // Group API requests
    const apiRequests = requests.filter(r =>
      r.path?.startsWith('/api/') ||
      r.details?.endpoint?.startsWith('/api/')
    );

    const requestsPerMinute = apiRequests.length / 5; // Assuming 5 minute window
    if (requestsPerMinute > this.API_ABUSE_THRESHOLD) {
      attacks.push({
        type: 'api_abuse',
        severity: 'medium',
        confidence: Math.min(requestsPerMinute / this.API_ABUSE_THRESHOLD, 1),
        riskScore: Math.min((requestsPerMinute / this.API_ABUSE_THRESHOLD) * 70, 100),
        affectedIPs: [...new Set(apiRequests.map(r => r.details?.ip || r.ip))],
        affectedUsers: [...new Set(apiRequests.map(r => r.userId).filter(Boolean))],
        timeWindow: 5,
        description: `API abuse detected: ${requestsPerMinute.toFixed(0)} API requests/minute`,
        indicators: [
          'High API request volume',
          'Automated patterns',
          'Endpoint targeting'
        ]
      });
    }

    return attacks;
  }

  /**
   * Detect distributed brute force attacks
   */
  private detectDistributedBruteForce(requests: any[]): AttackPattern[] {
    const attacks: AttackPattern[] = [];

    // Group by target resource
    const resourceGroups = requests.reduce((groups, request) => {
      const resource = request.details?.resource || request.path;
      if (!groups[resource]) groups[resource] = [];
      groups[resource].push(request);
      return groups;
    }, {});

    for (const [resource, resourceRequests] of Object.entries(resourceGroups) as unknown as [string, any[]]) {
      const failedAttempts = resourceRequests.filter((r: any) =>
        r.eventType === 'auth.denied' ||
        r.details?.success === false
      );

      const uniqueIPs = new Set(failedAttempts.map((r: any) => r.details?.ip || r.ip));

      if (failedAttempts.length > 20 && uniqueIPs.size > 5) {
        attacks.push({
          type: 'brute_force',
          severity: 'medium',
          confidence: Math.min(failedAttempts.length / 50, 1),
          riskScore: Math.min((failedAttempts.length / 50) * 60, 100),
          affectedIPs: Array.from(uniqueIPs) as string[],
          affectedUsers: [],
          timeWindow: 5,
          description: `Distributed brute force on ${resource}: ${failedAttempts.length} attempts from ${uniqueIPs.size} IPs`,
          indicators: [
            'Multiple source IPs',
            'High failure rate',
            'Single target resource'
          ]
        });
      }
    }

    return attacks;
  }

  // Helper methods
  private extractEndpointPattern(endpoint: string): string {
    // Extract pattern by replacing IDs and parameters
    return endpoint
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-zA-Z0-9+/]{20,}/g, '/:token');
  }

  private isBotUserAgent(userAgent: string): boolean {
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /curl/i, /wget/i, /python/i, /java/i, /go-http/i
    ];
    return botPatterns.some(pattern => pattern.test(userAgent));
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

  private calculateClusterTimingSimilarity(requests: any[]): number {
    if (requests.length < 2) return 1;

    const intervals = [];
    for (let i = 1; i < requests.length; i++) {
      intervals.push(
        Math.abs(new Date(requests[i].timestamp).getTime() - new Date(requests[i-1].timestamp).getTime())
      );
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) =>
      sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

    return Math.max(0, 1 - variance / (avgInterval * avgInterval));
  }

  private calculateClusterEndpointSimilarity(requests: any[]): number {
    const endpoints = requests.map(r => r.details?.endpoint || r.path);
    const patterns = endpoints.map(e => this.extractEndpointPattern(e));
    const uniquePatterns = new Set(patterns);

    return 1 - (uniquePatterns.size - 1) / patterns.length;
  }

  private calculateClusterUserAgentSimilarity(requests: any[]): number {
    const userAgents = requests.map(r => r.details?.userAgent || r.headers?.['user-agent'] || '');
    const uniqueUserAgents = new Set(userAgents);

    return 1 - (uniqueUserAgents.size - 1) / userAgents.length;
  }

  private calculateClusterPayloadSimilarity(requests: any[]): number {
    const payloads = requests.map(r => JSON.stringify(r.details?.payload || r.body || {}));
    const uniquePayloads = new Set(payloads);

    return 1 - (uniquePayloads.size - 1) / payloads.length;
  }

  private calculateClusterRiskScore(requests: any[], ips: string[], endpoints: string[]): number {
    let riskScore = 0;

    // Base score from request volume
    riskScore += Math.min(requests.length / 100, 1) * 30;

    // Score from IP diversity
    riskScore += Math.min(ips.length / 50, 1) * 25;

    // Score from endpoint diversity
    riskScore += Math.min(endpoints.length / 10, 1) * 20;

    // Score from error rate
    const errorRate = requests.filter(r =>
      r.details?.statusCode >= 400 || r.eventType?.includes('failed')
    ).length / requests.length;
    riskScore += errorRate * 25;

    return Math.min(riskScore, 100);
  }

  private analyzeIPBehavior(requests: any[]): IPAnalysis['behavior'] {
    const endpoints = new Set(requests.map(r => r.details?.endpoint || r.path));
    const errorCount = requests.filter(r =>
      (r.details?.statusCode || 0) >= 400 || r.eventType?.includes('failed')
    ).length;

    const intervals = [];
    for (let i = 1; i < requests.length; i++) {
      intervals.push(
        Math.abs(new Date(requests[i].timestamp).getTime() - new Date(requests[i-1].timestamp).getTime())
      );
    }

    const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
    const burstScore = this.calculateBurstScore(intervals);

    return {
      requestCount: requests.length,
      uniqueEndpoints: endpoints.size,
      errorRate: errorCount / requests.length,
      avgRequestInterval: avgInterval,
      burstScore
    };
  }

  private calculateBurstScore(intervals: number[]): number {
    if (intervals.length < 2) return 0;

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) =>
      sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

    return Math.min(variance / (avgInterval * avgInterval), 1);
  }

  private groupByTimeWindow(requests: any[], windowMinutes: number): Record<string, any[]> {
    const windows: Record<string, any[]> = {};

    for (const request of requests) {
      const timestamp = new Date(request.timestamp);
      const windowStart = new Date(
        timestamp.getFullYear(),
        timestamp.getMonth(),
        timestamp.getDate(),
        timestamp.getHours(),
        Math.floor(timestamp.getMinutes() / windowMinutes) * windowMinutes
      );

      const key = windowStart.toISOString();
      if (!windows[key]) windows[key] = [];
      windows[key].push(request);
    }

    return windows;
  }

  // Data access methods (simplified implementations)
  private async getRecentRequests(tenantId: string, minutes: number): Promise<any[]> {
    const { data } = await this.supabase
      .from('security_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('timestamp', new Date(Date.now() - minutes * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false });

    return data || [];
  }

  private async getRelatedEvents(event: SecurityEvent, minutes: number): Promise<any[]> {
    const { data } = await this.supabase
      .from('security_events')
      .select('*')
      .eq('tenant_id', event.tenantId)
      .gte('timestamp', new Date(Date.now() - minutes * 60 * 1000).toISOString())
      .neq('id', event.id)
      .order('timestamp', { ascending: false });

    return data || [];
  }

  private async getIPReputation(ip: string): Promise<IPAnalysis['reputation']> {
    // Simplified reputation check - in production use real reputation service
    return {
      score: Math.random(),
      source: 'internal',
      lastUpdated: new Date()
    };
  }

  private async getIPGeolocation(ip: string): Promise<IPAnalysis['geolocation']> {
    // Simplified geolocation - in production use real geolocation service
    return {
      country: 'Unknown',
      region: 'Unknown',
      isProxy: Math.random() > 0.8,
      isVPN: Math.random() > 0.9,
      isTor: Math.random() > 0.95,
      isDatacenter: Math.random() > 0.7
    };
  }

  private async findIPCorrelations(ip: string, requests: any[]): Promise<IPAnalysis['correlations']> {
    // Simplified correlation analysis - in production use sophisticated correlation
    return {
      similarIPs: [],
      coordinatedPatterns: []
    };
  }

  private generateAttackRecommendations(attacks: AttackPattern[], clusters: RequestCluster[], highRiskIPs: IPAnalysis[]): string[] {
    const recommendations: string[] = [];

    if (attacks.some(a => a.type === 'ddos')) {
      recommendations.push('Enable global rate limiting to mitigate DDoS attacks');
      recommendations.push('Consider implementing CAPTCHA for suspicious requests');
    }

    if (attacks.some(a => a.type === 'credential_stuffing')) {
      recommendations.push('Implement account lockout after failed login attempts');
      recommendations.push('Add multi-factor authentication requirements');
    }

    if (attacks.some(a => a.type === 'api_abuse')) {
      recommendations.push('Implement API key authentication and rate limiting');
      recommendations.push('Add request validation and throttling');
    }

    if (highRiskIPs.length > 10) {
      recommendations.push('Block high-risk IP ranges at the firewall level');
    }

    if (clusters.some(c => c.riskScore > 80)) {
      recommendations.push('Implement behavioral analysis for request clustering');
    }

    return recommendations;
  }

  private generateEventSpecificRecommendations(attacks: AttackPattern[], event: SecurityEvent): string[] {
    const recommendations: string[] = [];

    for (const attack of attacks) {
      switch (attack.type) {
        case 'ddos':
          recommendations.push('Immediate rate limiting recommended');
          break;
        case 'credential_stuffing':
          recommendations.push('Enhanced authentication required');
          break;
        case 'api_abuse':
          recommendations.push('API access throttling recommended');
          break;
        case 'brute_force':
          recommendations.push('Account protection measures advised');
          break;
      }
    }

    return recommendations;
  }
}
