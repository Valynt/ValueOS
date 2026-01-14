/**
 * Zero-Trust Architecture with mTLS
 *
 * Implements mutual TLS authentication, service identity verification,
 * and zero-trust network policies for ValueOS agent communications.
 */

import { createServer } from 'https';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../logger';
import { AgentIdentity } from '../auth/AgentIdentity';

// ============================================================================
// Types
// ============================================================================

export interface mTLSConfig {
  enabled: boolean;
  caCertPath: string;
  serverCertPath: string;
  serverKeyPath: string;
  clientCertPath: string;
  clientKeyPath: string;
  verifyClient: boolean;
  crlCheckEnabled: boolean;
  ocspCheckEnabled: boolean;
  cipherSuites: string[];
  minTLSVersion: 'TLSv1.2' | 'TLSv1.3';
  maxTLSVersion: 'TLSv1.2' | 'TLSv1.3';
}

export interface ServiceIdentity {
  serviceId: string;
  serviceName: string;
  namespace: string;
  environment: string;
  permissions: string[];
  trustLevel: 'low' | 'medium' | 'high' | 'critical';
  certificateFingerprint: string;
  validFrom: Date;
  validTo: Date;
  revoked: boolean;
}

export interface ZeroTrustPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  source: {
    services: string[];
    namespaces: string[];
    environments: string[];
  };
  destination: {
    services: string[];
    namespaces: string[];
    environments: string[];
  };
  actions: ('allow' | 'deny' | 'audit' | 'encrypt')[];
  conditions: {
    timeRange?: { start: string; end: string };
    maxConnections?: number;
    rateLimit?: number;
    requiredPermissions?: string[];
  };
}

export interface ConnectionContext {
  clientCertificate: any;
  clientFingerprint: string;
  clientServiceId: string;
  clientIdentity: ServiceIdentity;
  connectionTime: Date;
  sourceIP: string;
  userAgent?: string;
  requestedResource: string;
}

export interface AnomalyDetection {
  suspiciousIPs: Set<string>;
  unusualUserAgents: Set<string>;
  connectionPatterns: Map<string, number>;
  failedAuthAttempts: Map<string, number>;
  certificateAnomalies: Map<string, string[]>;
}

// ============================================================================
// Zero Trust mTLS Manager
// ============================================================================

export class ZeroTrustMTLSManager {
  private static instance: ZeroTrustMTLSManager;
  private config: mTLSConfig;
  private serviceIdentities: Map<string, ServiceIdentity> = new Map();
  private policies: Map<string, ZeroTrustPolicy> = new Map();
  private activeConnections: Map<string, ConnectionContext> = new Map();
  private anomalyDetection: AnomalyDetection;
  private metrics: {
    totalConnections: number;
    successfulAuths: number;
    failedAuths: number;
    blockedConnections: number;
    encryptedConnections: number;
  };

  private constructor(config: mTLSConfig) {
    this.config = config;
    this.anomalyDetection = {
      suspiciousIPs: new Set(),
      unusualUserAgents: new Set(),
      connectionPatterns: new Map(),
      failedAuthAttempts: new Map(),
      certificateAnomalies: new Map(),
    };
    this.metrics = {
      totalConnections: 0,
      successfulAuths: 0,
      failedAuths: 0,
      blockedConnections: 0,
      encryptedConnections: 0,
    };

    this.initializeServiceIdentities();
    this.loadPolicies();
    this.startAnomalyDetection();
  }

  static getInstance(config?: mTLSConfig): ZeroTrustMTLSManager {
    if (!ZeroTrustMTLSManager.instance) {
      if (!config) {
        throw new Error('mTLS config required for first initialization');
      }
      ZeroTrustMTLSManager.instance = new ZeroTrustMTLSManager(config);
    }
    return ZeroTrustMTLSManager.instance;
  }

  /**
   * Initialize service identities from certificates
   */
  private initializeServiceIdentities(): void {
    // In production, load from certificate authority or service mesh
    const defaultServices: ServiceIdentity[] = [
      {
        serviceId: 'valueos-coordinator',
        serviceName: 'coordinator',
        namespace: 'valueos',
        environment: process.env.NODE_ENV || 'development',
        permissions: ['workflow.execute', 'agents.coordinate'],
        trustLevel: 'high',
        certificateFingerprint: 'sha256:default',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        revoked: false,
      },
      {
        serviceId: 'valueos-opportunity',
        serviceName: 'opportunity',
        namespace: 'valueos',
        environment: process.env.NODE_ENV || 'development',
        permissions: ['data.read', 'opportunity.execute'],
        trustLevel: 'medium',
        certificateFingerprint: 'sha256:default',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        revoked: false,
      },
    ];

    defaultServices.forEach(service => {
      this.serviceIdentities.set(service.serviceId, service);
    });

    logger.info('Service identities initialized', {
      count: this.serviceIdentities.size,
    });
  }

  /**
   * Load zero-trust policies
   */
  private loadPolicies(): void {
    const defaultPolicies: ZeroTrustPolicy[] = [
      {
        id: 'allow-internal-communications',
        name: 'Allow Internal Service Communications',
        description: 'Allow services within the same namespace to communicate',
        enabled: true,
        priority: 100,
        source: {
          services: ['*'],
          namespaces: ['valueos'],
          environments: ['*'],
        },
        destination: {
          services: ['*'],
          namespaces: ['valueos'],
          environments: ['*'],
        },
        actions: ['allow', 'encrypt'],
        conditions: {
          requiredPermissions: ['service.communication'],
        },
      },
      {
        id: 'deny-cross-namespace',
        name: 'Deny Cross-Namespace Access',
        description: 'Block access between different namespaces',
        enabled: true,
        priority: 200,
        source: {
          services: ['*'],
          namespaces: ['*'],
          environments: ['*'],
        },
        destination: {
          services: ['*'],
          namespaces: ['external'],
          environments: ['*'],
        },
        actions: ['deny'],
        conditions: {},
      },
      {
        id: 'audit-admin-access',
        name: 'Audit Administrative Access',
        description: 'Log all administrative access attempts',
        enabled: true,
        priority: 50,
        source: {
          services: ['admin-*'],
          namespaces: ['*'],
          environments: ['*'],
        },
        destination: {
          services: ['*'],
          namespaces: ['*'],
          environments: ['*'],
        },
        actions: ['audit', 'allow'],
        conditions: {
          timeRange: { start: '09:00', end: '17:00' },
        },
      },
    ];

    defaultPolicies.forEach(policy => {
      this.policies.set(policy.id, policy);
    });

    logger.info('Zero-trust policies loaded', {
      count: this.policies.size,
    });
  }

  /**
   * Create HTTPS server with mTLS configuration
   */
  public createSecureServer(options: any = {}): any {
    if (!this.config.enabled) {
      logger.warn('mTLS disabled, creating insecure server');
      return createServer(options);
    }

    try {
      const tlsOptions = {
        key: readFileSync(this.config.serverKeyPath),
        cert: readFileSync(this.config.serverCertPath),
        ca: [readFileSync(this.config.caCertPath)],
        requestCert: true,
        rejectUnauthorized: this.config.verifyClient,
        minVersion: this.config.minTLSVersion,
        maxVersion: this.config.maxTLSVersion,
        ciphers: this.config.cipherSuites.join(':'),
        ...options,
      };

      const server = createServer(tlsOptions, (req, res) => {
        this.handleSecureRequest(req, res);
      });

      // Add mTLS connection event handlers
      server.on('secureConnection', (tlsSocket) => {
        this.handleSecureConnection(tlsSocket);
      });

      server.on('clientError', (err, socket) => {
        this.handleClientError(err, socket);
      });

      logger.info('Secure mTLS server created', {
        minTLSVersion: this.config.minTLSVersion,
        verifyClient: this.config.verifyClient,
      });

      return server;
    } catch (error) {
      logger.error('Failed to create secure server', error instanceof Error ? error : undefined);
      throw new Error(`mTLS server creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle secure connection with mTLS verification
   */
  private handleSecureConnection(tlsSocket: any): void {
    const socket = tlsSocket;
    const cert = socket.getPeerCertificate();

    if (!cert) {
      logger.warn('Connection without client certificate rejected');
      socket.destroy();
      this.metrics.failedAuths++;
      return;
    }

    this.metrics.totalConnections++;

    try {
      // Verify certificate chain
      if (!this.verifyCertificateChain(cert)) {
        logger.warn('Invalid certificate chain', { fingerprint: cert.fingerprint });
        socket.destroy();
        this.metrics.failedAuths++;
        return;
      }

      // Extract service identity
      const serviceIdentity = this.extractServiceIdentity(cert);
      if (!serviceIdentity) {
        logger.warn('Unknown service identity', { fingerprint: cert.fingerprint });
        socket.destroy();
        this.metrics.failedAuths++;
        return;
      }

      // Check if certificate is revoked
      if (serviceIdentity.revoked) {
        logger.warn('Revoked certificate connection attempt', {
          serviceId: serviceIdentity.serviceId,
          fingerprint: cert.fingerprint
        });
        socket.destroy();
        this.metrics.failedAuths++;
        return;
      }

      // Create connection context
      const connectionContext: ConnectionContext = {
        clientCertificate: cert,
        clientFingerprint: cert.fingerprint,
        clientServiceId: serviceIdentity.serviceId,
        clientIdentity: serviceIdentity,
        connectionTime: new Date(),
        sourceIP: socket.remoteAddress,
        userAgent: socket.headers?.['user-agent'],
        requestedResource: socket.url || '/',
      };

      // Store active connection
      const connectionId = `${serviceIdentity.serviceId}:${socket.remoteAddress}:${Date.now()}`;
      this.activeConnections.set(connectionId, connectionContext);

      // Apply zero-trust policies
      const policyResult = this.evaluatePolicies(connectionContext);

      if (!policyResult.allowed) {
        logger.warn('Connection blocked by zero-trust policy', {
          serviceId: serviceIdentity.serviceId,
          policyId: policyResult.blockingPolicy,
          reason: policyResult.reason,
        });

        socket.destroy();
        this.metrics.blockedConnections++;
        return;
      }

      this.metrics.successfulAuths++;
      this.metrics.encryptedConnections++;

      logger.info('Secure connection established', {
        serviceId: serviceIdentity.serviceId,
        sourceIP: socket.remoteAddress,
        fingerprint: cert.fingerprint,
        policies: policyResult.appliedPolicies,
      });

      // Set up connection cleanup
      socket.on('close', () => {
        this.activeConnections.delete(connectionId);
      });

      socket.on('error', (error: Error) => {
        logger.error('Secure connection error', error, {
          serviceId: serviceIdentity.serviceId,
        });
        this.activeConnections.delete(connectionId);
      });

    } catch (error) {
      logger.error('Error handling secure connection', error instanceof Error ? error : undefined);
      socket.destroy();
      this.metrics.failedAuths++;
    }
  }

  /**
   * Verify certificate chain
   */
  private verifyCertificateChain(cert: any): boolean {
    // Basic certificate validation
    if (!cert || !cert.fingerprint) {
      return false;
    }

    // Check certificate validity period
    const now = new Date();
    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);

    if (now < validFrom || now > validTo) {
      return false;
    }

    // Check certificate purpose (should be for client authentication)
    if (!cert.subject || !cert.issuer) {
      return false;
    }

    // In production, verify against CA and check CRL/OCSP
    if (this.config.crlCheckEnabled) {
      // TODO: Implement CRL checking
    }

    if (this.config.ocspCheckEnabled) {
      // TODO: Implement OCSP checking
    }

    return true;
  }

  /**
   * Extract service identity from certificate
   */
  private extractServiceIdentity(cert: any): ServiceIdentity | null {
    // Extract service information from certificate subject
    const subject = cert.subject;
    if (!subject) return null;

    // Parse certificate subject for service information
    // Expected format: CN=service-name, OU=namespace, O=environment
    const commonName = subject.CN;
    const organizationalUnit = subject.OU;
    const organization = subject.O;

    if (!commonName) return null;

    const serviceId = `valueos-${commonName}`;
    const serviceIdentity = this.serviceIdentities.get(serviceId);

    if (!serviceIdentity) {
      // Create temporary identity for unknown services
      return {
        serviceId,
        serviceName: commonName,
        namespace: organizationalUnit || 'unknown',
        environment: organization || 'unknown',
        permissions: [],
        trustLevel: 'low',
        certificateFingerprint: cert.fingerprint,
        validFrom: new Date(cert.valid_from),
        validTo: new Date(cert.valid_to),
        revoked: false,
      };
    }

    // Update certificate fingerprint
    serviceIdentity.certificateFingerprint = cert.fingerprint;
    serviceIdentity.validFrom = new Date(cert.valid_from);
    serviceIdentity.validTo = new Date(cert.valid_to);

    return serviceIdentity;
  }

  /**
   * Evaluate zero-trust policies for connection
   */
  private evaluatePolicies(context: ConnectionContext): {
    allowed: boolean;
    appliedPolicies: string[];
    blockingPolicy?: string;
    reason?: string;
  } {
    const appliedPolicies: string[] = [];
    let allowed = false;
    let blockingPolicy: string | undefined;
    let reason: string | undefined;

    // Sort policies by priority (lower number = higher priority)
    const sortedPolicies = Array.from(this.policies.values())
      .filter(policy => policy.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const policy of sortedPolicies) {
      if (!this.matchesPolicy(policy, context)) {
        continue;
      }

      appliedPolicies.push(policy.id);

      // Check policy conditions
      if (!this.meetsPolicyConditions(policy, context)) {
        continue;
      }

      // Apply policy actions
      if (policy.actions.includes('deny')) {
        allowed = false;
        blockingPolicy = policy.id;
        reason = 'Denied by policy';
        break;
      }

      if (policy.actions.includes('allow')) {
        allowed = true;
      }

      if (policy.actions.includes('audit')) {
        this.auditConnection(context, policy);
      }
    }

    // Default deny if no policies matched
    if (appliedPolicies.length === 0) {
      allowed = false;
      reason = 'No matching policies';
    }

    return {
      allowed,
      appliedPolicies,
      blockingPolicy,
      reason,
    };
  }

  /**
   * Check if connection matches policy source/destination
   */
  private matchesPolicy(policy: ZeroTrustPolicy, context: ConnectionContext): boolean {
    const { source, destination } = policy;
    const identity = context.clientIdentity;

    // Check source matching
    const sourceMatches =
      (source.services.includes('*') || source.services.includes(identity.serviceName)) &&
      (source.namespaces.includes('*') || source.namespaces.includes(identity.namespace)) &&
      (source.environments.includes('*') || source.environments.includes(identity.environment));

    if (!sourceMatches) return false;

    // Check destination matching (simplified - in production, would check actual destination)
    const destinationMatches =
      destination.services.includes('*') ||
      destination.services.includes(context.requestedResource.split('/')[0]);

    return destinationMatches;
  }

  /**
   * Check if connection meets policy conditions
   */
  private meetsPolicyConditions(policy: ZeroTrustPolicy, context: ConnectionContext): boolean {
    const { conditions } = policy;

    // Time range condition
    if (conditions.timeRange) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      if (currentTime < conditions.timeRange.start || currentTime > conditions.timeRange.end) {
        return false;
      }
    }

    // Required permissions condition
    if (conditions.requiredPermissions) {
      const hasPermissions = conditions.requiredPermissions.every(perm =>
        context.clientIdentity.permissions.includes(perm)
      );

      if (!hasPermissions) {
        return false;
      }
    }

    // Rate limiting condition
    if (conditions.rateLimit) {
      const connectionKey = `${context.clientIdentity.serviceId}:${context.sourceIP}`;
      const currentConnections = this.anomalyDetection.connectionPatterns.get(connectionKey) || 0;

      if (currentConnections >= conditions.rateLimit) {
        return false;
      }
    }

    return true;
  }

  /**
   * Audit connection for policy compliance
   */
  private auditConnection(context: ConnectionContext, policy: ZeroTrustPolicy): void {
    logger.info('Connection audited', {
      policyId: policy.id,
      policyName: policy.name,
      serviceId: context.clientIdentity.serviceId,
      sourceIP: context.sourceIP,
      requestedResource: context.requestedResource,
      connectionTime: context.connectionTime,
    });
  }

  /**
   * Handle client errors
   */
  private handleClientError(error: Error, socket: any): void {
    logger.error('Client TLS error', error, {
      remoteAddress: socket.remoteAddress,
    });

    // Track failed authentication attempts
    const connectionKey = `${socket.remoteAddress}:${Date.now()}`;
    this.anomalyDetection.failedAuthAttempts.set(connectionKey, Date.now());
  }

  /**
   * Handle secure requests
   */
  private handleSecureRequest(req: any, res: any): void {
    // Update connection patterns for anomaly detection
    const connectionKey = `${req.socket.remoteAddress}:${req.socket.clientServiceId}`;
    const currentCount = this.anomalyDetection.connectionPatterns.get(connectionKey) || 0;
    this.anomalyDetection.connectionPatterns.set(connectionKey, currentCount + 1);

    // Continue with request processing
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'secure',
      serviceId: req.socket.clientServiceId,
      fingerprint: req.socket.clientFingerprint,
    }));
  }

  /**
   * Start anomaly detection monitoring
   */
  private startAnomalyDetection(): void {
    // Run anomaly detection every 5 minutes
    setInterval(() => {
      this.detectAnomalies();
    }, 300000);

    logger.info('Anomaly detection started');
  }

  /**
   * Detect security anomalies
   */
  private detectAnomalies(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;

    // Check for unusual connection patterns
    for (const [connectionKey, count] of this.anomalyDetection.connectionPatterns) {
      if (count > 1000) { // More than 1000 connections in 5 minutes
        logger.warn('Unusual connection pattern detected', {
          connectionKey,
          count,
        });
        this.anomalyDetection.suspiciousIPs.add(connectionKey.split(':')[0]);
      }
    }

    // Check for failed authentication attempts
    for (const [key, timestamp] of this.anomalyDetection.failedAuthAttempts) {
      if (timestamp > fiveMinutesAgo) {
        const ip = key.split(':')[0];
        const failedCount = Array.from(this.anomalyDetection.failedAuthAttempts.values())
          .filter(ts => ts > fiveMinutesAgo && ts.toString().includes(ip)).length;

        if (failedCount > 10) {
          logger.warn('High failed authentication rate', {
            ip,
            failedCount,
          });
          this.anomalyDetection.suspiciousIPs.add(ip);
        }
      }
    }

    // Clean old data
    this.cleanupAnomalyData(fiveMinutesAgo);
  }

  /**
   * Clean old anomaly detection data
   */
  private cleanupAnomalyData(cutoffTime: number): void {
    // Clean old connection patterns
    for (const [key] of this.anomalyDetection.connectionPatterns) {
      // Reset counters periodically
      if (Math.random() < 0.1) { // 10% chance to reset
        this.anomalyDetection.connectionPatterns.set(key, 0);
      }
    }

    // Clean old failed auth attempts
    for (const [key, timestamp] of this.anomalyDetection.failedAuthAttempts) {
      if (timestamp < cutoffTime) {
        this.anomalyDetection.failedAuthAttempts.delete(key);
      }
    }
  }

  /**
   * Get security metrics
   */
  public getMetrics(): any {
    return {
      ...this.metrics,
      activeConnections: this.activeConnections.size,
      suspiciousIPs: this.anomalyDetection.suspiciousIPs.size,
      policies: this.policies.size,
      serviceIdentities: this.serviceIdentities.size,
    };
  }

  /**
   * Add new service identity
   */
  public addServiceIdentity(identity: ServiceIdentity): void {
    this.serviceIdentities.set(identity.serviceId, identity);
    logger.info('Service identity added', {
      serviceId: identity.serviceId,
      trustLevel: identity.trustLevel,
    });
  }

  /**
   * Revoke service identity
   */
  public revokeServiceIdentity(serviceId: string): void {
    const identity = this.serviceIdentities.get(serviceId);
    if (identity) {
      identity.revoked = true;
      logger.warn('Service identity revoked', { serviceId });
    }
  }

  /**
   * Add zero-trust policy
   */
  public addPolicy(policy: ZeroTrustPolicy): void {
    this.policies.set(policy.id, policy);
    logger.info('Zero-trust policy added', {
      policyId: policy.id,
      policyName: policy.name,
    });
  }

  /**
   * Remove zero-trust policy
   */
  public removePolicy(policyId: string): void {
    this.policies.delete(policyId);
    logger.info('Zero-trust policy removed', { policyId });
  }
}

// ============================================================================
// Exports
// ============================================================================

export function getZeroTrustMTLS(config: mTLSConfig): ZeroTrustMTLSManager {
  return ZeroTrustMTLSManager.getInstance(config);
}

export default {
  ZeroTrustMTLSManager,
  getZeroTrustMTLS,
};
