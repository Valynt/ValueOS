/**
 * Retry Strategy
 * 
 * Implements various retry strategies for failed operations including
 * immediate, exponential backoff, and manual retry.
 */

/**
 * Retry strategy type
 */
export type RetryStrategyType = 'immediate' | 'exponential' | 'linear' | 'manual';

/**
 * Retry configuration
 */
export interface RetryConfig {
  /**
   * Strategy type
   */
  strategy: RetryStrategyType;

  /**
   * Maximum number of retry attempts
   */
  maxAttempts: number;

  /**
   * Initial delay in milliseconds
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds
   */
  maxDelay?: number;

  /**
   * Backoff multiplier for exponential strategy
   */
  backoffMultiplier?: number;

  /**
   * Jitter to add randomness (0-1)
   */
  jitter?: number;

  /**
   * Timeout for each attempt in milliseconds
   */
  timeout?: number;

  /**
   * Callback on retry attempt
   */
  onRetry?: (attempt: number, error: Error) => void;

  /**
   * Callback on final failure
   */
  onFailure?: (error: Error, attempts: number) => void;

  /**
   * Function to determine if error is retryable
   */
  isRetryable?: (error: Error) => boolean;
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG: Partial<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: 0.1,
  timeout: 10000,
};

/**
 * Retry Strategy Service
 */
export class RetryStrategy {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      onRetry: config.onRetry || (() => {}),
      onFailure: config.onFailure || (() => {}),
      isRetryable: config.isRetryable || (() => true),
    } as Required<RetryConfig>;
  }

  /**
   * Execute operation with retry
   */
  public async execute<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.config.maxAttempts) {
      attempt++;

      try {
        // Execute with timeout
        const value = await this.executeWithTimeout(operation, this.config.timeout);

        return {
          success: true,
          value,
          attempts: attempt,
          totalTime: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.config.isRetryable(lastError)) {
          break;
        }

        // Call retry callback
        this.config.onRetry(attempt, lastError);

        // If not last attempt, wait before retrying
        if (attempt < this.config.maxAttempts) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    const error = lastError || new Error('Operation failed');
    this.config.onFailure(error, attempt);

    return {
      success: false,
      error,
      attempts: attempt,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Calculate delay based on strategy
   */
  private calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.config.strategy) {
      case 'immediate':
        delay = 0;
        break;

      case 'linear':
        delay = this.config.initialDelay * attempt;
        break;

      case 'exponential':
        delay = this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
        break;

      case 'manual':
        // Manual strategy doesn't auto-retry
        delay = Infinity;
        break;

      default:
        delay = this.config.initialDelay;
    }

    // Apply max delay cap
    delay = Math.min(delay, this.config.maxDelay);

    // Apply jitter
    if (this.config.jitter > 0) {
      const jitterAmount = delay * this.config.jitter;
      delay += (Math.random() * 2 - 1) * jitterAmount;
    }

    return Math.max(0, delay);
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      ),
    ]);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create retry strategy
 */
export function createRetryStrategy(config: RetryConfig): RetryStrategy {
  return new RetryStrategy(config);
}

/**
 * Retry with immediate strategy
 */
export async function retryImmediate<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<RetryResult<T>> {
  const strategy = new RetryStrategy({
    strategy: 'immediate',
    maxAttempts,
  });
  return strategy.execute(operation);
}

/**
 * Retry with exponential backoff
 */
export async function retryExponential<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 1000
): Promise<RetryResult<T>> {
  const strategy = new RetryStrategy({
    strategy: 'exponential',
    maxAttempts,
    initialDelay,
  });
  return strategy.execute(operation);
}

/**
 * Retry with linear backoff
 */
export async function retryLinear<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 1000
): Promise<RetryResult<T>> {
  const strategy = new RetryStrategy({
    strategy: 'linear',
    maxAttempts,
    initialDelay,
  });
  return strategy.execute(operation);
}

/**
 * Check if error is network error
 */
export function isNetworkError(error: Error): boolean {
  return (
    error.message.includes('network') ||
    error.message.includes('fetch') ||
    error.message.includes('timeout') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ETIMEDOUT')
  );
}

/**
 * Check if error is server error (5xx)
 */
export function isServerError(error: any): boolean {
  return error.status >= 500 && error.status < 600;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  return isNetworkError(error) || isServerError(error);
}

export default RetryStrategy;
