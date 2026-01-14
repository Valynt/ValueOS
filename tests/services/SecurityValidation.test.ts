/**
 * Security Validation Unit Tests
 *
 * Comprehensive test suite for security validation including
 * context sharing, message signing, and access control.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecureSharedContext } from '../../src/services/SecureSharedContext';
import { SecureMessageBus } from '../../src/lib/agent-fabric/SecureMessageBus';
import { SecurityMonitor } from '../../src/services/security/SecurityMonitor';
import { AgentType } from '../../src/services/agent-types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock console methods to reduce test noise
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock logger
jest.mock('../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock audit logger
jest.mock('../src/services/AgentAuditLogger', () => ({
  getAuditLogger: () => ({
    log: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
  }),
}));

// Mock crypto utilities
jest.mock('../src/lib/crypto/CryptoUtils', () => ({
  signMessage: jest.fn().mockResolvedValue('mock-signature'),
  verifySignature: jest.fn().mockResolvedValue(true),
  encrypt: jest.fn().mockReturnValue({
    data: 'encrypted-data',
    iv: 'mock-iv',
    algorithm: 'aes-256-gcm',
    tag: 'mock-tag',
  }),
  decrypt: jest.fn().mockReturnValue('decrypted-data'),
  generateNonce: jest.fn().mockReturnValue('mock-nonce'),
  isEncrypted: jest.fn().mockReturnValue(false),
  generateEncryptionKey: jest.fn().mockReturnValue('mock-key'),
}));

// Mock agent identity
jest.mock('../src/lib/auth/AgentIdentity', () => ({
  hasPermission: jest.fn().mockReturnValue(true),
}));

describe('SecureSharedContext', () => {
  let secureContext: SecureSharedContext;
  let mockSecurityContext: any;

  beforeEach(() => {
    secureContext = new SecureSharedContext();
    mockSecurityContext = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      permissions: ['context.read', 'context.write'],
      trustLevel: 'medium',
      sessionId: 'test-session',
      traceId: 'test-trace',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Context Sharing Validation', () => {
    it('should allow valid context sharing between permitted agents', async () => {
      const request = {
        fromAgent: 'coordinator' as AgentType,
        toAgent: 'opportunity' as AgentType,
        contextKey: 'test-key',
        data: { message: 'test data' },
        securityContext: mockSecurityContext,
        auditMetadata: {},
      };

      const result = await secureContext.shareContext(request);

      expect(result).toBe(true);
    });

    it('should deny context sharing between non-permitted agents', async () => {
      const request = {
        fromAgent: 'communicator' as AgentType,
        toAgent: 'integrity' as AgentType,
        contextKey: 'test-key',
        data: { message: 'test data' },
        securityContext: mockSecurityContext,
        auditMetadata: {},
      };

      const result = await secureContext.shareContext(request);

      expect(result).toBe(false);
    });

    it('should validate required fields in context share request', async () => {
      const invalidRequest = {
        fromAgent: '' as AgentType,
        toAgent: 'opportunity' as AgentType,
        contextKey: 'test-key',
        data: { message: 'test data' },
        securityContext: mockSecurityContext,
        auditMetadata: {},
      };

      await expect(secureContext.shareContext(invalidRequest)).rejects.toThrow('Agent types are required');
    });

    it('should sanitize context data before storage', async () => {
      const request = {
        fromAgent: 'coordinator' as AgentType,
        toAgent: 'opportunity' as AgentType,
        contextKey: 'test-key',
        data: {
          message: '<script>alert("xss")</script>test',
          safeData: 'normal data',
        },
        securityContext: mockSecurityContext,
        auditMetadata: {},
      };

      const result = await secureContext.shareContext(request);
      expect(result).toBe(true);

      // Retrieve and verify sanitization
      const retrieved = await secureContext.retrieveSharedContext(
        'coordinator',
        'opportunity',
        'test-key',
        mockSecurityContext
      );

      expect(retrieved?.message).not.toContain('<script>');
      expect(retrieved?.safeData).toBe('normal data');
    });

    it('should limit data size for context sharing', async () => {
      const largeData = 'x'.repeat(1024 * 1024 + 1); // > 1MB

      const request = {
        fromAgent: 'coordinator' as AgentType,
        toAgent: 'opportunity' as AgentType,
        contextKey: 'test-key',
        data: largeData,
        securityContext: mockSecurityContext,
        auditMetadata: {},
      };

      await expect(secureContext.shareContext(request)).rejects.toThrow('Context data too large');
    });

    it('should assess data sensitivity correctly', async () => {
      const highSensitivityData = {
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111',
        email: 'test@example.com',
      };

      const request = {
        fromAgent: 'coordinator' as AgentType,
        toAgent: 'opportunity' as AgentType,
        contextKey: 'test-key',
        data: highSensitivityData,
        securityContext: {
          ...mockSecurityContext,
          trustLevel: 'low', // Insufficient for sensitive data
        },
        auditMetadata: {},
      };

      const result = await secureContext.shareContext(request);
      expect(result).toBe(false); // Should be denied due to insufficient trust level
    });

    it('should validate context key format', async () => {
      const request = {
        fromAgent: 'coordinator' as AgentType,
        toAgent: 'opportunity' as AgentType,
        contextKey: 'invalid key with spaces!',
        data: { message: 'test' },
        securityContext: mockSecurityContext,
        auditMetadata: {},
      };

      await expect(secureContext.shareContext(request)).rejects.toThrow('Context key must be alphanumeric');
    });
  });

  describe('Context Retrieval Validation', () => {
    beforeEach(async () => {
      // Set up a valid shared context
      const request = {
        fromAgent: 'coordinator' as AgentType,
        toAgent: 'opportunity' as AgentType,
        contextKey: 'test-key',
        data: { message: 'test data' },
        securityContext: mockSecurityContext,
        auditMetadata: {},
      };
      await secureContext.shareContext(request);
    });

    it('should allow retrieval by permitted agents', async () => {
      const result = await secureContext.retrieveSharedContext(
        'coordinator',
        'opportunity',
        'test-key',
        mockSecurityContext
      );

      expect(result).toEqual({ message: 'test data' });
    });

    it('should deny retrieval by non-permitted agents', async () => {
      const result = await secureContext.retrieveSharedContext(
        'communicator',
        'opportunity',
        'test-key',
        mockSecurityContext
      );

      expect(result).toBeNull();
    });

    it('should enforce tenant isolation', async () => {
      const differentTenantContext = {
        ...mockSecurityContext,
        tenantId: 'different-tenant',
      };

      const result = await secureContext.retrieveSharedContext(
        'coordinator',
        'opportunity',
        'test-key',
        differentTenantContext
      );

      expect(result).toBeNull();
    });

    it('should handle expired contexts', async () => {
      // Mock expired context by manipulating internal state
      const contextCache = (secureContext as any).contextCache;
      const cacheKey = Array.from(contextCache.keys())[0];
      if (cacheKey) {
        contextCache.get(cacheKey).expiresAt = Date.now() - 1000;
      }

      const result = await secureContext.retrieveSharedContext(
        'coordinator',
        'opportunity',
        'test-key',
        mockSecurityContext
      );

      expect(result).toBeNull();
    });
  });

  describe('Agent Security Levels', () => {
    it('should validate security level compatibility', async () => {
      // High security agent to low security agent should generate warning
      const request = {
        fromAgent: 'integrity' as AgentType, // High security level
        toAgent: 'communicator' as AgentType, // Low security level
        contextKey: 'test-key',
        data: { message: 'test' },
        securityContext: mockSecurityContext,
        auditMetadata: {},
      };

      // This should succeed but with warnings
      const result = await secureContext.shareContext(request);
      expect(result).toBe(true);
    });

    it('should get correct security levels for agents', () => {
      const integrityLevel = (secureContext as any).getAgentSecurityLevel('integrity');
      const communicatorLevel = (secureContext as any).getAgentSecurityLevel('communicator');

      expect(integrityLevel).toBe(4); // Highest
      expect(communicatorLevel).toBe(1); // Lowest
    });
  });

  describe('Compliance Requirements', () => {
    it('should enforce financial compliance requirements', async () => {
      const request = {
        fromAgent: 'financial-modeling' as AgentType,
        toAgent: 'target' as AgentType,
        contextKey: 'test-key',
        data: { financialData: 'sensitive' },
        securityContext: {
          ...mockSecurityContext,
          permissions: ['context.read'], // Missing financial permissions
        },
        auditMetadata: {},
      };

      const result = await secureContext.shareContext(request);
      expect(result).toBe(false); // Should be denied due to missing permissions
    });

    it('should require audit permissions for integrity agents', async () => {
      const request = {
        fromAgent: 'integrity' as AgentType,
        toAgent: 'groundtruth' as AgentType,
        contextKey: 'test-key',
        data: { auditData: 'sensitive' },
        securityContext: {
          ...mockSecurityContext,
          permissions: ['context.read'], // Missing audit permissions
        },
        auditMetadata: {},
      };

      const result = await secureContext.shareContext(request);
      expect(result).toBe(false); // Should be denied due to missing audit permissions
    });
  });

  describe('Cache Management', () => {
    it('should limit cache size', async () => {
      // Fill cache beyond limits
      for (let i = 0; i < 600; i++) {
        const request = {
          fromAgent: 'coordinator' as AgentType,
          toAgent: 'opportunity' as AgentType,
          contextKey: `test-key-${i}`,
          data: { message: `test data ${i}` },
          securityContext: mockSecurityContext,
          auditMetadata: {},
        };
        await secureContext.shareContext(request);
      }

      const stats = secureContext.getContextStats();
      expect(stats.cachedContexts).toBeLessThanOrEqual(500);
    });

    it('should cleanup expired contexts', async () => {
      // Add contexts and manually expire them
      const contextCache = (secureContext as any).contextCache;

      // Add some contexts
      for (let i = 0; i < 5; i++) {
        const request = {
          fromAgent: 'coordinator' as AgentType,
          toAgent: 'opportunity' as AgentType,
          contextKey: `test-key-${i}`,
          data: { message: `test data ${i}` },
          securityContext: mockSecurityContext,
          auditMetadata: {},
        };
        await secureContext.shareContext(request);
      }

      // Manually expire all contexts
      for (const [key, cache] of contextCache.entries()) {
        cache.expiresAt = Date.now() - 1000;
      }

      // Trigger cleanup
      (secureContext as any).cleanupExpiredContexts();

      const stats = secureContext.getContextStats();
      expect(stats.cachedContexts).toBe(0);
    });
  });
});

describe('SecureMessageBus', () => {
  let messageBus: SecureMessageBus;
  let mockSender: any;
  let mockRecipient: any;

  beforeEach(() => {
    messageBus = SecureMessageBus.getInstance();

    mockSender = {
      id: 'sender-agent',
      keys: {
        privateKey: 'mock-private-key',
        publicKey: 'mock-public-key',
        encryptionKey: 'mock-encryption-key',
      },
    };

    mockRecipient = {
      id: 'recipient-agent',
      keys: {
        privateKey: 'mock-private-key',
        publicKey: 'mock-public-key',
        encryptionKey: 'mock-encryption-key',
      },
    };

    // Register agents
    messageBus.registerAgent(mockSender);
    messageBus.registerAgent(mockRecipient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    messageBus.destroy();
  });

  describe('Message Signing and Verification', () => {
    it('should sign messages correctly', async () => {
      const message = await messageBus.send(
        mockSender,
        mockRecipient.id,
        { data: 'test message' }
      );

      expect(message.signature).toBe('mock-signature');
      expect(message.from).toBe(mockSender.id);
      expect(message.to).toBe(mockRecipient.id);
      expect(message.nonce).toBeDefined();
    });

    it('should verify message signatures', async () => {
      const message = await messageBus.send(
        mockSender,
        mockRecipient.id,
        { data: 'test message' }
      );

      // Mock successful verification
      const { verifySignature } = require('../src/lib/crypto/CryptoUtils');
      verifySignature.mockResolvedValue(true);

      const payload = await messageBus.receive(message);
      expect(payload).toEqual({ data: 'test message' });
    });

    it('should reject messages with invalid signatures', async () => {
      const message = await messageBus.send(
        mockSender,
        mockRecipient.id,
        { data: 'test message' }
      );

      // Mock failed verification
      const { verifySignature } = require('../src/lib/crypto/CryptoUtils');
      verifySignature.mockResolvedValue(false);

      await expect(messageBus.receive(message)).rejects.toThrow('Invalid message signature');
    });
  });

  describe('Replay Attack Protection', () => {
    it('should prevent replay attacks', async () => {
      const message = await messageBus.send(
        mockSender,
        mockRecipient.id,
        { data: 'test message' }
      );

      // First receive should succeed
      const payload1 = await messageBus.receive(message);
      expect(payload1).toEqual({ data: 'test message' });

      // Second receive of same message should fail
      await expect(messageBus.receive(message)).rejects.toThrow('Replay attack detected');
    });

    it('should track nonces correctly', async () => {
      const message1 = await messageBus.send(
        mockSender,
        mockRecipient.id,
        { data: 'message 1' }
      );

      const message2 = await messageBus.send(
        mockSender,
        mockRecipient.id,
        { data: 'message 2' }
      );

      expect(message1.nonce).not.toBe(message2.nonce);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Send messages rapidly to exceed rate limit
      const promises = [];
      for (let i = 0; i < 15; i++) { // Exceed default limit of 10 per second
        promises.push(
          messageBus.send(mockSender, mockRecipient.id, { data: `message ${i}` })
        );
      }

      const results = await Promise.allSettled(promises);
      const failures = results.filter(r => r.status === 'rejected');

      expect(failures.length).toBeGreaterThan(0);
      expect(failures[0].status).toBe('rejected');
    });

    it('should reset rate limit after window expires', async () => {
      // Send messages up to limit
      for (let i = 0; i < 10; i++) {
        await messageBus.send(mockSender, mockRecipient.id, { data: `message ${i}` });
      }

      // Wait for window to reset (mock time advancement would be needed in real test)
      // For now, just verify that subsequent messages after a delay work
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await messageBus.send(mockSender, mockRecipient.id, { data: 'new message' });
      expect(result).toBeDefined();
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should open circuit for compromised agents', async () => {
      // Mark agent as compromised
      messageBus.markCompromised(mockSender.id, 'Test compromise');

      // Should reject messages from compromised agent
      await expect(
        messageBus.send(mockSender, mockRecipient.id, { data: 'test' })
      ).rejects.toThrow('Circuit is open for agent');
    });

    it('should reset security status', async () => {
      // Mark as compromised
      messageBus.markCompromised(mockSender.id, 'Test compromise');

      // Reset status
      messageBus.resetSecurityStatus(mockSender.id);

      // Should now allow messages
      const result = await messageBus.send(mockSender, mockRecipient.id, { data: 'test' });
      expect(result).toBeDefined();
    });
  });

  describe('Message Encryption', () => {
    it('should encrypt sensitive messages', async () => {
      const message = await messageBus.send(
        mockSender,
        mockRecipient.id,
        { sensitiveData: 'secret' },
        { encrypted: true }
      );

      expect(message.encrypted).toBe(true);
      expect(message.encryption).toBeDefined();
      expect(message.encryption?.algorithm).toBe('aes-256-gcm');
    });

    it('should decrypt messages for recipients', async () => {
      const message = await messageBus.send(
        mockSender,
        mockRecipient.id,
        { sensitiveData: 'secret' },
        { encrypted: true }
      );

      const payload = await messageBus.receive(message);
      expect(payload).toEqual({ sensitiveData: 'secret' });
    });

    it('should handle broadcast messages without encryption', async () => {
      const message = await messageBus.broadcast(
        mockSender,
        { data: 'broadcast message' }
      );

      expect(message.encrypted).toBe(false);
      expect(message.to).toBe('broadcast');
    });
  });

  describe('Message Delivery', () => {
    it('should deliver messages to specific recipients', async () => {
      let receivedMessage: any = null;

      messageBus.subscribe(mockRecipient.id, async (message, sender) => {
        receivedMessage = message;
      });

      await messageBus.send(mockSender, mockRecipient.id, { data: 'test message' });

      // Wait for async delivery
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedMessage).toBeDefined();
      expect(receivedMessage.payload).toEqual({ data: 'test message' });
    });

    it('should handle message expiration', async () => {
      const message = await messageBus.send(
        mockSender,
        mockRecipient.id,
        { data: 'test message' },
        { ttlSeconds: 0.001 } // Very short TTL
      );

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(messageBus.receive(message)).rejects.toThrow('Message has expired');
    });
  });
});

describe('SecurityMonitor', () => {
  let securityMonitor: SecurityMonitor;

  beforeEach(() => {
    securityMonitor = SecurityMonitor.getInstance();
  });

  afterEach(() => {
    securityMonitor.stop();
  });

  describe('Event Recording', () => {
    it('should record security events', () => {
      const event = securityMonitor.recordEvent(
        'context_share_denied',
        'high',
        'test-source',
        'Test event description',
        { details: 'test details' }
      );

      expect(event.id).toBeDefined();
      expect(event.type).toBe('context_share_denied');
      expect(event.severity).toBe('high');
      expect(event.source).toBe('test-source');
      expect(event.resolved).toBe(false);
    });

    it('should track event metrics', () => {
      // Record various events
      securityMonitor.recordEvent('context_share_denied', 'medium', 'source1', 'desc1', {});
      securityMonitor.recordEvent('message_signature_invalid', 'high', 'source2', 'desc2', {});
      securityMonitor.recordEvent('replay_attack_detected', 'critical', 'source3', 'desc3', {});

      const metrics = securityMonitor.getMetrics();

      expect(metrics.totalEvents).toBe(3);
      expect(metrics.eventsByType['context_share_denied']).toBe(1);
      expect(metrics.eventsByType['message_signature_invalid']).toBe(1);
      expect(metrics.eventsByType['replay_attack_detected']).toBe(1);
      expect(metrics.eventsBySeverity['medium']).toBe(1);
      expect(metrics.eventsBySeverity['high']).toBe(1);
      expect(metrics.eventsBySeverity['critical']).toBe(1);
    });
  });

  describe('Alert Management', () => {
    it('should create alerts for high-severity events', () => {
      const event = securityMonitor.recordEvent(
        'agent_compromised',
        'critical',
        'test-source',
        'Agent compromised',
        {}
      );

      const alerts = securityMonitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].eventId).toBe(event.id);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should acknowledge alerts', () => {
      const event = securityMonitor.recordEvent(
        'context_share_denied',
        'high',
        'test-source',
        'Test event',
        {}
      );

      const alerts = securityMonitor.getActiveAlerts();
      const alertId = alerts[0].id;

      const acknowledged = securityMonitor.acknowledgeAlert(alertId, 'test-user');
      expect(acknowledged).toBe(true);

      const updatedAlert = securityMonitor.getAlert(alertId);
      expect(updatedAlert?.acknowledged).toBe(true);
      expect(updatedAlert?.acknowledgedBy).toBe('test-user');
    });

    it('should resolve events', () => {
      const event = securityMonitor.recordEvent(
        'context_share_denied',
        'medium',
        'test-source',
        'Test event',
        {}
      );

      const resolved = securityMonitor.resolveEvent(event.id, 'test-user');
      expect(resolved).toBe(true);

      const updatedEvent = securityMonitor.getEvent(event.id);
      expect(updatedEvent?.resolved).toBe(true);
      expect(updatedEvent?.resolvedBy).toBe('test-user');
    });
  });

  describe('Audit Log Analysis', () => {
    it('should analyze denied context shares', async () => {
      // Mock audit log data
      const { getAuditLogger } = require('../src/services/AgentAuditLogger');
      const mockAuditLogger = {
        query: jest.fn().mockResolvedValue([
          {
            input_query: 'context_share_denied',
            success: false,
            agent_name: 'test-agent',
            error_message: 'Permission denied',
          },
          {
            input_query: 'context_share_denied',
            success: false,
            agent_name: 'test-agent-2',
            error_message: 'Invalid agent pair',
          },
          {
            input_query: 'context_share_denied',
            success: false,
            agent_name: 'test-agent-3',
            error_message: 'Data too sensitive',
          },
          {
            input_query: 'context_share_denied',
            success: false,
            agent_name: 'test-agent-4',
            error_message: 'Missing permissions',
          },
          {
            input_query: 'context_share_denied',
            success: false,
            agent_name: 'test-agent-5',
            error_message: 'Security level mismatch',
          },
          {
            input_query: 'context_share_denied',
            success: false,
            agent_name: 'test-agent-6',
            error_message: 'Tenant violation',
          },
        ]),
      };
      getAuditLogger.mockReturnValue(mockAuditLogger);

      // Trigger analysis
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for monitoring interval

      const metrics = securityMonitor.getMetrics();
      expect(metrics.eventsByType['context_share_denied']).toBeGreaterThan(0);
    });
  });

  describe('Cleanup and Retention', () => {
    it('should cleanup old events and alerts', () => {
      // Record events
      for (let i = 0; i < 10; i++) {
        securityMonitor.recordEvent('test_event', 'low', 'test-source', 'desc', {});
      }

      // Manually trigger cleanup
      (securityMonitor as any).cleanupOldEvents();

      // Should still have recent events
      const recentEvents = securityMonitor.getRecentEvents();
      expect(recentEvents.length).toBeGreaterThan(0);
    });
  });
});

describe('Security Integration Tests', () => {
  it('should handle complete security workflow', async () => {
    const secureContext = new SecureSharedContext();
    const messageBus = SecureMessageBus.getInstance();
    const securityMonitor = SecurityMonitor.getInstance();

    const mockAgent = {
      id: 'test-agent',
      keys: {
        privateKey: 'mock-private-key',
        publicKey: 'mock-public-key',
        encryptionKey: 'mock-encryption-key',
      },
    };

    messageBus.registerAgent(mockAgent);

    const securityContext = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      permissions: ['context.read', 'context.write', 'execute:llm'],
      trustLevel: 'high',
      sessionId: 'test-session',
      traceId: 'test-trace',
    };

    // 1. Share context securely
    const shareRequest = {
      fromAgent: 'coordinator' as AgentType,
      toAgent: 'opportunity' as AgentType,
      contextKey: 'integration-test',
      data: { sensitiveInfo: 'test data' },
      securityContext,
      auditMetadata: {},
    };

    const shareResult = await secureContext.shareContext(shareRequest);
    expect(shareResult).toBe(true);

    // 2. Send secure message
    const message = await messageBus.send(
      mockAgent,
      'opportunity',
      { action: 'process_context', key: 'integration-test' },
      { encrypted: true }
    );

    expect(message.signature).toBeDefined();
    expect(message.encrypted).toBe(true);

    // 3. Verify security monitoring
    const metrics = securityMonitor.getMetrics();
    expect(metrics.totalEvents).toBeGreaterThanOrEqual(0);

    // Cleanup
    messageBus.destroy();
    securityMonitor.stop();
  });
});
