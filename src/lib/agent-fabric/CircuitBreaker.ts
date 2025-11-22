/**
 * Agent Circuit Breaker
 * 
 * SAF-401: Prevents runaway agent execution and cost overruns
 * 
 * Implements hard limits on:
 * - Execution time (max 30 seconds)
 * - LLM API calls (max 20 per execution)
 * - Recursion depth (max 5 levels)
 * - Memory usage tracking
 * 
 * Throws SafetyError when limits are exceeded to prevent:
 * - Infinite loops
 * - Excessive API costs
 * - Resource exhaustion
 */

import { logger } from '../logger';

/**
 * Safety limits configuration
 */
export interface SafetyLimits {
  /** Maximum execution time in milliseconds (default: 30000ms = 30s) */
  maxExecutionTime: number;
  
  /** Maximum number of LLM API calls (default: 20) */
  maxLLMCalls: number;
  
  /** Maximum recursion depth (default: 5) */
  maxRecursionDepth: number;
  
  /** Maximum memory usage in bytes (default: 100MB) */
  maxMemoryBytes: number;
  
  /** Enable detailed tracking (performance impact) */
  enableDetailedTracking: boolean;
}

/**
 * Default safety limits (production-safe)
 */
export const DEFAULT_SAFETY_LIMITS: SafetyLimits = {
  maxExecutionTime: 30000, // 30 seconds
  maxLLMCalls: 20,
  maxRecursionDepth: 5,
  maxMemoryBytes: 100 * 1024 * 1024, // 100MB
  enableDetailedTracking: false,
};

/**
 * Execution metrics
 */
export interface ExecutionMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  llmCallCount: number;
  recursionDepth: number;
  memoryUsed: number;
  limitViolations: string[];
  completed: boolean;
}

/**
 * Safety error thrown when limits are exceeded
 */
export class SafetyError extends Error {
  constructor(
    message: string,
    public readonly limit: keyof SafetyLimits,
    public readonly value: number,
    public readonly threshold: number,
    public readonly metrics: ExecutionMetrics
  ) {
    super(message);
    this.name = 'SafetyError';
  }
}

/**
 * Circuit breaker for agent execution
 */
export class AgentCircuitBreaker {
  private limits: SafetyLimits;
  private metrics: ExecutionMetrics;
  private abortController: AbortController;
  private timeoutId?: NodeJS.Timeout;

  constructor(limits: Partial<SafetyLimits> = {}) {
    this.limits = { ...DEFAULT_SAFETY_LIMITS, ...limits };
    this.metrics = {
      startTime: Date.now(),
      llmCallCount: 0,
      recursionDepth: 0,
      memoryUsed: 0,
      limitViolations: [],
      completed: false,
    };
    this.abortController = new AbortController();
  }

  /**
   * Start execution with timeout
   */
  start(): void {
    this.metrics.startTime = Date.now();
    
    // Set hard timeout
    this.timeoutId = setTimeout(() => {
      this.abort('maxExecutionTime', Date.now() - this.metrics.startTime, this.limits.maxExecutionTime);
    }, this.limits.maxExecutionTime);

    logger.debug('Circuit breaker started', {
      limits: this.limits,
    });
  }

  /**
   * Record an LLM API call
   */
  recordLLMCall(): void {
    this.metrics.llmCallCount++;
    
    if (this.metrics.llmCallCount > this.limits.maxLLMCalls) {
      this.abort('maxLLMCalls', this.metrics.llmCallCount, this.limits.maxLLMCalls);
    }

    if (this.limits.enableDetailedTracking) {
      logger.debug('LLM call recorded', {
        count: this.metrics.llmCallCount,
        limit: this.limits.maxLLMCalls,
      });
    }
  }

  /**
   * Enter a recursion level
   */
  enterRecursion(): void {
    this.metrics.recursionDepth++;
    
    if (this.metrics.recursionDepth > this.limits.maxRecursionDepth) {
      this.abort('maxRecursionDepth', this.metrics.recursionDepth, this.limits.maxRecursionDepth);
    }

    if (this.limits.enableDetailedTracking) {
      logger.debug('Recursion depth increased', {
        depth: this.metrics.recursionDepth,
        limit: this.limits.maxRecursionDepth,
      });
    }
  }

  /**
   * Exit a recursion level
   */
  exitRecursion(): void {
    this.metrics.recursionDepth = Math.max(0, this.metrics.recursionDepth - 1);
  }

  /**
   * Check memory usage
   */
  checkMemory(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.metrics.memoryUsed = usage.heapUsed;
      
      if (this.metrics.memoryUsed > this.limits.maxMemoryBytes) {
        this.abort('maxMemoryBytes', this.metrics.memoryUsed, this.limits.maxMemoryBytes);
      }
    }
  }

  /**
   * Check if execution should be aborted
   */
  shouldAbort(): boolean {
    return this.abortController.signal.aborted;
  }

  /**
   * Get abort signal for fetch/axios
   */
  getAbortSignal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Complete execution successfully
   */
  complete(): ExecutionMetrics {
    this.metrics.endTime = Date.now();
    this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
    this.metrics.completed = true;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    logger.info('Agent execution completed', {
      duration: this.metrics.duration,
      llmCalls: this.metrics.llmCallCount,
      maxDepth: this.metrics.recursionDepth,
    });

    return { ...this.metrics };
  }

  /**
   * Abort execution due to limit violation
   */
  private abort(limit: keyof SafetyLimits, value: number, threshold: number): never {
    this.abortController.abort();
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.metrics.endTime = Date.now();
    this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
    this.metrics.limitViolations.push(limit);

    const error = new SafetyError(
      `Agent execution aborted: ${limit} exceeded (${value} > ${threshold})`,
      limit,
      value,
      threshold,
      { ...this.metrics }
    );

    logger.error('Agent execution aborted', error, {
      limit,
      value,
      threshold,
      metrics: this.metrics,
    });

    throw error;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ExecutionMetrics {
    return {
      ...this.metrics,
      duration: Date.now() - this.metrics.startTime,
    };
  }
}

/**
 * Execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  fn: (breaker: AgentCircuitBreaker) => Promise<T>,
  limits?: Partial<SafetyLimits>
): Promise<{ result: T; metrics: ExecutionMetrics }> {
  const breaker = new AgentCircuitBreaker(limits);
  
  try {
    breaker.start();
    const result = await fn(breaker);
    const metrics = breaker.complete();
    
    return { result, metrics };
  } catch (error) {
    if (error instanceof SafetyError) {
      // Re-throw safety errors
      throw error;
    }
    
    // Log other errors and re-throw
    logger.error('Agent execution failed', error instanceof Error ? error : undefined);
    throw error;
  }
}

/**
 * Wrap an LLM call with circuit breaker tracking
 */
export async function trackLLMCall<T>(
  breaker: AgentCircuitBreaker,
  fn: () => Promise<T>
): Promise<T> {
  breaker.recordLLMCall();
  breaker.checkMemory();
  
  if (breaker.shouldAbort()) {
    throw new Error('Execution aborted by circuit breaker');
  }
  
  return await fn();
}

/**
 * Wrap a recursive function with circuit breaker tracking
 */
export async function trackRecursion<T>(
  breaker: AgentCircuitBreaker,
  fn: () => Promise<T>
): Promise<T> {
  breaker.enterRecursion();
  
  try {
    if (breaker.shouldAbort()) {
      throw new Error('Execution aborted by circuit breaker');
    }
    
    return await fn();
  } finally {
    breaker.exitRecursion();
  }
}
