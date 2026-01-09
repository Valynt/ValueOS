/**
 * Agent Token Service (VOS-SEC-001)
 * 
 * Manages the lifecycle of agent identity tokens including:
 * - Token creation and signing
 * - Token validation and refresh
 * - Token revocation
 * - Audit trail integration
 * 
 * @see /docs/PHASE4_PLUS_ENTERPRISE_TICKETS.md - VOS-SEC-001
 * @author Enterprise Agentic Architect
 * @version 1.0.0
 */

import { createLogger } from '../logger';
import {
  AgentIdentity,
  AgentRole,
  AgentTokenClaims,
  createAgentIdentity,
  CreateAgentIdentityOptions,
  fromTokenClaims,
  Permission,
  toTokenClaims,
  validateIdentity,
} from './AgentIdentity';

const logger = createLogger({ component: 'AgentTokenService' });

// ============================================================================
// Types
// ============================================================================

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  identity?: AgentIdentity;
  errors: string[];
  needsRefresh: boolean;
  expiresInSeconds?: number;
}

/**
 * Token refresh result
 */
export interface TokenRefreshResult {
  success: boolean;
  identity?: AgentIdentity;
  token?: string;
  error?: string;
}

/**
 * Active token registry entry
 */
interface TokenRegistryEntry {
  identity: AgentIdentity;
  token: string;
  createdAt: Date;
  lastAccessedAt: Date;
  refreshCount: number;
  revoked: boolean;
}

// ============================================================================
// Token Service
// ============================================================================

/**
 * Agent Token Service
 * Singleton service for managing agent identity tokens
 */
export class AgentTokenService {
  private static instance: AgentTokenService;
  
  /** In-memory token registry (production should use Redis/persistent store) */
  private tokenRegistry: Map<string, TokenRegistryEntry> = new Map();
  
  /** Revoked tokens (production should use Redis/persistent store) */
  private revokedTokens: Set<string> = new Set();
  
  /** Token refresh buffer time (5 minutes before expiry) */
  private readonly REFRESH_BUFFER_SECONDS = 300;
  
  /** Maximum refresh attempts per token */
  private readonly MAX_REFRESH_COUNT = 10;
  
  /** Cleanup interval (every 5 minutes) */
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    // Start cleanup interval
    this.startCleanupInterval();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): AgentTokenService {
    if (!AgentTokenService.instance) {
      AgentTokenService.instance = new AgentTokenService();
    }
    return AgentTokenService.instance;
  }
  
  /**
   * Issue a new agent token
   * 
   * @param options - Agent identity creation options
   * @returns The created agent identity and token
   */
  async issueToken(options: CreateAgentIdentityOptions): Promise<{
    identity: AgentIdentity;
    token: string;
  }> {
    const identity = createAgentIdentity(options);
    
    // Generate a simple token (production should use JWT/JWE)
    const token = this.generateToken(identity);
    
    // Register the token
    this.tokenRegistry.set(identity.id, {
      identity,
      token,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      refreshCount: 0,
      revoked: false,
    });
    
    logger.info('Agent token issued', {
      agentId: identity.id,
      role: identity.role,
      organizationId: identity.organizationId,
      expiresAt: identity.expiresAt,
      auditToken: identity.auditToken,
    });
    
    return { identity, token };
  }
  
  /**
   * Validate an agent token
   * 
   * @param token - The token to validate
   * @returns Validation result
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    const errors: string[] = [];
    
    // Check if token is revoked
    if (this.revokedTokens.has(token)) {
      return {
        valid: false,
        errors: ['Token has been revoked'],
        needsRefresh: false,
      };
    }
    
    // Find token in registry
    const entry = this.findTokenEntry(token);
    if (!entry) {
      return {
        valid: false,
        errors: ['Token not found'],
        needsRefresh: false,
      };
    }
    
    if (entry.revoked) {
      return {
        valid: false,
        errors: ['Token has been revoked'],
        needsRefresh: false,
      };
    }
    
    // Validate the identity
    const identityValidation = validateIdentity(entry.identity);
    if (!identityValidation.valid) {
      return {
        valid: false,
        errors: identityValidation.errors,
        needsRefresh: false,
      };
    }
    
    // Check expiration
    const now = new Date();
    const expiresAt = new Date(entry.identity.expiresAt);
    const expiresInSeconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    
    if (expiresInSeconds <= 0) {
      return {
        valid: false,
        identity: entry.identity,
        errors: ['Token has expired'],
        needsRefresh: true,
        expiresInSeconds: 0,
      };
    }
    
    const needsRefresh = expiresInSeconds <= this.REFRESH_BUFFER_SECONDS;
    
    // Update last accessed time
    entry.lastAccessedAt = new Date();
    
    logger.debug('Token validated', {
      agentId: entry.identity.id,
      expiresInSeconds,
      needsRefresh,
    });
    
    return {
      valid: true,
      identity: entry.identity,
      errors: [],
      needsRefresh,
      expiresInSeconds,
    };
  }
  
  /**
   * Refresh an agent token
   * 
   * @param token - The token to refresh
   * @param extendSeconds - Additional seconds to extend (default: original duration)
   * @returns Refresh result
   */
  async refreshToken(
    token: string,
    extendSeconds?: number
  ): Promise<TokenRefreshResult> {
    const entry = this.findTokenEntry(token);
    
    if (!entry) {
      return {
        success: false,
        error: 'Token not found',
      };
    }
    
    if (entry.revoked || this.revokedTokens.has(token)) {
      return {
        success: false,
        error: 'Token has been revoked',
      };
    }
    
    if (entry.refreshCount >= this.MAX_REFRESH_COUNT) {
      logger.warn('Max refresh count exceeded, revoking token', {
        agentId: entry.identity.id,
        refreshCount: entry.refreshCount,
      });
      await this.revokeToken(token);
      return {
        success: false,
        error: 'Maximum refresh count exceeded',
      };
    }
    
    // Calculate new expiration
    const originalDuration = 
      new Date(entry.identity.expiresAt).getTime() - 
      new Date(entry.identity.issuedAt).getTime();
    const newDuration = extendSeconds ? extendSeconds * 1000 : originalDuration;
    const newExpiresAt = new Date(Date.now() + newDuration);
    
    // Create refreshed identity
    const refreshedIdentity: AgentIdentity = {
      ...entry.identity,
      expiresAt: newExpiresAt.toISOString(),
    };
    
    // Generate new token
    const newToken = this.generateToken(refreshedIdentity);
    
    // Update registry
    entry.identity = refreshedIdentity;
    entry.token = newToken;
    entry.refreshCount++;
    entry.lastAccessedAt = new Date();
    
    // Revoke old token
    this.revokedTokens.add(token);
    
    logger.info('Agent token refreshed', {
      agentId: refreshedIdentity.id,
      refreshCount: entry.refreshCount,
      newExpiresAt: refreshedIdentity.expiresAt,
      auditToken: refreshedIdentity.auditToken,
    });
    
    return {
      success: true,
      identity: refreshedIdentity,
      token: newToken,
    };
  }
  
  /**
   * Revoke an agent token
   * 
   * @param token - The token to revoke
   * @param reason - Reason for revocation
   */
  async revokeToken(token: string, reason?: string): Promise<void> {
    const entry = this.findTokenEntry(token);
    
    if (entry) {
      entry.revoked = true;
      
      logger.warn('Agent token revoked', {
        agentId: entry.identity.id,
        reason: reason || 'No reason provided',
        auditToken: entry.identity.auditToken,
      });
    }
    
    this.revokedTokens.add(token);
  }
  
  /**
   * Revoke all tokens for an agent
   * 
   * @param agentId - The agent ID
   * @param reason - Reason for revocation
   */
  async revokeAllForAgent(agentId: string, reason?: string): Promise<number> {
    let revokedCount = 0;
    
    for (const [id, entry] of this.tokenRegistry.entries()) {
      if (entry.identity.id === agentId && !entry.revoked) {
        entry.revoked = true;
        this.revokedTokens.add(entry.token);
        revokedCount++;
      }
    }
    
    logger.warn('All tokens revoked for agent', {
      agentId,
      revokedCount,
      reason: reason || 'No reason provided',
    });
    
    return revokedCount;
  }
  
  /**
   * Get an agent identity by ID
   * 
   * @param agentId - The agent ID
   * @returns The agent identity if found and valid
   */
  getIdentity(agentId: string): AgentIdentity | undefined {
    const entry = this.tokenRegistry.get(agentId);
    if (entry && !entry.revoked) {
      const validation = validateIdentity(entry.identity);
      if (validation.valid) {
        return entry.identity;
      }
    }
    return undefined;
  }
  
  /**
   * List all active agents for an organization
   * 
   * @param organizationId - The organization ID
   * @returns List of active agent identities
   */
  listActiveAgents(organizationId: string): AgentIdentity[] {
    const agents: AgentIdentity[] = [];
    const now = new Date();
    
    for (const entry of this.tokenRegistry.values()) {
      if (
        entry.identity.organizationId === organizationId &&
        !entry.revoked &&
        new Date(entry.identity.expiresAt) > now
      ) {
        agents.push(entry.identity);
      }
    }
    
    return agents;
  }
  
  /**
   * Generate a token string for an identity
   * Production should use proper JWT signing
   */
  private generateToken(identity: AgentIdentity): string {
    const claims = toTokenClaims(identity);
    // Simple base64 encoding for development
    // Production should use JWT with proper signing (RS256/ES256)
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `vos.${payload}.${identity.auditToken.slice(-8)}`;
  }
  
  /**
   * Find a token entry by token string
   */
  private findTokenEntry(token: string): TokenRegistryEntry | undefined {
    for (const entry of this.tokenRegistry.values()) {
      if (entry.token === token) {
        return entry;
      }
    }
    return undefined;
  }
  
  /**
   * Start the cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }
  
  /**
   * Clean up expired and revoked tokens
   */
  private cleanup(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [id, entry] of this.tokenRegistry.entries()) {
      const expiresAt = new Date(entry.identity.expiresAt);
      
      // Remove tokens that are:
      // 1. Revoked and older than 1 hour
      // 2. Expired and older than 24 hours
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      if (
        (entry.revoked && entry.lastAccessedAt < hourAgo) ||
        (expiresAt < dayAgo)
      ) {
        this.tokenRegistry.delete(id);
        cleanedCount++;
      }
    }
    
    // Clean up old revoked tokens (keep for 1 hour)
    // In production, this should be persistent storage
    
    if (cleanedCount > 0) {
      logger.debug('Token cleanup completed', { cleanedCount });
    }
  }
  
  /**
   * Destroy the service (cleanup)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.tokenRegistry.clear();
    this.revokedTokens.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an agent identity for a specific role
 * Convenience factory for common use cases
 */
export function createAgentForRole(
  role: AgentRole,
  organizationId: string,
  options?: Partial<CreateAgentIdentityOptions>
): Promise<{ identity: AgentIdentity; token: string }> {
  const service = AgentTokenService.getInstance();
  return service.issueToken({
    role,
    organizationId,
    ...options,
  });
}

/**
 * Create a Coordinator agent identity
 */
export function createCoordinatorAgent(
  organizationId: string,
  parentSessionId?: string,
  initiatingUserId?: string
): Promise<{ identity: AgentIdentity; token: string }> {
  return createAgentForRole(AgentRole.COORDINATOR, organizationId, {
    parentSessionId,
    initiatingUserId,
    expirationSeconds: 7200, // 2 hours for orchestration
  });
}

/**
 * Create a Target agent identity
 */
export function createTargetAgent(
  organizationId: string,
  parentSessionId?: string
): Promise<{ identity: AgentIdentity; token: string }> {
  return createAgentForRole(AgentRole.TARGET, organizationId, {
    parentSessionId,
    expirationSeconds: 3600,
  });
}

/**
 * Create an Integrity agent identity
 */
export function createIntegrityAgent(
  organizationId: string
): Promise<{ identity: AgentIdentity; token: string }> {
  return createAgentForRole(AgentRole.INTEGRITY, organizationId, {
    expirationSeconds: 86400, // 24 hours for governance
  });
}

// ============================================================================
// Exports
// ============================================================================

export const agentTokenService = AgentTokenService.getInstance();

export default {
  AgentTokenService,
  agentTokenService,
  createAgentForRole,
  createCoordinatorAgent,
  createTargetAgent,
  createIntegrityAgent,
};
