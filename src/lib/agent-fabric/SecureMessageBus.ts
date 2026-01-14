/**
 * Secure Message Bus (VOS-SEC-004)
 *
 * Implements secure inter-agent communication with:
 * - Message signing for authenticity
 * - Encryption for sensitive payloads
 * - Replay protection (nonce + timestamp)
 * - Circuit breaker for compromised agents
 *
 * @see /docs/PHASE4_PLUS_ENTERPRISE_TICKETS.md - VOS-SEC-004
 * @author Enterprise Agentic Architect
 * @version 1.0.0
 */

import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../logger";
import {
  AgentIdentity,
  hasPermission,
  Permission,
} from "../auth/AgentIdentity";
import {
  signMessageEd25519,
  verifySignatureEd25519,
  encrypt,
  decrypt,
  generateNonce,
  isEncrypted,
  generateEncryptionKey,
  constantTimeCompareBuffers,
} from "../crypto/CryptoUtils";
import { getKMS, KMSConfig } from "../crypto/KeyManagementService";

const logger = createLogger({ component: "SecureMessageBus" });

// ============================================================================
// Types
// ============================================================================

/**
 * Message priority levels
 */
export type MessagePriority = "low" | "normal" | "high" | "critical";

/**
 * Message delivery status
 */
export type DeliveryStatus =
  | "pending"
  | "delivered"
  | "acknowledged"
  | "failed"
  | "expired";

/**
 * Secure message envelope
 */
export interface SecureMessage<T = unknown> {
  /** Unique message ID */
  id: string;
  /** Message version */
  version: string;
  /** Sender agent ID */
  from: string;
  /** Recipient agent ID or 'broadcast' */
  to: string;
  /** Creation timestamp */
  timestamp: string;
  /** Unique nonce for replay protection */
  nonce: string;
  /** Message payload */
  payload: T;
  /** Message priority */
  priority: MessagePriority;
  /** Ed25519 signature of the message */
  signature: string;
  /** Whether payload is encrypted */
  encrypted: boolean;
  /** Encryption metadata if encrypted */
  encryption?: {
    algorithm: string;
    keyId: string;
    iv: string;
    tag?: string;
  };
  /** Time-to-live in seconds */
  ttlSeconds: number;
  /** Correlation ID for request-response patterns */
  correlationId?: string;
  /** Reply-to address for responses */
  replyTo?: string;
}

/**
 * Message handler function type
 */
export type MessageHandler<T = unknown> = (
  message: SecureMessage<T>,
  sender: AgentIdentity
) => Promise<void>;

/**
 * Message subscription
 */
interface MessageSubscription {
  agentId: string;
  handler: MessageHandler;
  patterns: string[];
  createdAt: Date;
}

/**
 * Agent security status
 */
interface AgentSecurityStatus {
  agentId: string;
  isCompromised: boolean;
  lastIncident?: Date;
  incidentCount: number;
  circuitOpen: boolean;
  circuitOpenedAt?: Date;
}

/**
 * Rate limiter interface
 */
interface RateLimiter {
  lastSent: number;
  messageCount: number;
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenRequests: number;
}

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  maxMessagesPerSecond: number;
  maxMessagesPerMinute: number;
  windowSizeMs: number;
}

// ============================================================================
// Secure Message Bus
// ============================================================================

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenRequests: 3,
};

/**
 * Default rate limiting configuration
 */
const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxMessagesPerSecond: 10,
  maxMessagesPerMinute: 100,
  windowSizeMs: 60000, // 1 minute
};

/**
 * Seen nonces for replay protection (with TTL)
 */
interface NonceEntry {
  nonce: string;
  timestamp: Date;
  expiresAt: Date;
}

/**
 * Secure Message Bus
 * Handles secure inter-agent communication
 */
export class SecureMessageBus {
  private static instance: SecureMessageBus;

  /** Registered agent identities */
  private registeredAgents: Map<string, AgentIdentity> = new Map();

  /** Message subscriptions */
  private subscriptions: Map<string, MessageSubscription> = new Map();

  /** Pending messages */
  private pendingMessages: Map<string, SecureMessage> = new Map();

  /** Agent security status */
  private agentSecurityStatus: Map<string, AgentSecurityStatus> = new Map();

  /** Seen nonces for replay protection */
  private seenNonces: Map<string, NonceEntry> = new Map();

  /** Circuit breaker configuration */
  private circuitConfig: CircuitBreakerConfig;

  /** Rate limiting configuration */
  private rateLimitConfig: RateLimitConfig;

  /** Rate limiters per agent */
  private rateLimiters: Map<string, RateLimiter> = new Map();

  /** Nonce cleanup interval */
  private nonceCleanupInterval: NodeJS.Timeout | null = null;

  /** Rate limit cleanup interval */
  private rateLimitCleanupInterval: NodeJS.Timeout | null = null;

  /** KMS service for key management */
  private kms: ReturnType<typeof getKMS>;

  /** Message version */
  private readonly MESSAGE_VERSION = "2.0.0";

  /** Default TTL in seconds */
  private readonly DEFAULT_TTL_SECONDS = 300; // 5 minutes

  private constructor(
    circuitConfig: Partial<CircuitBreakerConfig> = {},
    rateLimitConfig: Partial<RateLimitConfig> = {},
    kmsConfig?: KMSConfig
  ) {
    this.circuitConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...circuitConfig };
    this.rateLimitConfig = { ...DEFAULT_RATE_LIMIT_CONFIG, ...rateLimitConfig };

    // Initialize KMS with fallback to local provider
    const defaultKmsConfig: KMSConfig = {
      provider: "local",
      region: "us-east-1",
    };
    this.kms = getKMS(kmsConfig || defaultKmsConfig);

    this.startNonceCleanup();
    this.startRateLimitCleanup();
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    circuitConfig?: Partial<CircuitBreakerConfig>,
    rateLimitConfig?: Partial<RateLimitConfig>,
    kmsConfig?: KMSConfig
  ): SecureMessageBus {
    if (!SecureMessageBus.instance) {
      SecureMessageBus.instance = new SecureMessageBus(
        circuitConfig,
        rateLimitConfig,
        kmsConfig
      );
    }
    return SecureMessageBus.instance;
  }

  /**
   * Register an agent with the message bus
   */
  registerAgent(identity: AgentIdentity): void {
    this.registeredAgents.set(identity.id, identity);
    this.agentSecurityStatus.set(identity.id, {
      agentId: identity.id,
      isCompromised: false,
      incidentCount: 0,
      circuitOpen: false,
    });
    logger.info("Agent registered with message bus", { agentId: identity.id });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this.registeredAgents.delete(agentId);
    this.subscriptions.delete(agentId);
    this.agentSecurityStatus.delete(agentId);
    logger.info("Agent unregistered from message bus", { agentId });
  }

  /**
   * Subscribe to messages
   */
  subscribe(
    agentId: string,
    handler: MessageHandler,
    patterns: string[] = ["*"]
  ): void {
    if (!this.registeredAgents.has(agentId)) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    this.subscriptions.set(agentId, {
      agentId,
      handler,
      patterns,
      createdAt: new Date(),
    });

    logger.debug("Agent subscribed to messages", { agentId, patterns });
  }

  /**
   * Check if agent is rate limited
   */
  private checkRateLimit(agentId: string): boolean {
    const now = Date.now();
    const limiter = this.rateLimiters.get(agentId);

    if (!limiter) {
      // Initialize rate limiter for new agent
      this.rateLimiters.set(agentId, {
        lastSent: now,
        messageCount: 1,
      });
      return true;
    }

    // Check if we're in a new window
    if (now - limiter.lastSent > this.rateLimitConfig.windowSizeMs) {
      // Reset window
      limiter.lastSent = now;
      limiter.messageCount = 1;
      return true;
    }

    // Check per-second limit
    const timeSinceLastMessage = now - limiter.lastSent;
    if (
      timeSinceLastMessage < 1000 &&
      limiter.messageCount >= this.rateLimitConfig.maxMessagesPerSecond
    ) {
      return false;
    }

    // Check per-minute limit
    if (limiter.messageCount >= this.rateLimitConfig.maxMessagesPerMinute) {
      return false;
    }

    // Update counters
    limiter.messageCount++;
    limiter.lastSent = now;
    return true;
  }

  /**
   * Start rate limit cleanup interval
   */
  private startRateLimitCleanup(): void {
    this.rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      const cutoffTime = now - this.rateLimitConfig.windowSizeMs * 2; // Keep 2 windows of data

      for (const [agentId, limiter] of this.rateLimiters.entries()) {
        if (limiter.lastSent < cutoffTime) {
          this.rateLimiters.delete(agentId);
        }
      }
    }, 300000); // Cleanup every 5 minutes
  }

  /**
   * Send a secure message
   */
  async send<T>(
    sender: AgentIdentity,
    to: string,
    payload: T,
    options: {
      priority?: MessagePriority;
      ttlSeconds?: number;
      encrypted?: boolean;
      correlationId?: string;
      replyTo?: string;
    } = {}
  ): Promise<SecureMessage<T>> {
    // Verify sender is registered
    if (!this.registeredAgents.has(sender.id)) {
      throw new Error(`Sender ${sender.id} is not registered`);
    }

    // Check rate limiting
    if (!this.checkRateLimit(sender.id)) {
      throw new Error(`Rate limit exceeded for agent ${sender.id}`);
    }

    // Check circuit breaker for sender
    if (this.isCircuitOpen(sender.id)) {
      throw new Error(`Circuit is open for agent ${sender.id}`);
    }

    // Verify sender has permission to execute LLM/communicate
    if (!hasPermission(sender, "execute:llm")) {
      logger.warn("Agent lacks permission to send messages", {
        agentId: sender.id,
      });
    }

    // Create the message
    const message: SecureMessage<T> = {
      id: uuidv4(),
      version: this.MESSAGE_VERSION,
      from: sender.id,
      to,
      timestamp: new Date().toISOString(),
      nonce: this.generateNonce(),
      payload,
      priority: options.priority || "normal",
      signature: "", // Will be set by signMessage
      encrypted: options.encrypted || false,
      ttlSeconds: options.ttlSeconds || this.DEFAULT_TTL_SECONDS,
      correlationId: options.correlationId,
      replyTo: options.replyTo,
    };

    // Sign the message
    message.signature = await this.signMessage(message, sender);

    // Encrypt if requested
    if (message.encrypted) {
      // Get recipient's encryption key
      const recipient = this.registeredAgents.get(to);
      if (!recipient?.keys?.encryptionKey) {
        throw new Error(`Recipient ${to} has no encryption key`);
      }

      // Encrypt the payload
      const encryptedPayload = this.encryptPayload(
        message.payload,
        recipient.keys.encryptionKey
      );
      message.payload = encryptedPayload.data as T;
      message.encryption = {
        algorithm: encryptedPayload.algorithm,
        keyId: `key:${to}`,
        iv: encryptedPayload.iv,
        tag: encryptedPayload.tag,
      };
    }

    // Store for delivery
    this.pendingMessages.set(message.id, message as SecureMessage);

    // Deliver the message
    await this.deliverMessage(message);

    logger.debug("Secure message sent", {
      messageId: message.id,
      from: sender.id,
      to,
      priority: message.priority,
    });

    return message;
  }

  /**
   * Broadcast a message to all agents
   */
  async broadcast<T>(
    sender: AgentIdentity,
    payload: T,
    options: {
      priority?: MessagePriority;
      pattern?: string;
    } = {}
  ): Promise<SecureMessage<T>> {
    return this.send(sender, "broadcast", payload, {
      ...options,
      encrypted: false, // Broadcasts are not encrypted
    });
  }

  /**
   * Receive and validate a message
   */
  async receive<T>(message: SecureMessage<T>): Promise<T> {
    // Check if message has expired
    const messageTime = new Date(message.timestamp);
    const expiresAt = new Date(
      messageTime.getTime() + message.ttlSeconds * 1000
    );
    if (new Date() > expiresAt) {
      throw new Error("Message has expired");
    }

    // Check for replay attack
    if (await this.isReplay(message.nonce)) {
      this.recordSecurityIncident(message.from, "replay_attack");
      throw new Error("Replay attack detected");
    }

    // Get sender identity
    const sender = this.registeredAgents.get(message.from);
    if (!sender) {
      throw new Error(`Unknown sender: ${message.from}`);
    }

    // Verify signature
    const isValid = await this.verifySignature(message, sender);
    if (!isValid) {
      this.recordSecurityIncident(message.from, "invalid_signature");
      throw new Error("Invalid message signature");
    }

    // Record nonce
    this.recordNonce(message.nonce, message.ttlSeconds);

    // Decrypt if encrypted
    let payload = message.payload;
    if (message.encrypted && message.encryption) {
      // Get recipient (this agent) for decryption key
      const recipientId =
        message.to === "broadcast" ? message.from : message.to;
      const recipient = this.registeredAgents.get(recipientId);

      if (!recipient?.keys?.encryptionKey) {
        throw new Error(
          `Recipient ${recipientId} has no encryption key for decryption`
        );
      }

      // Decrypt the payload
      const encryptedData = {
        data: message.payload as string,
        iv: message.encryption.iv,
        tag: message.encryption.tag || "",
        algorithm: message.encryption.algorithm,
      };

      payload = this.decryptPayload(
        encryptedData,
        recipient.keys.encryptionKey
      );
    }

    logger.debug("Secure message received", {
      messageId: message.id,
      from: message.from,
      to: message.to,
    });

    return payload;
  }

  /**
   * Mark an agent as compromised
   */
  markCompromised(agentId: string, reason: string): void {
    const status = this.agentSecurityStatus.get(agentId);
    if (status) {
      status.isCompromised = true;
      status.lastIncident = new Date();
      status.circuitOpen = true;
      status.circuitOpenedAt = new Date();
    }

    logger.error("Agent marked as compromised", { agentId, reason });

    // Unsubscribe the compromised agent
    this.subscriptions.delete(agentId);
  }

  /**
   * Reset agent security status
   */
  resetSecurityStatus(agentId: string): void {
    const status = this.agentSecurityStatus.get(agentId);
    if (status) {
      status.isCompromised = false;
      status.incidentCount = 0;
      status.circuitOpen = false;
      status.circuitOpenedAt = undefined;
    }
    logger.info("Agent security status reset", { agentId });
  }

  /**
   * Get message delivery status
   */
  getDeliveryStatus(messageId: string): DeliveryStatus {
    const message = this.pendingMessages.get(messageId);
    if (!message) {
      return "failed";
    }

    const messageTime = new Date(message.timestamp);
    const expiresAt = new Date(
      messageTime.getTime() + message.ttlSeconds * 1000
    );
    if (new Date() > expiresAt) {
      return "expired";
    }

    return "pending";
  }

  /**
   * Get registered agent count
   */
  getRegisteredAgentCount(): number {
    return this.registeredAgents.size;
  }

  /**
   * Get pending message count
   */
  getPendingMessageCount(): number {
    return this.pendingMessages.size;
  }

  /**
   * Check if circuit is open for an agent
   */
  private isCircuitOpen(agentId: string): boolean {
    const status = this.agentSecurityStatus.get(agentId);
    if (!status) return false;

    if (status.circuitOpen && status.circuitOpenedAt) {
      const elapsed = Date.now() - status.circuitOpenedAt.getTime();
      if (elapsed > this.circuitConfig.resetTimeoutMs) {
        // Half-open: allow some requests through
        status.circuitOpen = false;
      }
    }

    return status.circuitOpen || status.isCompromised;
  }

  /**
   * Record a security incident
   */
  private recordSecurityIncident(
    agentId: string,
    incidentType: "replay_attack" | "invalid_signature" | "unauthorized"
  ): void {
    const status = this.agentSecurityStatus.get(agentId);
    if (!status) return;

    status.incidentCount++;
    status.lastIncident = new Date();

    if (status.incidentCount >= this.circuitConfig.failureThreshold) {
      status.circuitOpen = true;
      status.circuitOpenedAt = new Date();
      logger.warn("Circuit opened for agent due to security incidents", {
        agentId,
        incidentCount: status.incidentCount,
        lastIncident: incidentType,
      });
    }
  }

  /**
   * Sign a message with Ed25519 for proper non-repudiation
   */
  private async signMessage<T>(
    message: SecureMessage<T>,
    sender: AgentIdentity
  ): Promise<string> {
    try {
      // Prefer KMS-managed keys, fallback to local keys
      let signature: Buffer;

      if (sender.keys?.keyId && this.kms) {
        // Use KMS for signing
        const content = {
          id: message.id,
          from: message.from,
          to: message.to,
          timestamp: message.timestamp,
          nonce: message.nonce,
          payload: message.payload,
        };

        signature = await this.kms.sign(
          sender.keys.keyId,
          JSON.stringify(content)
        );
      } else if (sender.keys?.privateKey) {
        // Use local Ed25519 signing
        const content = {
          id: message.id,
          from: message.from,
          to: message.to,
          timestamp: message.timestamp,
          nonce: message.nonce,
          payload: message.payload,
        };

        const result = signMessageEd25519(content, sender.keys.privateKey);
        signature = Buffer.from(result.signature, "base64");
      } else {
        throw new Error(`Agent ${sender.id} has no signing key available`);
      }

      return signature.toString("base64");
    } catch (error) {
      logger.error(
        "Message signing failed",
        error instanceof Error ? error : undefined,
        {
          messageId: message.id,
          senderId: sender.id,
        }
      );

      // Don't expose cryptographic errors to caller
      throw new Error("Failed to sign message");
    }
  }

  /**
   * Verify Ed25519 message signature with constant-time comparison
   */
  private async verifySignature<T>(
    message: SecureMessage<T>,
    sender: AgentIdentity
  ): Promise<boolean> {
    try {
      // Prefer KMS-managed keys, fallback to local keys
      let isValid: boolean;

      if (sender.keys?.keyId && this.kms) {
        // Use KMS for verification
        const content = {
          id: message.id,
          from: message.from,
          to: message.to,
          timestamp: message.timestamp,
          nonce: message.nonce,
          payload: message.payload,
        };

        const signature = Buffer.from(message.signature, "base64");
        isValid = await this.kms.verify(
          sender.keys.keyId,
          JSON.stringify(content),
          signature
        );
      } else if (sender.keys?.publicKey) {
        // Use local Ed25519 verification
        const content = {
          id: message.id,
          from: message.from,
          to: message.to,
          timestamp: message.timestamp,
          nonce: message.nonce,
          payload: message.payload,
        };

        // Extract timestamp from signature if available
        const signatureTimestamp = 0; // In production, extract from signature metadata

        isValid = verifySignatureEd25519(
          content,
          message.signature,
          signatureTimestamp,
          sender.keys.publicKey
        );
      } else {
        logger.warn(`Agent ${sender.id} has no public key for verification`);
        return false;
      }

      return isValid;
    } catch (error) {
      logger.error(
        "Failed to verify signature",
        error instanceof Error ? error : undefined,
        {
          messageId: message.id,
          senderId: sender.id,
        }
      );
      return false;
    }
  }

  /**
   * Encrypt payload with proper error handling
   */
  private encryptPayload<T>(
    payload: T,
    recipientKey: string
  ): {
    data: string;
    algorithm: string;
    iv: string;
    tag?: string;
  } {
    try {
      if (!recipientKey) {
        throw new Error("Recipient encryption key is required");
      }

      const encryptedPayload = encrypt(JSON.stringify(payload), recipientKey);

      if (
        !encryptedPayload.data ||
        !encryptedPayload.iv ||
        !encryptedPayload.algorithm
      ) {
        throw new Error("Encryption produced invalid result");
      }

      return {
        data: encryptedPayload.data,
        algorithm: encryptedPayload.algorithm,
        iv: encryptedPayload.iv,
        tag: encryptedPayload.tag,
      };
    } catch (error) {
      logger.error(
        "Payload encryption failed",
        error instanceof Error ? error : undefined
      );
      throw new Error("Failed to encrypt payload");
    }
  }

  /**
   * Decrypt payload with proper error handling
   */
  private decryptPayload(
    encryptedData: {
      data: string;
      iv: string;
      tag?: string;
      algorithm: string;
    },
    recipientKey: string
  ): any {
    try {
      if (!recipientKey) {
        throw new Error("Recipient decryption key is required");
      }

      const decryptedPayload = decrypt(encryptedData, recipientKey);

      if (!decryptedPayload) {
        throw new Error("Decryption returned empty result");
      }

      return typeof decryptedPayload === "string"
        ? JSON.parse(decryptedPayload)
        : decryptedPayload;
    } catch (error) {
      logger.error(
        "Payload decryption failed",
        error instanceof Error ? error : undefined
      );
      throw new Error("Failed to decrypt payload");
    }
  }

  /**
   * Generate a unique nonce
   */
  private generateNonce(): string {
    return `${Date.now()}:${uuidv4()}`;
  }

  /**
   * Check if nonce has been seen (replay attack)
   */
  private async isReplay(nonce: string): Promise<boolean> {
    return this.seenNonces.has(nonce);
  }

  /**
   * Record a nonce
   */
  private recordNonce(nonce: string, ttlSeconds: number): void {
    const now = new Date();
    this.seenNonces.set(nonce, {
      nonce,
      timestamp: now,
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
    });
  }

  /**
   * Deliver a message to recipient(s)
   */
  private async deliverMessage<T>(message: SecureMessage<T>): Promise<void> {
    const sender = this.registeredAgents.get(message.from);
    if (!sender) return;

    if (message.to === "broadcast") {
      // Deliver to all subscribers
      for (const [agentId, subscription] of this.subscriptions) {
        if (agentId !== message.from) {
          try {
            await subscription.handler(message as SecureMessage, sender);
          } catch (error) {
            logger.error("Error delivering broadcast message", {
              messageId: message.id,
              recipientId: agentId,
              error,
            });
          }
        }
      }
    } else {
      // Deliver to specific recipient
      const subscription = this.subscriptions.get(message.to);
      if (subscription) {
        try {
          await subscription.handler(message as SecureMessage, sender);
        } catch (error) {
          logger.error("Error delivering message", {
            messageId: message.id,
            recipientId: message.to,
            error,
          });
        }
      }
    }
  }

  /**
   * Start nonce cleanup with adaptive intervals
   */
  private startNonceCleanup(): void {
    // Start the adaptive cleanup process
    this.scheduleAdaptiveCleanup();
  }

  /**
   * Schedule next cleanup with adaptive interval based on nonce traffic
   */
  private scheduleAdaptiveCleanup(): void {
    // Clear any existing interval
    if (this.nonceCleanupInterval) {
      clearTimeout(this.nonceCleanupInterval);
    }

    // Determine cleanup interval based on nonce traffic
    const nonceCount = this.seenNonces.size;
    let intervalMs: number;

    if (nonceCount > 1000) {
      intervalMs = 30000; // High traffic: cleanup every 30 seconds
    } else if (nonceCount > 500) {
      intervalMs = 60000; // Medium traffic: cleanup every minute
    } else if (nonceCount > 100) {
      intervalMs = 120000; // Low traffic: cleanup every 2 minutes
    } else {
      intervalMs = 300000; // Very low traffic: cleanup every 5 minutes
    }

    this.nonceCleanupInterval = setTimeout(() => {
      this.performNonceCleanup();
    }, intervalMs);

    logger.debug("Scheduled adaptive nonce cleanup", {
      nonceCount,
      nextCleanupMs: intervalMs,
    });
  }

  /**
   * Perform nonce cleanup and reschedule
   */
  private performNonceCleanup(): void {
    const now = new Date();
    const beforeCount = this.seenNonces.size;
    let removedCount = 0;

    for (const [nonce, entry] of this.seenNonces) {
      if (entry.expiresAt < now) {
        this.seenNonces.delete(nonce);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug("Nonce cleanup completed", {
        removedCount,
        remainingCount: this.seenNonces.size,
        beforeCount,
      });
    }

    // Schedule next cleanup adaptively
    this.scheduleAdaptiveCleanup();
  }

  /**
   * Destroy the message bus
   */
  destroy(): void {
    if (this.nonceCleanupInterval) {
      clearInterval(this.nonceCleanupInterval);
      this.nonceCleanupInterval = null;
    }
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = null;
    }
    this.registeredAgents.clear();
    this.subscriptions.clear();
    this.pendingMessages.clear();
    this.agentSecurityStatus.clear();
    this.seenNonces.clear();
    this.rateLimiters.clear();
  }
}

// ============================================================================
// Exports
// ============================================================================

export const secureMessageBus = SecureMessageBus.getInstance();

export default {
  SecureMessageBus,
  secureMessageBus,
};
