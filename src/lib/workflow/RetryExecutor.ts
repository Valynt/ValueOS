import { calculateBackoffDelay, isRetryableError, sleep } from '../retry/backoff';
import { RetryPolicy, RetryPolicyInput, parseRetryPolicy } from '../retry/policies';

export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class NonRetryableError extends Error {
  public readonly retryable = false;
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

export interface ExecutionLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
}

export interface MetricsRecorder {
  recordAttempt(executor: string, attempt: number, policy: RetryPolicy): void;
  recordSuccess(executor: string, attempt: number): void;
  recordFailure(executor: string, attempt: number, error: unknown): void;
}

export class InMemoryMetricsRecorder implements MetricsRecorder {
  public attempts: Array<{ executor: string; attempt: number; policy: RetryPolicy }> = [];
  public successes: Array<{ executor: string; attempt: number }> = [];
  public failures: Array<{ executor: string; attempt: number; error: unknown }> = [];

  recordAttempt(executor: string, attempt: number, policy: RetryPolicy): void {
    this.attempts.push({ executor, attempt, policy });
  }

  recordSuccess(executor: string, attempt: number): void {
    this.successes.push({ executor, attempt });
  }

  recordFailure(executor: string, attempt: number, error: unknown): void {
    this.failures.push({ executor, attempt, error });
  }
}

export class InMemoryLogger {
  public entries: ExecutionLogEntry[] = [];

  info(message: string, context?: Record<string, any>) {
    this.entries.push({ level: 'info', message, context });
  }

  warn(message: string, context?: Record<string, any>) {
    this.entries.push({ level: 'warn', message, context });
  }

  error(message: string, context?: Record<string, any>) {
    this.entries.push({ level: 'error', message, context });
  }
}

interface RetryExecutorOptions {
  policy?: RetryPolicyInput;
  logger?: Pick<InMemoryLogger, 'info' | 'warn' | 'error'>;
  metrics?: MetricsRecorder;
}

export class TaskExecutor {
  private readonly logger: Pick<InMemoryLogger, 'info' | 'warn' | 'error'>;
  private readonly metrics: MetricsRecorder;
  private readonly policy: RetryPolicy;

  constructor(options: RetryExecutorOptions = {}) {
    this.logger = options.logger ?? console;
    this.metrics = options.metrics ?? new InMemoryMetricsRecorder();
    this.policy = parseRetryPolicy(options.policy);
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    let attempt = 0;

    while (attempt < this.policy.max_attempts) {
      attempt++;
      this.metrics.recordAttempt('task', attempt, this.policy);
      this.logger.info('task_attempt', { attempt });

      try {
        const result = await operation();
        this.metrics.recordSuccess('task', attempt);
        this.logger.info('task_success', { attempt });
        return result;
      } catch (error) {
        this.metrics.recordFailure('task', attempt, error);
        const retryable = isRetryableError(error, this.policy);
        const canRetry = retryable && attempt < this.policy.max_attempts;

        this.logger.warn('task_failure', { attempt, retryable, error: (error as Error).message });

        if (!canRetry) {
          this.logger.error('task_aborted', { attempt, error: (error as Error).message });
          throw error;
        }

        const delay = calculateBackoffDelay(attempt, this.policy, startTime);
        if (delay === null) {
          this.logger.error('task_aborted_max_elapsed', { attempt, error: (error as Error).message });
          throw error;
        }

        this.logger.info('task_retrying', { attempt, next_delay_ms: delay });
        await sleep(delay);
      }
    }

    throw new Error('Execution should return or throw before this line');
  }
}

export class CompensatorExecutor extends TaskExecutor {
  constructor(options: RetryExecutorOptions = {}) {
    super({ ...options, policy: options.policy ?? 'conservative' });
  }
}
