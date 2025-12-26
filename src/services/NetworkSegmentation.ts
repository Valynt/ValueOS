/**
 * Network Segmentation Manager
 * Implements network-level segmentation and access controls for AI agents
 */

import { createLogger } from '../logger';
import { clientRateLimit } from '../services/ClientRateLimit';

const logger = createLogger({ component: 'NetworkSegmentation' });

export interface NetworkPolicy {
  id: string;
  name: string;
  description: string;
  agentTypes: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  allowedPorts: number[];
  maxRequestsPerMinute: number;
  maxConcurrentConnections: number;
  timeoutMs: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
  encryptionRequired: boolean;
}

export interface NetworkRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  agentType: string;
  agentId: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface NetworkResponse {
  status: number;
  headers: Record<string, string>;
  data: any;
  duration: number;
  encrypted: boolean;
}

export class NetworkSegmentationManager {
  private static instance: NetworkSegmentationManager;
  private policies: Map<string, NetworkPolicy> = new Map();
  private activeConnections: Map<string, number> = new Map();
  private connectionPool: Map<string, any[]> = new Map();

  private constructor() {
    this.initializeDefaultPolicies();
  }

  static getInstance(): NetworkSegmentationManager {
    if (!NetworkSegmentationManager.instance) {
      NetworkSegmentationManager.instance = new NetworkSegmentationManager();
    }
    return NetworkSegmentationManager.instance;
  }

  /**
   * Initialize default network policies for different agent types
   */
  private initializeDefaultPolicies(): void {
    // LLM Agent Policy - Restrictive external API access
    this.addPolicy({
      id: 'llm-agent-policy',
      name: 'LLM Agent Network Policy',
      description: 'Restrictive policy for LLM API communications',
      agentTypes: ['llm-agent', 'chat-agent', 'completion-agent'],
      allowedDomains: [
        'api.openai.com',
        'api.anthropic.com',
        'api.together.xyz',
        'api.replicate.com',
        '*.supabase.co',
        'localhost',
        '127.0.0.1'
      ],
      blockedDomains: [
        '*.malicious.com',
        '*.phishing.com',
        'internal.*',
        '*.local'
      ],
      allowedPorts: [80, 443, 3000, 8000, 5432],
      maxRequestsPerMinute: 50,
      maxConcurrentConnections: 5,
      timeoutMs: 30000,
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000
      },
      encryptionRequired: true
    });

    // Data Processing Agent Policy - Database and storage access
    this.addPolicy({
      id: 'data-agent-policy',
      name: 'Data Processing Agent Network Policy',
      description: 'Policy for data processing and storage operations',
      agentTypes: ['data-agent', 'processing-agent', 'storage-agent'],
      allowedDomains: [
        '*.supabase.co',
        '*.vercel-storage.com',
        '*.s3.amazonaws.com',
        'localhost',
        '127.0.0.1'
      ],
      blockedDomains: [
        '*.external-api.com',
        '*.social-media.com',
        '*.advertising.com'
      ],
      allowedPorts: [80, 443, 5432, 6379],
      maxRequestsPerMinute: 100,
      maxConcurrentConnections: 10,
      timeoutMs: 60000,
      retryPolicy: {
        maxRetries: 5,
        backoffMs: 2000
      },
      encryptionRequired: true
    });

    // Workflow Agent Policy - Internal orchestration
    this.addPolicy({
      id: 'workflow-agent-policy',
      name: 'Workflow Agent Network Policy',
      description: 'Policy for workflow orchestration and internal communications',
      agentTypes: ['workflow-agent', 'orchestrator-agent', 'scheduler-agent'],
      allowedDomains: [
        '*.supabase.co',
        'localhost',
        '127.0.0.1',
        '*.internal'
      ],
      blockedDomains: [
        '*.external.com',
        '*.internet.com',
        '*.public-api.com'
      ],
      allowedPorts: [80, 443, 3000, 8000, 5432, 6379],
      maxRequestsPerMinute: 200,
      maxConcurrentConnections: 20,
      timeoutMs: 45000,
      retryPolicy: {
        maxRetries: 2,
        backoffMs: 500
      },
      encryptionRequired: true
    });

    // Restricted Agent Policy - Highly secure operations
    this.addPolicy({
      id: 'restricted-agent-policy',
      name: 'Restricted Agent Network Policy',
      description: 'Highly restrictive policy for sensitive operations',
      agentTypes: ['security-agent', 'audit-agent', 'compliance-agent'],
      allowedDomains: [
        '*.supabase.co',
        'localhost',
        '127.0.0.1'
      ],
      blockedDomains: [
        '*',  // Block everything except explicitly allowed
      ],
      allowedPorts: [443, 5432],
      maxRequestsPerMinute: 10,
      maxConcurrentConnections: 2,
      timeoutMs: 15000,
      retryPolicy: {
        maxRetries: 1,
        backoffMs: 1000
      },
      encryptionRequired: true
    });

    logger.info('Default network policies initialized');
  }

  /**
   * Add a network policy
   */
  addPolicy(policy: NetworkPolicy): void {
    this.policies.set(policy.id, policy);
    logger.info('Network policy added', { policyId: policy.id, name: policy.name });
  }

  /**
   * Get policy for agent type
   */
  getPolicyForAgent(agentType: string): NetworkPolicy | null {
    for (const policy of this.policies.values()) {
      if (policy.agentTypes.includes(agentType)) {
        return policy;
      }
    }
    return null;
  }

  /**
   * Validate network request against policy
   */
  validateRequest(request: NetworkRequest): { allowed: boolean; reason?: string; policy?: NetworkPolicy } {
    const policy = this.getPolicyForAgent(request.agentType);

    if (!policy) {
      return {
        allowed: false,
        reason: `No network policy found for agent type: ${request.agentType}`
      };
    }

    // Check domain access
    const url = new URL(request.url);
    const domainAllowed = this.isDomainAllowed(url.hostname, policy);
    const portAllowed = policy.allowedPorts.includes(url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80));

    if (!domainAllowed) {
      return {
        allowed: false,
        reason: `Domain ${url.hostname} not allowed by policy ${policy.name}`,
        policy
      };
    }

    if (!portAllowed) {
      return {
        allowed: false,
        reason: `Port ${url.port || (url.protocol === 'https:' ? 443 : 80)} not allowed by policy ${policy.name}`,
        policy
      };
    }

    // Check encryption requirement
    if (policy.encryptionRequired && url.protocol !== 'https:') {
      return {
        allowed: false,
        reason: `HTTPS encryption required by policy ${policy.name}`,
        policy
      };
    }

    return { allowed: true, policy };
  }

  /**
   * Execute network request with policy enforcement
   */
  async executeRequest(request: NetworkRequest): Promise<NetworkResponse> {
    const validation = this.validateRequest(request);

    if (!validation.allowed) {
      throw new Error(`Network request blocked: ${validation.reason}`);
    }

    const policy = validation.policy!;
    const startTime = Date.now();

    // Check rate limiting
    const rateLimitKey = `network-${request.agentType}-${request.agentId}`;
    const rateLimitAllowed = await clientRateLimit.checkLimit('api-calls');

    if (!rateLimitAllowed) {
      throw new Error('Rate limit exceeded for network requests');
    }

    // Check concurrent connections
    const connectionKey = `${request.agentType}-${request.agentId}`;
    const currentConnections = this.activeConnections.get(connectionKey) || 0;

    if (currentConnections >= policy.maxConcurrentConnections) {
      throw new Error(`Maximum concurrent connections exceeded for ${request.agentType}`);
    }

    // Increment connection count
    this.activeConnections.set(connectionKey, currentConnections + 1);

    try {
      // Execute request with timeout and retry logic
      const response = await this.executeWithRetry(request, policy);

      logger.info('Network request completed', {
        agentType: request.agentType,
        agentId: request.agentId,
        url: request.url,
        status: response.status,
        duration: response.duration,
        encrypted: response.encrypted
      });

      return response;
    } finally {
      // Decrement connection count
      const updatedConnections = (this.activeConnections.get(connectionKey) || 1) - 1;
      if (updatedConnections <= 0) {
        this.activeConnections.delete(connectionKey);
      } else {
        this.activeConnections.set(connectionKey, updatedConnections);
      }
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry(
    request: NetworkRequest,
    policy: NetworkPolicy
  ): Promise<NetworkResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= policy.retryPolicy.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(request, policy);

        // Success - return response
        return {
          ...response,
          duration: Date.now() - Date.now(), // Would be calculated in makeRequest
        };
      } catch (error) {
        lastError = error as Error;

        logger.warn('Network request failed, retrying', {
          attempt,
          maxRetries: policy.retryPolicy.maxRetries,
          error: lastError.message,
          agentType: request.agentType,
          url: request.url
        });

        // Wait before retry (exponential backoff)
        if (attempt < policy.retryPolicy.maxRetries) {
          await new Promise(resolve =>
            setTimeout(resolve, policy.retryPolicy.backoffMs * Math.pow(2, attempt - 1))
          );
        }
      }
    }

    throw lastError || new Error('Network request failed after all retries');
  }

  /**
   * Make the actual network request
   */
  private async makeRequest(
    request: NetworkRequest,
    policy: NetworkPolicy
  ): Promise<NetworkResponse> {
    const startTime = Date.now();

    try {
      // Use fetch with policy constraints
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), policy.timeoutMs);

      const response = await fetch(request.url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Type': request.agentType,
          'X-Agent-ID': request.agentId,
          ...request.headers,
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      const duration = Date.now() - startTime;

      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        duration,
        encrypted: response.url.startsWith('https://'),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Network request failed', {
        error: (error as Error).message,
        duration,
        agentType: request.agentType,
        url: request.url
      });
      throw error;
    }
  }

  /**
   * Check if domain is allowed by policy
   */
  private isDomainAllowed(domain: string, policy: NetworkPolicy): boolean {
    // Check blocked domains first (takes precedence)
    for (const blockedPattern of policy.blockedDomains) {
      if (this.matchesDomainPattern(domain, blockedPattern)) {
        return false;
      }
    }

    // Check allowed domains
    for (const allowedPattern of policy.allowedDomains) {
      if (this.matchesDomainPattern(domain, allowedPattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if domain matches pattern (supports wildcards)
   */
  private matchesDomainPattern(domain: string, pattern: string): boolean {
    if (pattern === '*') return true;

    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(domain);
  }

  /**
   * Get network statistics
   */
  getNetworkStats(): {
    activeConnections: Record<string, number>;
    policiesCount: number;
    totalRequests: number;
  } {
    const activeConnections: Record<string, number> = {};
    for (const [key, count] of this.activeConnections.entries()) {
      activeConnections[key] = count;
    }

    return {
      activeConnections,
      policiesCount: this.policies.size,
      totalRequests: Array.from(this.activeConnections.values()).reduce((sum, count) => sum + count, 0),
    };
  }

  /**
   * Reset network segmentation state
   */
  reset(): void {
    this.activeConnections.clear();
    this.connectionPool.clear();
    logger.info('Network segmentation state reset');
  }
}

// Export singleton instance
export const networkSegmentation = NetworkSegmentationManager.getInstance();
