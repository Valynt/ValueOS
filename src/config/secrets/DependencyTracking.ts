/**
 * Secret Dependency Tracking
 * 
 * Tracks which services/components depend on which secrets
 * Enables impact analysis for secret rotation
 * 
 * Sprint 4: Advanced Features
 * Created: 2024-11-29
 */

import { logger } from '../../lib/logger';

/**
 * Service that depends on a secret
 */
export interface SecretDependency {
  serviceId: string;
  serviceName: string;
  serviceType: 'api' | 'worker' | 'cron' | 'function';
  environment: 'production' | 'staging' | 'development';
  lastAccess: Date;
  accessCount: number;
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysis {
  tenantId: string;
  secretKey: string;
  affectedServices: SecretDependency[];
  estimatedDowntime: number; // minutes
  criticalityLevel: 'low' | 'medium' | 'high' | 'critical';
  rotationWindow: string;
}

/**
 * Dependency graph node
 */
export interface DependencyNode {
  id: string;
  type: 'secret' | 'service';
  label: string;
  connections: string[];
}

/**
 * Secret dependency tracking system
 * 
 * Maintains registry of secret-to-service dependencies
 */
export class DependencyTracking {
  private dependencies: Map<string, Set<SecretDependency>> = new Map();

  constructor() {
    logger.info('Dependency tracking initialized');
  }

  /**
   * Get dependency key
   */
  private getDependencyKey(tenantId: string, secretKey: string): string {
    return `${tenantId}:${secretKey}`;
  }

  /**
   * Register a dependency
   */
  registerDependency(
    tenantId: string,
    secretKey: string,
    service: Omit<SecretDependency, 'lastAccess' | 'accessCount'>
  ): void {
    const key = this.getDependencyKey(tenantId, secretKey);
    
    if (!this.dependencies.has(key)) {
      this.dependencies.set(key, new Set());
    }

    const deps = this.dependencies.get(key)!;

    // Find existing or create new
    let existing: SecretDependency | undefined;
    for (const dep of deps) {
      if (dep.serviceId === service.serviceId) {
        existing = dep;
        break;
      }
    }

    if (existing) {
      // Update existing
      existing.lastAccess = new Date();
      existing.accessCount++;
    } else {
      // Add new
      deps.add({
        ...service,
        lastAccess: new Date(),
        accessCount: 1
      });
    }

    logger.debug('Dependency registered', {
      tenantId,
      secretKey,
      serviceId: service.serviceId
    });
  }

  /**
   * Record secret access by a service
   */
  recordAccess(
    tenantId: string,
    secretKey: string,
    serviceId: string
  ): void {
    const key = this.getDependencyKey(tenantId, secretKey);
    const deps = this.dependencies.get(key);

    if (!deps) {
      return;
    }

    for (const dep of deps) {
      if (dep.serviceId === serviceId) {
        dep.lastAccess = new Date();
        dep.accessCount++;
        break;
      }
    }
  }

  /**
   * Get all dependencies for a secret
   */
  getDependencies(
    tenantId: string,
    secretKey: string
  ): SecretDependency[] {
    const key = this.getDependencyKey(tenantId, secretKey);
    const deps = this.dependencies.get(key);

    if (!deps) {
      return [];
    }

    return Array.from(deps);
  }

  /**
   * Analyze impact of rotating a secret
   */
  analyzeImpact(
    tenantId: string,
    secretKey: string
  ): ImpactAnalysis {
    const dependencies = this.getDependencies(tenantId, secretKey);

    // Calculate criticality based on number and type of services
    let criticalityLevel: ImpactAnalysis['criticalityLevel'] = 'low';
    
    const hasProduction = dependencies.some(d => d.environment === 'production');
    const hasApi = dependencies.some(d => d.serviceType === 'api');
    
    if (hasProduction && hasApi && dependencies.length > 5) {
      criticalityLevel = 'critical';
    } else if (hasProduction && dependencies.length > 3) {
      criticalityLevel = 'high';
    } else if (dependencies.length > 1) {
      criticalityLevel = 'medium';
    }

    // Estimate downtime (in minutes)
    // API services: 5 min per service
    // Workers: 2 min per service
    // Others: 1 min per service
    let estimatedDowntime = 0;
    for (const dep of dependencies) {
      switch (dep.serviceType) {
        case 'api':
          estimatedDowntime += 5;
          break;
        case 'worker':
          estimatedDowntime += 2;
          break;
        default:
          estimatedDowntime += 1;
      }
    }

    // Recommend rotation window based on criticality
    let rotationWindow = '';
    switch (criticalityLevel) {
      case 'critical':
        rotationWindow = 'Saturday 2:00 AM - 4:00 AM (low traffic period)';
        break;
      case 'high':
        rotationWindow = 'Sunday 1:00 AM - 3:00 AM';
        break;
      case 'medium':
        rotationWindow = 'Any night 2:00 AM - 4:00 AM';
        break;
      case 'low':
        rotationWindow = 'Anytime';
        break;
    }

    logger.info('Impact analysis complete', {
      tenantId,
      secretKey,
      affectedServices: dependencies.length,
      criticalityLevel,
      estimatedDowntime
    });

    return {
      tenantId,
      secretKey,
      affectedServices: dependencies,
      estimatedDowntime,
      criticalityLevel,
      rotationWindow
    };
  }

  /**
   * Generate dependency graph
   */
  generateDependencyGraph(tenantId: string): DependencyNode[] {
    const nodes: DependencyNode[] = [];
    const serviceNodes = new Map<string, DependencyNode>();

    // Create nodes for all secrets and services
    for (const [key, deps] of this.dependencies.entries()) {
      const [tid, secretKey] = key.split(':');
      
      if (tid !== tenantId) {
        continue;
      }

      // Secret node
      const secretNode: DependencyNode = {
        id: `secret:${secretKey}`,
        type: 'secret',
        label: secretKey,
        connections: []
      };

      // Service nodes
      for (const dep of deps) {
        if (!serviceNodes.has(dep.serviceId)) {
          serviceNodes.set(dep.serviceId, {
            id: `service:${dep.serviceId}`,
            type: 'service',
            label: dep.serviceName,
            connections: []
          });
        }

        // Add connection
        secretNode.connections.push(`service:${dep.serviceId}`);
        serviceNodes.get(dep.serviceId)!.connections.push(`secret:${secretKey}`);
      }

      nodes.push(secretNode);
    }

    // Add all service nodes
    nodes.push(...Array.from(serviceNodes.values()));

    logger.info('Generated dependency graph', {
      tenantId,
      totalNodes: nodes.length,
      secretNodes: nodes.filter(n => n.type === 'secret').length,
      serviceNodes: nodes.filter(n => n.type === 'service').length
    });

    return nodes;
  }

  /**
   * Find secrets used by a service
   */
  getServiceDependencies(serviceId: string): Array<{
    tenantId: string;
    secretKey: string;
  }> {
    const result: Array<{ tenantId: string; secretKey: string }> = [];

    for (const [key, deps] of this.dependencies.entries()) {
      const [tenantId, secretKey] = key.split(':');

      for (const dep of deps) {
        if (dep.serviceId === serviceId) {
          result.push({ tenantId, secretKey });
          break;
        }
      }
    }

    return result;
  }

  /**
   * Remove a dependency
   */
  removeDependency(
    tenantId: string,
    secretKey: string,
    serviceId: string
  ): boolean {
    const key = this.getDependencyKey(tenantId, secretKey);
    const deps = this.dependencies.get(key);

    if (!deps) {
      return false;
    }

    for (const dep of deps) {
      if (dep.serviceId === serviceId) {
        deps.delete(dep);
        logger.info('Dependency removed', {
          tenantId,
          secretKey,
          serviceId
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalSecrets: number;
    totalDependencies: number;
    averageDependenciesPerSecret: number;
    mostUsedSecrets: Array<{ secretKey: string; count: number }>;
  } {
    let totalDependencies = 0;
    const secretCounts: Map<string, number> = new Map();

    for (const [key, deps] of this.dependencies.entries()) {
      const count = deps.size;
      totalDependencies += count;
      
      const [, secretKey] = key.split(':');
      secretCounts.set(secretKey, count);
    }

    const mostUsedSecrets = Array.from(secretCounts.entries())
      .map(([secretKey, count]) => ({ secretKey, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSecrets: this.dependencies.size,
      totalDependencies,
      averageDependenciesPerSecret: 
        this.dependencies.size > 0 ? totalDependencies / this.dependencies.size : 0,
      mostUsedSecrets
    };
  }

  /**
   * Export dependencies (for backup)
   */
  exportDependencies(): string {
    const data: any = {};

    for (const [key, deps] of this.dependencies.entries()) {
      data[key] = Array.from(deps);
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import dependencies (from backup)
   */
  importDependencies(json: string): void {
    try {
      const data = JSON.parse(json);

      for (const [key, deps] of Object.entries(data)) {
        const depSet = new Set<SecretDependency>();
        
        for (const dep of deps as any[]) {
          depSet.add({
            ...dep,
            lastAccess: new Date(dep.lastAccess)
          });
        }

        this.dependencies.set(key, depSet);
      }

      logger.info('Dependencies imported', {
        count: this.dependencies.size
      });
    } catch (error) {
      logger.error('Failed to import dependencies', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

/**
 * Global dependency tracking instance
 */
export const dependencyTracking = new DependencyTracking();

/**
 * Middleware to automatically track secret dependencies
 */
export function createDependencyTrackingMiddleware(
  tenantId: string,
  serviceId: string,
  serviceName: string,
  serviceType: SecretDependency['serviceType']
) {
  return {
    beforeGetSecret(secretKey: string) {
      // Register dependency
      dependencyTracking.registerDependency(tenantId, secretKey, {
        serviceId,
        serviceName,
        serviceType,
        environment: (process.env.NODE_ENV as any) || 'development'
      });

      // Record access
      dependencyTracking.recordAccess(tenantId, secretKey, serviceId);
    }
  };
}
