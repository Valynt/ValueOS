import type {
  ResourceQuotas,
  ResourceType,
  ServiceLevelAgreement,
  TenantPriority,
  TenantTier,
} from './TenantPerformanceManager.js';

export function getQuotaForResource(quotas: ResourceQuotas, resourceType: ResourceType): number {
  switch (resourceType) {
    case 'agents':
      return quotas.maxConcurrentAgents;
    case 'memory':
      return quotas.maxAgentMemoryUsage;
    case 'storage':
      return quotas.maxStorageSize * 1024;
    case 'bandwidth':
      return quotas.maxBandwidthPerHour * 1024;
    case 'api_calls':
      return quotas.maxApiCallsPerDay;
    case 'cpu':
      return 100;
    default:
      return 0;
  }
}

export function getQuotasForTier(tier: TenantTier): ResourceQuotas {
  switch (tier) {
    case 'basic':
      return {
        maxConcurrentAgents: 5,
        maxAgentExecutionsPerHour: 100,
        maxAgentMemoryUsage: 256,
        maxAgentExecutionTime: 300,
        maxStorageSize: 10,
        maxApiCallsPerDay: 10000,
        maxBandwidthPerHour: 1,
        maxCollaborativeTeams: 3,
        maxTeamMembers: 5,
        maxSharedContextSize: 50,
        maxSecurityContexts: 10,
        maxAuditRetentionDays: 30,
        maxConcurrentSessions: 5,
      };
    case 'professional':
      return {
        maxConcurrentAgents: 20,
        maxAgentExecutionsPerHour: 1000,
        maxAgentMemoryUsage: 512,
        maxAgentExecutionTime: 600,
        maxStorageSize: 100,
        maxApiCallsPerDay: 100000,
        maxBandwidthPerHour: 10,
        maxCollaborativeTeams: 10,
        maxTeamMembers: 20,
        maxSharedContextSize: 200,
        maxSecurityContexts: 50,
        maxAuditRetentionDays: 90,
        maxConcurrentSessions: 20,
      };
    case 'enterprise':
      return {
        maxConcurrentAgents: 100,
        maxAgentExecutionsPerHour: 10000,
        maxAgentMemoryUsage: 1024,
        maxAgentExecutionTime: 1800,
        maxStorageSize: 1000,
        maxApiCallsPerDay: 1000000,
        maxBandwidthPerHour: 100,
        maxCollaborativeTeams: 50,
        maxTeamMembers: 100,
        maxSharedContextSize: 1000,
        maxSecurityContexts: 200,
        maxAuditRetentionDays: 2555,
        maxConcurrentSessions: 100,
      };
    default:
      return getDefaultQuotas();
  }
}

export function getSLAForTier(tier: TenantTier): ServiceLevelAgreement {
  switch (tier) {
    case 'basic':
      return {
        availability: 99.0,
        responseTime: { p50: 500, p90: 1000, p95: 1500, p99: 2000 },
        throughput: { requestsPerSecond: 10, concurrentConnections: 5, dataTransferRate: 1 },
        errorRate: 1.0,
        supportResponseTime: { critical: 48, high: 72, medium: 120, low: 168 },
        compensation: {
          serviceCredits: true,
          refundPolicy: 'Pro-rated credit for downtime exceeding 1%',
          downtimeThreshold: 1.0,
          creditCalculation: 'Monthly service credit based on downtime percentage',
        },
        monitoring: {
          metrics: ['response_time', 'error_rate', 'throughput'],
          alerting: true,
          reporting: true,
          dashboard: false,
          apiAccess: false,
        },
      };
    case 'professional':
      return {
        availability: 99.9,
        responseTime: { p50: 200, p90: 500, p95: 800, p99: 1200 },
        throughput: { requestsPerSecond: 100, concurrentConnections: 50, dataTransferRate: 10 },
        errorRate: 0.5,
        supportResponseTime: { critical: 12, high: 24, medium: 48, low: 72 },
        compensation: {
          serviceCredits: true,
          refundPolicy: 'Full month credit for downtime exceeding SLA',
          downtimeThreshold: 0.1,
          creditCalculation: 'Full month service credit for any SLA violation',
        },
        monitoring: {
          metrics: ['response_time', 'error_rate', 'throughput', 'availability'],
          alerting: true,
          reporting: true,
          dashboard: true,
          apiAccess: true,
        },
      };
    case 'enterprise':
      return {
        availability: 99.99,
        responseTime: { p50: 100, p90: 250, p95: 400, p99: 600 },
        throughput: { requestsPerSecond: 1000, concurrentConnections: 500, dataTransferRate: 100 },
        errorRate: 0.1,
        supportResponseTime: { critical: 1, high: 4, medium: 8, low: 24 },
        compensation: {
          serviceCredits: true,
          refundPolicy: 'Multiple month credits for significant downtime',
          downtimeThreshold: 0.01,
          creditCalculation: 'Multiple months credit based on downtime severity',
        },
        monitoring: {
          metrics: ['response_time', 'error_rate', 'throughput', 'availability', 'resource_usage'],
          alerting: true,
          reporting: true,
          dashboard: true,
          apiAccess: true,
        },
      };
    default:
      return getDefaultSLA();
  }
}

export function getPriorityForTier(tier: TenantTier): TenantPriority {
  switch (tier) {
    case 'basic':
      return 'low';
    case 'professional':
      return 'medium';
    case 'enterprise':
      return 'high';
    default:
      return 'medium';
  }
}

export function getPriorityWeight(priority: TenantPriority): number {
  switch (priority) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    case 'critical':
      return 4;
    default:
      return 2;
  }
}

export function getTierWeight(tier: TenantTier): number {
  switch (tier) {
    case 'basic':
      return 1;
    case 'professional':
      return 2;
    case 'enterprise':
      return 3;
    default:
      return 2;
  }
}

export function getDefaultQuotas(): ResourceQuotas {
  return {
    maxConcurrentAgents: 5,
    maxAgentExecutionsPerHour: 100,
    maxAgentMemoryUsage: 256,
    maxAgentExecutionTime: 300,
    maxStorageSize: 10,
    maxApiCallsPerDay: 10000,
    maxBandwidthPerHour: 1,
    maxCollaborativeTeams: 3,
    maxTeamMembers: 5,
    maxSharedContextSize: 50,
    maxSecurityContexts: 10,
    maxAuditRetentionDays: 30,
    maxConcurrentSessions: 5,
  };
}

export function getDefaultSLA(): ServiceLevelAgreement {
  return {
    availability: 99.0,
    responseTime: { p50: 500, p90: 1000, p95: 1500, p99: 2000 },
    throughput: { requestsPerSecond: 10, concurrentConnections: 5, dataTransferRate: 1 },
    errorRate: 1.0,
    supportResponseTime: { critical: 48, high: 72, medium: 120, low: 168 },
    compensation: {
      serviceCredits: true,
      refundPolicy: 'Standard policy',
      downtimeThreshold: 1.0,
      creditCalculation: 'Standard calculation',
    },
    monitoring: {
      metrics: ['response_time', 'error_rate'],
      alerting: true,
      reporting: true,
      dashboard: false,
      apiAccess: false,
    },
  };
}

export function getDefaultAlertThresholds(): Record<string, number> {
  return {
    cpu_utilization: 0.8,
    memory_utilization: 0.85,
    storage_utilization: 0.9,
    error_rate: 0.05,
    response_time_p95: 1000,
  };
}
