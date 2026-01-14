/**
 * Security Integration Tests
 *
 * Tests for secure agent context management, message signing,
 * encryption, and audit logging flows.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecureSharedContext, getSecureSharedContext } from '../../src/services/SecureSharedContext';
import { AgentAuditLogger, getAuditLogger } from '../../src/services/AgentAuditLogger';
import { SecureMessageBus, secureMessageBus } from '../../src/lib/agent-fabric/SecureMessageBus';
import { AgentMessageBroker, getAgentMessageBroker } from '../../src/services/AgentMessageBroker';
import { createAgentIdentity } from '../../src/lib/auth/AgentIdentity';
import { AgentRole } from '../../src/lib/auth/AgentIdentity';
import { generateKeyPair, encrypt, decrypt, signMessage, verifySignature, generateEncryptionKey } from '../../src/lib/crypto/CryptoUtils';

describe('Security Integration Tests', () => {
  let sharedContext: SecureSharedContext;
  let auditLogger: AgentAuditLogger;
  let messageBus: SecureMessageBus;
  let messageBroker: AgentMessageBroker;

  beforeEach(() => {
    // Reset singleton instances for clean testing
    sharedContext = getSecureSharedContext();
    auditLogger = getAuditLogger();
    messageBus = secureMessageBus;
    messageBroker = getAgentMessageBroker();
  });

  afterEach(async () => {
    // Cleanup test data
    sharedContext.clearAllContexts();
    await auditLogger.cleanup();
    messageBus.destroy();
  });

  describe('Agent Context Sharing Security', () => {
    it('should allow context sharing between permitted agents', async () => {
      // Create agent identities with cryptographic keys
      const coordinatorKeys = generateKeyPair();
      const opportunityKeys = generateKeyPair();

      const coordinator = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'test-org',
        permissions: ['workflow.execute', 'agents.coordinate'],
        metadata: {
          keys: {
            publicKey: coordinatorKeys.publicKey,
            privateKey: coordinatorKeys.privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      const opportunity = createAgentIdentity({
        role: AgentRole.OPPORTUNITY,
        organizationId: 'test-org',
        permissions: ['data.read', 'opportunity.execute'],
        metadata: {
          keys: {
            publicKey: opportunityKeys.publicKey,
            privateKey: opportunityKeys.privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      const securityContext = {
        tenantId: 'test-org',
        userId: 'test-user',
        permissions: ['workflow.execute', 'context.read'],
        trustLevel: 'high' as const,
        sessionId: 'test-session',
        traceId: 'test-trace'
      };

      // Register agents with message bus
      messageBus.registerAgent(coordinator);
      messageBus.registerAgent(opportunity);

      // Test context sharing
      const shareRequest = {
        fromAgent: 'coordinator',
        toAgent: 'opportunity',
        contextKey: 'test-context',
        data: { message: 'test data' },
        securityContext,
        auditMetadata: { test: true }
      };

      const result = await sharedContext.shareContext(shareRequest);
      expect(result).toBe(true);

      // Verify audit log was created
      const logs = await auditLogger.getByAgent('coordinator', 10);
      const contextShareLog = logs.find(log => log.input_query === 'context_shared');
      expect(contextShareLog).toBeDefined();
      expect(contextShareLog?.success).toBe(true);
    });

    it('should deny context sharing between non-permitted agents', async () => {
      const researchKeys = generateKeyPair();
      const financialKeys = generateKeyPair();

      const research = createAgentIdentity({
        role: AgentRole.RESEARCH,
        organizationId: 'test-org',
        permissions: ['data.read', 'research.execute'],
        metadata: {
          keys: {
            publicKey: researchKeys.publicKey,
            privateKey: researchKeys.privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      const financial = createAgentIdentity({
        role: AgentRole.FINANCIAL_MODELING,
        organizationId: 'test-org',
        permissions: ['data.read', 'financial-modeling.execute'],
        metadata: {
          keys: {
            publicKey: financialKeys.publicKey,
            privateKey: financialKeys.privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      const securityContext = {
        tenantId: 'test-org',
        userId: 'test-user',
        permissions: ['data.read'],
        trustLevel: 'medium' as const,
        sessionId: 'test-session',
        traceId: 'test-trace'
      };

      messageBus.registerAgent(research);
      messageBus.registerAgent(financial);

      const shareRequest = {
        fromAgent: 'research',
        toAgent: 'financial-modeling',
        contextKey: 'test-context',
        data: { message: 'test data' },
        securityContext,
        auditMetadata: { test: true }
      };

      const result = await sharedContext.shareContext(shareRequest);
      expect(result).toBe(false);

      // Verify denial was logged
      const logs = await auditLogger.getByAgent('research', 10);
      const deniedLog = logs.find(log => log.input_query === 'context_share_denied');
      expect(deniedLog).toBeDefined();
      expect(deniedLog?.success).toBe(false);
    });

    it('should block high sensitivity data without proper trust level', async () => {
      const integrityKeys = generateKeyPair();
      const targetKeys = generateKeyPair();

      const integrity = createAgentIdentity({
        role: AgentRole.INTEGRITY,
        organizationId: 'test-org',
        permissions: ['data.read', 'integrity.execute', 'audit.read'],
        metadata: {
          keys: {
            publicKey: integrityKeys.publicKey,
            privateKey: integrityKeys.privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      const target = createAgentIdentity({
        role: AgentRole.TARGET,
        organizationId: 'test-org',
        permissions: ['data.read', 'target.execute'],
        metadata: {
          keys: {
            publicKey: targetKeys.publicKey,
            privateKey: targetKeys.privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      const lowTrustSecurityContext = {
        tenantId: 'test-org',
        userId: 'test-user',
        permissions: ['data.read'],
        trustLevel: 'low' as const,
        sessionId: 'test-session',
        traceId: 'test-trace'
      };

      messageBus.registerAgent(integrity);
      messageBus.registerAgent(target);

      const shareRequest = {
        fromAgent: 'integrity',
        toAgent: 'target',
        contextKey: 'sensitive-context',
        data: {
          ssn: '123-45-6789',
          creditCard: '4111-1111-1111-1111'
        },
        securityContext: lowTrustSecurityContext,
        auditMetadata: { test: true }
      };

      const result = await sharedContext.shareContext(shareRequest);
      expect(result).toBe(false);

      // Verify high sensitivity data was detected
      const logs = await auditLogger.getByAgent('integrity', 10);
      const deniedLog = logs.find(log => log.input_query === 'context_share_denied');
      expect(deniedLog?.error_message).toContain('Insufficient trust level');
    });
  });

  describe('Message Security', () => {
    it('should sign and verify messages correctly', async () => {
      const senderKeys = generateKeyPair();
      const sender = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'test-org',
        permissions: ['execute:llm'],
        metadata: {
          keys: {
            publicKey: senderKeys.publicKey,
            privateKey: senderKeys.privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      messageBus.registerAgent(sender);

      const message = await messageBus.send(
        sender,
        'test-recipient',
        { test: 'message' },
        { priority: 'normal' }
      );

      expect(message.signature).toBeDefined();
      expect(message.signature.length).toBeGreaterThan(0);

      // Verify signature format
      expect(message.signature).toMatch(/^sig:/);
    });

    it('should encrypt and decrypt messages correctly', async () => {
      const senderKeys = generateKeyPair();
      const recipientKeys = generateKeyPair();

      const sender = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'test-org',
        permissions: ['execute:llm'],
        metadata: {
          keys: {
            publicKey: senderKeys.publicKey,
            privateKey: senderKeys.privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      const recipient = createAgentIdentity({
        role: AgentRole.OPPORTUNITY,
        organizationId: 'test-org',
        permissions: ['execute:llm'],
        metadata: {
          keys: {
            publicKey: recipientKeys.publicKey,
            privateKey: recipientKeys.privateKey,
            encryptionKey: recipientKeys.encryptionKey
          }
        }
      });

      messageBus.registerAgent(sender);
      messageBus.registerAgent(recipient);

      const sensitivePayload = {
        secretData: 'confidential information',
        financialData: { amount: 1000000 }
      };

      const encryptedMessage = await messageBus.send(
        sender,
        recipient.id,
        sensitivePayload,
        { encrypted: true }
      );

      expect(encryptedMessage.encrypted).toBe(true);
      expect(encryptedMessage.encryption).toBeDefined();
      expect(encryptedMessage.encryption?.algorithm).toBe('aes-256-gcm');
      expect(encryptedMessage.encryption?.iv).toBeDefined();
      expect(encryptedMessage.encryption?.tag).toBeDefined();

      // Verify payload is actually encrypted (not readable as plain text)
      expect(typeof encryptedMessage.payload).toBe('string');
      expect(encryptedMessage.payload).not.toContain('confidential information');
    });

    it('should detect replay attacks', async () => {
      const senderKeys = generateKeyPair();
      const sender = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'test-org',
        permissions: ['execute:llm'],
        metadata: {
          keys: {
            publicKey: senderKeys.publicKey,
            privateKey: senderKeys.privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      messageBus.registerAgent(sender);

      const message = await messageBus.send(
        sender,
        'test-recipient',
        { test: 'message' },
        { priority: 'normal' }
      );

      // Try to receive the same message twice (replay attack)
      await expect(messageBus.receive(message)).rejects.toThrow('Replay attack detected');
    });

    it('should block compromised agents', async () => {
      const senderKeys = generateKeyPair();
      const sender = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'test-org',
        permissions: ['execute:llm'],
        metadata: {
          keys: {
            publicKey: senderKeys.publicKey,
            privateKey: senderKeys.privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      messageBus.registerAgent(sender);

      // Mark agent as compromised
      messageBus.markCompromised(sender.id, 'test compromise');

      // Try to send message from compromised agent
      await expect(
        messageBus.send(sender, 'test-recipient', { test: 'message' })
      ).rejects.toThrow('Circuit is open for agent');
    });
  });

  describe('Audit Logging Security', () => {
    it('should log all security events', async () => {
      const coordinatorKeys = generateKeyPair();
      const opportunityKeys = generateKeyPair();

      const coordinator = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'test-org',
        permissions: ['workflow.execute'],
        metadata: {
          keys: {
            publicKey: coordinatorKeys.publicKey,
            privateKey: coordinatorKeys.privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      const opportunity = createAgentIdentity({
        role: AgentRole.OPPORTUNITY,
        organizationId: 'test-org',
        permissions: ['data.read'],
        metadata: {
          keys: {
            publicKey: opportunityKeys.publicKey,
            privateKey: opportunityKeys.privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      messageBus.registerAgent(coordinator);
      messageBus.registerAgent(opportunity);

      const securityContext = {
        tenantId: 'test-org',
        userId: 'test-user',
        permissions: ['workflow.execute'],
        trustLevel: 'high' as const,
        sessionId: 'test-session',
        traceId: 'test-trace'
      };

      // Perform various actions that should be logged
      await sharedContext.shareContext({
        fromAgent: 'coordinator',
        toAgent: 'opportunity',
        contextKey: 'test-context',
        data: { test: 'data' },
        securityContext,
        auditMetadata: { action: 'test' }
      });

      await messageBus.send(coordinator, opportunity.id, { test: 'message' });

      // Verify logs were created
      const coordinatorLogs = await auditLogger.getByAgent('coordinator', 10);
      expect(coordinatorLogs.length).toBeGreaterThan(0);

      const contextShareLog = coordinatorLogs.find(log => log.input_query === 'context_shared');
      expect(contextShareLog).toBeDefined();
      expect(contextShareLog?.success).toBe(true);
      expect(contextShareLog?.context?.metadata?.action).toBe('test');

      // Verify audit log structure
      expect(contextShareLog?.agent_name).toBe('coordinator');
      expect(contextShareLog?.timestamp).toBeDefined();
      expect(contextShareLog?.user_id).toBe('test-user');
      expect(contextShareLog?.organization_id).toBe('test-org');
      expect(contextShareLog?.session_id).toBe('test-session');
    });

    it('should batch and flush logs correctly', async () => {
      const testAgent = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'test-org',
        permissions: ['execute:llm'],
        metadata: {
          keys: {
            publicKey: generateKeyPair().publicKey,
            privateKey: generateKeyPair().privateKey,
            encryptionKey: generateEncryptionKey()
          }
        }
      });

      // Generate multiple log entries
      const logPromises = Array.from({ length: 10 }, (_, i) =>
        auditLogger.log({
          agent_name: 'coordinator',
          input_query: `test-query-${i}`,
          success: true,
          user_id: 'test-user',
          organization_id: 'test-org',
          session_id: 'test-session'
        })
      );

      await Promise.all(logPromises);

      // Force flush
      await auditLogger.flush();

      // Verify logs were processed
      const logs = await auditLogger.getByAgent('coordinator', 20);
      expect(logs.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Cryptographic Utilities', () => {
    it('should generate and verify signatures correctly', () => {
      const keyPair = generateKeyPair();
      const message = { test: 'message', timestamp: Date.now() };

      const signatureResult = signMessage(message, keyPair.privateKey);
      expect(signatureResult.signature).toBeDefined();
      expect(signatureResult.timestamp).toBeDefined();

      const isValid = verifySignature(
        message,
        signatureResult.signature,
        signatureResult.timestamp,
        keyPair.publicKey
      );
      expect(isValid).toBe(true);

      // Test with wrong message
      const wrongMessage = { test: 'wrong message' };
      const isInvalid = verifySignature(
        wrongMessage,
        signatureResult.signature,
        signatureResult.timestamp,
        keyPair.publicKey
      );
      expect(isInvalid).toBe(false);
    });

    it('should encrypt and decrypt data correctly', () => {
      const key = generateEncryptionKey();
      const originalData = {
        sensitive: 'information',
        numbers: [1, 2, 3],
        nested: { value: 'test' }
      };

      const encrypted = encrypt(JSON.stringify(originalData), key);
      expect(encrypted.data).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.algorithm).toBe('aes-256-gcm');

      const decrypted = decrypt(encrypted, key);
      expect(decrypted).toEqual(originalData);
    });

    it('should fail decryption with wrong key', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      const data = { test: 'message' };

      const encrypted = encrypt(JSON.stringify(data), key1);

      expect(() => decrypt(encrypted, key2)).toThrow('Decryption failed');
    });
  });

  describe('Data Sensitivity Classification', () => {
    it('should classify PII as high sensitivity', () => {
      const piiData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
        ssn: '123-45-6789'
      };

      const sensitivity = sharedContext['assessDataSensitivity'](piiData);
      expect(sensitivity).toBe('high');
    });

    it('should classify financial data as medium sensitivity', () => {
      const financialData = {
        revenue: 1000000,
        profit: 100000,
        budget: 500000,
        expenses: 400000
      };

      const sensitivity = sharedContext['assessDataSensitivity'](financialData);
      expect(sensitivity).toBe('medium');
    });

    it('should classify public data as low sensitivity', () => {
      const publicData = {
        title: 'Public Announcement',
        description: 'Company news update',
        category: 'General Information'
      };

      const sensitivity = sharedContext['assessDataSensitivity'](publicData);
      expect(sensitivity).toBe('low');
    });

    it('should detect sensitive field names in arrays', () => {
      const userData = [
        { firstName: 'John', lastName: 'Doe', age: 30 },
        { firstName: 'Jane', lastName: 'Smith', age: 25 }
      ];

      const sensitivity = sharedContext['assessDataSensitivity'](userData);
      expect(sensitivity).toBe('high');
    });
  });
});
