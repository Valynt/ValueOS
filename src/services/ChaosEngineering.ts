/**
 * Chaos Engineering Service
 * 
 * Controlled failure injection for resilience testing
 */

import { logger } from '../utils/logger';

export interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  probability: number; // 0-1
  targets: {
    services?: string[];
    endpoints?: string[];
    users?: string[];
  };
  failure: {
    type: 'latency' | 'error' | 'timeout' | 'circuit_breaker' | 'rate_limit' | 'data_corruption';
    config: Record<string, any>;
  };
  schedule?: {
    startTime?: Date;
    endTime?: Date;
    daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
    hoursOfDay?: number[]; // 0-23
  };
  metadata: {
    owner: string;
    tags: string[];
    createdAt: Date;
  };
}

export interface ChaosInjection {
  experimentId: string;
  injected: boolean;
  reason: string;
  timestamp: Date;
}

export class ChaosEngineeringService {
  private experiments: Map<string, ChaosExperiment> = new Map();
  private injectionHistory: ChaosInjection[] = [];
  private readonly MAX_HISTORY = 1000;

  constructor() {
    // Load experiments from environment or config
    this.loadExperiments();
  }

  /**
   * Register chaos experiment
   */
  registerExperiment(experiment: Omit<ChaosExperiment, 'id' | 'metadata'>): string {
    const id = `chaos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullExperiment: ChaosExperiment = {
      ...experiment,
      id,
      metadata: {
        owner: 'chaos-team',
        tags: [],
        createdAt: new Date(),
      },
    };

    this.experiments.set(id, fullExperiment);

    logger.info('Chaos experiment registered', {
      id,
      name: experiment.name,
      type: experiment.failure.type,
    });

    return id;
  }

  /**
   * Should inject chaos for this request
   */
  shouldInject(context: {
    service?: string;
    endpoint?: string;
    userId?: string;
  }): ChaosInjection | null {
    // Never inject in production unless explicitly enabled
    if (process.env.NODE_ENV === 'production' && !process.env.CHAOS_ENABLED) {
      return null;
    }

    for (const experiment of this.experiments.values()) {
      if (!experiment.enabled) continue;

      // Check schedule
      if (!this.isInSchedule(experiment)) continue;

      // Check targets
      if (!this.matchesTargets(experiment, context)) continue;

      // Check probability
      if (Math.random() > experiment.probability) continue;

      const injection: ChaosInjection = {
        experimentId: experiment.id,
        injected: true,
        reason: `Experiment: ${experiment.name}`,
        timestamp: new Date(),
      };

      this.recordInjection(injection);

      logger.warn('Chaos injected', {
        experimentId: experiment.id,
        name: experiment.name,
        type: experiment.failure.type,
        context,
      });

      return injection;
    }

    return null;
  }

  /**
   * Inject latency
   */
  async injectLatency(delayMs: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Inject error
   */
  injectError(config: {
    statusCode?: number;
    message?: string;
    type?: string;
  }): Error {
    const error: any = new Error(config.message || 'Chaos-induced error');
    error.statusCode = config.statusCode || 500;
    error.type = config.type || 'ChaosError';
    return error;
  }

  /**
   * Inject timeout
   */
  async injectTimeout(timeoutMs: number): Promise<never> {
    await new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Chaos-induced timeout')), timeoutMs)
    );
    throw new Error('Unreachable');
  }

  /**
   * Inject data corruption
   */
  corruptData<T>(data: T, config: {
    fields?: string[];
    corruptionType?: 'null' | 'random' | 'empty' | 'invalid';
  }): T {
    if (!data || typeof data !== 'object') return data;

    const corrupted = { ...data } as any;
    const fields = config.fields || Object.keys(corrupted);

    for (const field of fields) {
      if (!(field in corrupted)) continue;

      switch (config.corruptionType) {
        case 'null':
          corrupted[field] = null;
          break;
        case 'empty':
          corrupted[field] = '';
          break;
        case 'random':
          corrupted[field] = Math.random().toString(36);
          break;
        case 'invalid':
          corrupted[field] = 'CORRUPTED_' + corrupted[field];
          break;
      }
    }

    return corrupted;
  }

  /**
   * Execute chaos based on experiment
   */
  async executeChaos(injection: ChaosInjection): Promise<void> {
    const experiment = this.experiments.get(injection.experimentId);
    if (!experiment) return;

    const { failure } = experiment;

    switch (failure.type) {
      case 'latency':
        await this.injectLatency(failure.config.delayMs || 5000);
        break;

      case 'error':
        throw this.injectError(failure.config);

      case 'timeout':
        await this.injectTimeout(failure.config.timeoutMs || 30000);
        break;

      case 'circuit_breaker':
        throw this.injectError({
          statusCode: 503,
          message: 'Circuit breaker open (chaos)',
          type: 'CircuitBreakerError',
        });

      case 'rate_limit':
        throw this.injectError({
          statusCode: 429,
          message: 'Rate limit exceeded (chaos)',
          type: 'RateLimitError',
        });

      default:
        logger.warn('Unknown chaos failure type', { type: failure.type });
    }
  }

  /**
   * Check if experiment is in schedule
   */
  private isInSchedule(experiment: ChaosExperiment): boolean {
    if (!experiment.schedule) return true;

    const now = new Date();
    const { schedule } = experiment;

    // Check time range
    if (schedule.startTime && now < schedule.startTime) return false;
    if (schedule.endTime && now > schedule.endTime) return false;

    // Check day of week
    if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
      if (!schedule.daysOfWeek.includes(now.getDay())) return false;
    }

    // Check hour of day
    if (schedule.hoursOfDay && schedule.hoursOfDay.length > 0) {
      if (!schedule.hoursOfDay.includes(now.getHours())) return false;
    }

    return true;
  }

  /**
   * Check if request matches experiment targets
   */
  private matchesTargets(
    experiment: ChaosExperiment,
    context: {
      service?: string;
      endpoint?: string;
      userId?: string;
    }
  ): boolean {
    const { targets } = experiment;

    // If no targets specified, match all
    if (!targets.services && !targets.endpoints && !targets.users) {
      return true;
    }

    // Check service
    if (targets.services && targets.services.length > 0) {
      if (!context.service || !targets.services.includes(context.service)) {
        return false;
      }
    }

    // Check endpoint
    if (targets.endpoints && targets.endpoints.length > 0) {
      if (!context.endpoint || !targets.endpoints.some(e => context.endpoint?.includes(e))) {
        return false;
      }
    }

    // Check user
    if (targets.users && targets.users.length > 0) {
      if (!context.userId || !targets.users.includes(context.userId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Record injection
   */
  private recordInjection(injection: ChaosInjection): void {
    this.injectionHistory.push(injection);

    // Keep history size limited
    if (this.injectionHistory.length > this.MAX_HISTORY) {
      this.injectionHistory.shift();
    }
  }

  /**
   * Get experiment statistics
   */
  getExperimentStats(experimentId: string): {
    totalInjections: number;
    lastInjection?: Date;
    injectionRate: number;
  } {
    const injections = this.injectionHistory.filter(
      i => i.experimentId === experimentId
    );

    const totalInjections = injections.length;
    const lastInjection = injections.length > 0
      ? injections[injections.length - 1].timestamp
      : undefined;

    // Calculate injection rate (injections per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentInjections = injections.filter(
      i => i.timestamp > oneHourAgo
    );
    const injectionRate = recentInjections.length;

    return {
      totalInjections,
      lastInjection,
      injectionRate,
    };
  }

  /**
   * List all experiments
   */
  listExperiments(): ChaosExperiment[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Enable experiment
   */
  enableExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (experiment) {
      experiment.enabled = true;
      logger.info('Chaos experiment enabled', { experimentId });
    }
  }

  /**
   * Disable experiment
   */
  disableExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (experiment) {
      experiment.enabled = false;
      logger.info('Chaos experiment disabled', { experimentId });
    }
  }

  /**
   * Remove experiment
   */
  removeExperiment(experimentId: string): void {
    this.experiments.delete(experimentId);
    logger.info('Chaos experiment removed', { experimentId });
  }

  /**
   * Load predefined experiments
   */
  private loadExperiments(): void {
    // LLM latency experiment
    this.registerExperiment({
      name: 'LLM High Latency',
      description: 'Inject 5-10 second delays in LLM requests',
      enabled: false,
      probability: 0.1, // 10% of requests
      targets: {
        endpoints: ['/api/llm/chat', '/api/canvas/generate'],
      },
      failure: {
        type: 'latency',
        config: {
          delayMs: 5000 + Math.random() * 5000,
        },
      },
    });

    // Database timeout experiment
    this.registerExperiment({
      name: 'Database Timeout',
      description: 'Simulate database connection timeouts',
      enabled: false,
      probability: 0.05, // 5% of requests
      targets: {
        services: ['database'],
      },
      failure: {
        type: 'timeout',
        config: {
          timeoutMs: 30000,
        },
      },
    });

    // LLM provider failure experiment
    this.registerExperiment({
      name: 'LLM Provider Failure',
      description: 'Simulate Together.ai API failures',
      enabled: false,
      probability: 0.1,
      targets: {
        services: ['llm'],
      },
      failure: {
        type: 'error',
        config: {
          statusCode: 503,
          message: 'LLM provider unavailable',
        },
      },
    });

    // Rate limit experiment
    this.registerExperiment({
      name: 'Rate Limit Simulation',
      description: 'Simulate rate limit errors',
      enabled: false,
      probability: 0.05,
      targets: {
        endpoints: ['/api/llm/chat'],
      },
      failure: {
        type: 'rate_limit',
        config: {},
      },
    });

    // Circuit breaker experiment
    this.registerExperiment({
      name: 'Circuit Breaker Open',
      description: 'Simulate circuit breaker opening',
      enabled: false,
      probability: 0.05,
      targets: {
        services: ['llm'],
      },
      failure: {
        type: 'circuit_breaker',
        config: {},
      },
      schedule: {
        // Only during business hours
        hoursOfDay: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
      },
    });

    logger.info('Chaos experiments loaded', {
      count: this.experiments.size,
    });
  }
}

// Export singleton instance
export const chaosEngineering = new ChaosEngineeringService();
