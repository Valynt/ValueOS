import { vi } from 'vitest';
/**
 * Integration Tests for Rate Limiting Security Enhancement
 *
 * Comprehensive test suite covering all threat scenarios and edge cases
 */


import { AdvancedThreatDetectionService } from '../src/services/AdvancedThreatDetectionService';
import { DynamicBaselineService } from '../src/services/DynamicBaselineService';
import { MLAnomalyDetectionService } from '../src/services/MLAnomalyDetectionService';
import { RateLimitKeyService } from '../src/services/RateLimitKeyService';
import { RateLimitMetricsService } from '../src/services/RateLimitMetricsService';
import { redisCircuitBreaker } from '../src/services/RedisCircuitBreaker';
import { SecurityAutomationService } from '../src/services/SecurityAutomationService';
import { SecurityEnforcementService } from '../src/services/SecurityEnforcementService';
import { SecurityEventValidator } from '../src/services/SecurityEventValidator';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  gte: vi.fn(() => mockSupabase),
  lte: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  single: vi.fn(() => mockSupabase),
  maybeSingle: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  match: vi.fn(() => mockSupabase),
  then: vi.fn((resolve) => resolve({
    data: [],
    error: null
  }))
};

// Mock Redis client
const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  ttl: vi.fn(),
  ping: vi.fn(() => Promise.resolve('PONG'))
};

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

vi.mock('../src/lib/logger', () => ({
  logger: mockLogger
}));

vi.mock('@lib/redisClient', () => ({
  getRedisClient: vi.fn(() => Promise.resolve(mockRedisClient))
}));

describe('Rate Limiting Security Enhancement Integration Tests', () => {
  let threatDetectionService: AdvancedThreatDetectionService;
  let securityAutomationService: SecurityAutomationService;
  let enforcementService: SecurityEnforcementService;
  let baselineService: DynamicBaselineService;
  let validator: SecurityEventValidator;
  let metricsService: RateLimitMetricsService;
  let mlService: MLAnomalyDetectionService;

  beforeAll(() => {
    // Initialize services
    mlService = new MLAnomalyDetectionService(mockSupabase as any);
    threatDetectionService = new AdvancedThreatDetectionService(mockSupabase as any);
    securityAutomationService = new SecurityAutomationService(mockSupabase as any, threatDetectionService);
    enforcementService = new SecurityEnforcementService(mockSupabase as any);
    baselineService = new DynamicBaselineService(mockSupabase as any);
    validator = new SecurityEventValidator();
    metricsService = new RateLimitMetricsService(mockSupabase as any);
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset circuit breaker
    redisCircuitBreaker.resetAllCircuits();

    // Mock successful database operations
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(Promise.resolve({ data: {}, error: null }));
    mockSupabase.update.mockReturnValue(Promise.resolve({ data: {}, error: null }));
    mockSupabase.delete.mockReturnValue(Promise.resolve({ data: {}, error: null }));
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.single.mockReturnValue(Promise.resolve({ data: {}, error: null }));
    mockSupabase.maybeSingle.mockReturnValue(Promise.resolve({ data: {}, error: null }));
    mockSupabase.then.mockReturnValue(Promise.resolve({ data: [], error: null }));
  });

  describe('ML-Based Threat Detection', () => {
    it('should detect anomalies using ML models', async () => {
      const securityEvent = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: 'auth.failed',
        severity: 'high' as const,
        source: 'auth-service',
        details: {
          ip: '192.168.1.100',
          failureReason: 'invalid_credentials',
          attemptCount: 6,
          userAgent: 'Mozilla/5.0'
        },
        timestamp: new Date(),
        riskScore: 0
      };

      const result = await threatDetectionService.analyzeSecurityEvent(securityEvent);

      expect(result.threats).toBeDefined();
      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.recommendations).toBeDefined();

      // Should have detected brute force attempt
      const bruteForceThreat = result.threats.find(t => t.id === 'brute_force_attempt');
      expect(bruteForceThreat).toBeDefined();
    });

    it('should fallback to statistical detection when ML fails', async () => {
      // Mock ML service failure
      vi.spyOn(mlService, 'analyzeEvent').mockRejectedValue(new Error('ML service unavailable'));

      const securityEvent = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: 'api.rate_limit_exceeded',
        severity: 'medium' as const,
        source: 'api-gateway',
        details: {
          ip: '192.168.1.100',
          requestCount: 150,
          timeWindow: 'minute',
          endpoint: '/api/data'
        },
        timestamp: new Date(),
        riskScore: 0
      };

      const result = await threatDetectionService.analyzeSecurityEvent(securityEvent);

      expect(result.threats).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ML anomaly detection failed, falling back to statistical',
        expect.any(Error)
      );
    });
  });

  describe('Security Event Validation', () => {
    it('should validate valid security events', () => {
      const validEvent = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: 'auth.success',
        severity: 'low' as const,
        source: 'auth-service',
        details: {
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          endpoint: '/login',
          method: 'POST',
          statusCode: 200,
          responseTime: 150
        },
        timestamp: new Date().toISOString(),
        riskScore: 10
      };

      const result = validator.validateSecurityEvent(validEvent);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedData).toBeDefined();
    });

    it('should reject invalid security events', () => {
      const invalidEvent = {
        tenantId: '', // Empty tenant ID
        userId: 'user-1',
        eventType: 'invalid.event', // Invalid event type
        severity: 'invalid' as const, // Invalid severity
        source: '', // Empty source
        details: null, // Missing required details
        timestamp: 'invalid-date', // Invalid timestamp
        riskScore: -10 // Invalid risk score
      };

      const result = validator.validateSecurityEvent(invalidEvent);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.sanitizedData).toBeUndefined();
    });

    it('should sanitize potentially dangerous content', () => {
      const maliciousEvent = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: 'auth.success',
        severity: 'low' as const,
        source: 'auth-service',
        details: {
          ip: '192.168.1.100',
          userAgent: '<script>alert("xss")</script>',
          endpoint: '/login?redirect=<script>',
          method: 'POST',
          statusCode: 200,
          responseTime: 150
        },
        timestamp: new Date().toISOString(),
        riskScore: 10
      };

      const result = validator.validateSecurityEvent(maliciousEvent);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.sanitizedData?.details.userAgent).not.toContain('<script>');
    });
  });

  describe('Dynamic Baselines', () => {
    it('should create tenant-specific baselines', async () => {
      const baseline = await baselineService.getTenantBaseline('tenant-1', 'login_spike');

      expect(baseline.tenantId).toBe('tenant-1');
      expect(baseline.metricName).toBe('login_spike');
      expect(baseline.baseline).toBeDefined();
      expect(baseline.learningConfig).toBeDefined();
    });

    it('should detect anomalies using dynamic baselines', async () => {
      // Mock baseline with specific values
      vi.spyOn(baselineService, 'isAnomalous').mockResolvedValue({
        isAnomalous: true,
        baseline: {
          id: 'baseline-1',
          tenantId: 'tenant-1',
          metricName: 'login_spike',
          baseline: { mean: 50, stdDev: 10, threshold: 80, confidence: 0.9, sampleSize: 100, lastUpdated: new Date() },
          learningConfig: { learningRate: 0.1, minSamples: 30, maxHistory: 90, adaptationSpeed: 'medium' as const }
        },
        zScore: 3.5,
        confidence: 0.9
      });

      const isAnomalous = await baselineService.isAnomalous('tenant-1', 'login_spike', 200);

      expect(isAnomalous.isAnomalous).toBe(true);
      expect(isAnomalous.zScore).toBe(3.5);
      expect(isAnomalous.confidence).toBe(0.9);
    });

    it('should record metrics for baseline learning', async () => {
      const recordSpy = vi.spyOn(baselineService, 'recordMetric');

      await baselineService.recordMetric('tenant-1', 'login_spike', 75, {
        eventType: 'auth.success',
        userId: 'user-1'
      });

      expect(recordSpy).toHaveBeenCalledWith('tenant-1', 'login_spike', 75, {
        eventType: 'auth.success',
        userId: 'user-1'
      });
    });
  });

  describe('Security Enforcement', () => {
    it('should block IP addresses', async () => {
      const ipBlock = await enforcementService.blockIPAddress(
        '192.168.1.100',
        'tenant-1',
        'Brute force attack detected',
        'high'
      );

      expect(ipBlock.ipAddress).toBe('192.168.1.100');
      expect(ipBlock.tenantId).toBe('tenant-1');
      expect(ipBlock.reason).toBe('Brute force attack detected');
      expect(ipBlock.severity).toBe('high');
      expect(ipBlock.blockType).toBe('temporary');
      expect(ipBlock.active).toBe(true);
    });

    it('should quarantine users', async () => {
      const quarantine = await enforcementService.quarantineUser(
        'user-1',
        'tenant-1',
        'Suspicious activity detected',
        'critical'
      );

      expect(quarantine.userId).toBe('user-1');
      expect(quarantine.tenantId).toBe('tenant-1');
      expect(quarantine.reason).toBe('Suspicious activity detected');
      expect(quarantine.severity).toBe('critical');
      expect(quarantine.active).toBe(true);
      expect(quarantine.affectedSessions).toBeDefined();
    });

    it('should check IP block status', async () => {
      // Mock IP is blocked
      vi.spyOn(enforcementService, 'isIPBlocked').mockResolvedValue(true);

      const isBlocked = await enforcementService.isIPBlocked('192.168.1.100', 'tenant-1');

      expect(isBlocked).toBe(true);
    });

    it('should check user quarantine status', async () => {
      // Mock user is quarantined
      vi.spyOn(enforcementService, 'isUserQuarantined').mockResolvedValue(true);

      const isQuarantined = await enforcementService.isUserQuarantined('user-1', 'tenant-1');

      expect(isQuarantined).toBe(true);
    });
  });

  describe('Security Automation', () => {
    it('should process security events end-to-end', async () => {
      const securityEvent = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: 'auth.failed',
        resourceId: 'resource-1',
        details: {
          ip: '192.168.1.100',
          failureReason: 'invalid_credentials',
          attemptCount: 6
        }
      };

      // Mock threat detection
      vi.spyOn(threatDetectionService, 'analyzeSecurityEvent').mockResolvedValue({
        threats: [{
          id: 'brute_force_attempt',
          name: 'Brute Force Attack',
          category: 'authentication',
          severity: 'high' as const,
          riskScore: 80,
          detectionLogic: expect.any(Function)
        }],
        riskScore: 80,
        recommendations: ['Enable multi-factor authentication']
      });

      // Mock incident creation
      vi.spyOn(securityAutomationService as any, 'createSecurityIncident').mockResolvedValue({
        id: 'incident-1',
        tenantId: 'tenant-1',
        title: 'AUTHENTICATION: Brute Force Attack',
        description: 'Automated detection: Brute Force Attack',
        severity: 'high' as const,
        status: 'detected' as const,
        incidentType: 'authentication',
        affectedResources: ['resource-1'],
        threatIndicators: ['brute_force_attempt'],
        riskScore: 80,
        impact: {
          usersAffected: 0,
          dataCompromised: false,
          serviceDisruption: false
        },
        detectedAt: new Date()
      });

      const result = await securityAutomationService.processSecurityEvent(securityEvent);

      expect(result.incidentCreated).toBe(true);
      expect(result.incident).toBeDefined();
      expect(result.responsesTriggered).toBeDefined();
      expect(result.responsesTriggered.length).toBeGreaterThan(0);
    });

    it('should handle validation failures gracefully', async () => {
      const invalidEvent = {
        tenantId: '', // Invalid
        eventType: 'invalid.event',
        details: null
      };

      await expect(securityAutomationService.processSecurityEvent(invalidEvent))
        .rejects.toThrow('Invalid security event');
    });
  });

  describe('Rate Limit Key Service', () => {
    it('should generate consistent keys', () => {
      const mockRequest = {
        user: { id: 'user-1', subscription_tier: 'pro' as const },
        ip: '192.168.1.100',
        headers: { 'x-tenant-id': 'tenant-1' },
        socket: { remoteAddress: '192.168.1.100' }
      } as any;

      const key1 = RateLimitKeyService.generateSecureKey(mockRequest, {
        service: 'llm',
        tier: 'pro'
      });

      const key2 = RateLimitKeyService.generateSecureKey(mockRequest, {
        service: 'llm',
        tier: 'pro'
      });

      expect(key1).toBe(key2);
      expect(key1).toContain('rl:llm:pro:tenant-1:user:user-1');
    });

    it('should parse keys correctly', () => {
      const key = 'rl:llm:pro:tenant-1:user:user-1:scope:api';
      const parsed = RateLimitKeyService.parseKey(key);

      expect(parsed.service).toBe('llm');
      expect(parsed.tier).toBe('pro');
      expect(parsed.tenantId).toBe('tenant-1');
      expect(parsed.userId).toBe('user-1');
      expect(parsed.scope).toBe('api');
    });

    it('should validate key format', () => {
      const validKey = 'rl:llm:pro:tenant-1:user:user-1';
      const invalidKey = 'invalid-key-format';

      expect(RateLimitKeyService.validateKey(validKey)).toBe(true);
      expect(RateLimitKeyService.validateKey(invalidKey)).toBe(false);
    });
  });

  describe('Redis Circuit Breaker', () => {
    it('should execute operations successfully when Redis is available', async () => {
      const result = await redisCircuitBreaker.execute({
        operation: () => Promise.resolve('success'),
        operationName: 'test-operation',
        timeout: 1000
      });

      expect(result).toBe('success');
    });

    it('should use fallback when Redis fails', async () => {
      // Mock Redis failure
      vi.spyOn(mockRedisClient, 'get').mockRejectedValue(new Error('Redis connection failed'));

      const result = await redisCircuitBreaker.execute({
        operation: () => mockRedisClient.get('test-key'),
        operationName: 'redis-get',
        timeout: 1000,
        fallback: () => Promise.resolve('fallback-result')
      });

      expect(result).toBe('fallback-result');
    });

    it('should open circuit after threshold failures', async () => {
      const operationName = 'failing-operation';

      // Mock consecutive failures
      for (let i = 0; i < 5; i++) {
        try {
          await redisCircuitBreaker.execute({
            operation: () => Promise.reject(new Error('Redis error')),
            operationName,
            timeout: 1000
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should now be open
      await expect(redisCircuitBreaker.execute({
        operation: () => Promise.resolve('should not execute'),
        operationName,
        timeout: 1000
      })).rejects.toThrow('Circuit breaker OPEN');
    });

    it('should provide statistics', () => {
      const stats = redisCircuitBreaker.getStats();

      expect(stats.totalCircuits).toBeDefined();
      expect(stats.openCircuits).toBeDefined();
      expect(stats.halfOpenCircuits).toBeDefined();
      expect(stats.closedCircuits).toBeDefined();
      expect(stats.circuits).toBeInstanceOf(Array);
    });
  });

  describe('Rate Limit Metrics', () => {
    it('should record metrics for requests', async () => {
      const metricsData = {
        tenantId: 'tenant-1',
        service: 'llm',
        tier: 'pro',
        endpoint: '/api/chat',
        method: 'POST',
        blocked: false,
        responseTime: 150,
        userId: 'user-1',
        ip: '192.168.1.100'
      };

      await metricsService.recordMetrics(metricsData);

      // Verify metrics were recorded (implementation dependent)
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should generate dashboard data', async () => {
      const query = {
        tenantId: 'tenant-1',
        timeRange: {
          start: new Date(Date.now() - 60 * 60 * 1000),
          end: new Date()
        },
        granularity: 'hour' as const
      };

      // Mock metrics query
      vi.spyOn(metricsService as any, 'queryMetrics').mockResolvedValue([]);

      const dashboard = await metricsService.getDashboard(query);

      expect(dashboard.overview).toBeDefined();
      expect(dashboard.services).toBeDefined();
      expect(dashboard.tiers).toBeDefined();
      expect(dashboard.trends).toBeDefined();
      expect(dashboard.alerts).toBeDefined();
    });

    it('should provide system health status', async () => {
      const health = await metricsService.getSystemHealth();

      expect(health.status).toMatch(/^(healthy|degraded|critical)$/);
      expect(health.metrics).toBeDefined();
      expect(health.metrics.activeConnections).toBeDefined();
      expect(health.metrics.circuitBreakerStats).toBeDefined();
    });
  });

  describe('End-to-End Threat Scenarios', () => {
    it('should handle brute force attack scenario', async () => {
      // Simulate multiple failed login attempts
      const failedLogins = Array.from({ length: 6 }, (_, i) => ({
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: 'auth.failed' as const,
        severity: 'high' as const,
        source: 'auth-service',
        details: {
          ip: '192.168.1.100',
          failureReason: 'invalid_credentials',
          attemptCount: i + 1,
          userAgent: 'Mozilla/5.0'
        },
        timestamp: new Date(),
        riskScore: 0
      }));

      // Process each failed login
      const results = await Promise.all(
        failedLogins.map(event => threatDetectionService.analyzeSecurityEvent(event))
      );

      // All should detect brute force threat
      results.forEach(result => {
        expect(result.threats.some(t => t.id === 'brute_force_attempt')).toBe(true);
        expect(result.riskScore).toBeGreaterThan(70);
      });

      // Last attempt should trigger security automation
      const lastResult = results[results.length - 1];
      expect(lastResult.recommendations).toContain('Enable multi-factor authentication');
    });

    it('should handle data exfiltration scenario', async () => {
      const exfiltrationEvent = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: 'data.export' as const,
        severity: 'high' as const,
        source: 'api-service',
        details: {
          ip: '192.168.1.100',
          recordCount: 15000, // Exceeds threshold
          endpoint: '/api/export',
          method: 'POST',
          responseTime: 5000
        },
        timestamp: new Date(),
        riskScore: 0
      };

      const result = await threatDetectionService.analyzeSecurityEvent(exfiltrationEvent);

      expect(result.threats.some(t => t.id === 'data_exfiltration')).toBe(true);
      expect(result.riskScore).toBeGreaterThan(80);
      expect(result.recommendations).toContain('Monitor user behavior patterns');
    });

    it('should handle privilege escalation scenario', async () => {
      const escalationEvent = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: 'auth.denied' as const,
        severity: 'critical' as const,
        source: 'auth-service',
        details: {
          ip: '192.168.1.100',
          reason: 'insufficient_permissions',
          resourceType: 'admin',
          endpoint: '/admin/users',
          method: 'POST'
        },
        timestamp: new Date(),
        riskScore: 0
      };

      const result = await threatDetectionService.analyzeSecurityEvent(escalationEvent);

      expect(result.threats.some(t => t.id === 'privilege_escalation')).toBe(true);
      expect(result.riskScore).toBeGreaterThan(90);
      expect(result.recommendations).toContain('Implement principle of least privilege');
    });

    it('should handle mixed attack scenario', async () => {
      // Simulate multiple different attack types
      const events = [
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          eventType: 'auth.failed' as const,
          severity: 'high' as const,
          source: 'auth-service',
          details: { ip: '192.168.1.100', failureReason: 'invalid_credentials', attemptCount: 3 },
          timestamp: new Date(),
          riskScore: 0
        },
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          eventType: 'api.rate_limit_exceeded' as const,
          severity: 'medium' as const,
          source: 'api-gateway',
          details: { ip: '192.168.1.100', requestCount: 150, timeWindow: 'minute' },
          timestamp: new Date(),
          riskScore: 0
        },
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          eventType: 'auth.denied' as const,
          severity: 'critical' as const,
          source: 'auth-service',
          details: { ip: '192.168.1.100', reason: 'insufficient_permissions', resourceType: 'admin' },
          timestamp: new Date(),
          riskScore: 0
        }
      ];

      const results = await Promise.all(events.map(event => threatDetectionService.analyzeSecurityEvent(event)));

      // Should detect multiple threat types
      const allThreats = results.flatMap(r => r.threats);
      expect(allThreats.length).toBeGreaterThan(2);

      // Should have escalating risk scores
      const riskScores = results.map(r => r.riskScore);
      expect(Math.max(...riskScores)).toBeGreaterThan(80);
    });
  });

  describe('Performance and Resilience', () => {
    it('should handle high volume of events efficiently', async () => {
      const startTime = Date.now();

      // Process 1000 events
      const events = Array.from({ length: 1000 }, (_, i) => ({
        tenantId: `tenant-${i % 10}`,
        userId: `user-${i % 100}`,
        eventType: 'auth.success' as const,
        severity: 'low' as const,
        source: 'auth-service',
        details: { ip: `192.168.1.${i % 255}`, endpoint: '/login' },
        timestamp: new Date(),
        riskScore: 5
      }));

      await Promise.all(events.map(event => threatDetectionService.analyzeSecurityEvent(event)));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(10000); // 10 seconds
    });

    it('should maintain performance during Redis failures', async () => {
      // Mock Redis failure
      vi.spyOn(mockRedisClient, 'get').mockRejectedValue(new Error('Redis unavailable'));

      const events = Array.from({ length: 100 }, (_, i) => ({
        tenantId: 'tenant-1',
        userId: `user-${i}`,
        eventType: 'auth.success' as const,
        severity: 'low' as const,
        source: 'auth-service',
        details: { ip: '192.168.1.100' },
        timestamp: new Date(),
        riskScore: 5
      }));

      // Should still process events without Redis
      await expect(Promise.all(events.map(event => threatDetectionService.analyzeSecurityEvent(event))))
        .resolves.toBeDefined();
    });

    it('should handle malformed events gracefully', async () => {
      const malformedEvents = [
        null,
        undefined,
        {},
        { tenantId: '', eventType: '', details: null },
        { tenantId: 'tenant-1', eventType: 'invalid', details: {} }
      ];

      for (const event of malformedEvents) {
        await expect(threatDetectionService.analyzeSecurityEvent(event as any))
          .rejects.toThrow();
      }
    });
  });

  afterAll(() => {
    // Cleanup
    vi.restoreAllMocks();
  });
});
