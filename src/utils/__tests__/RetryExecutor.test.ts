import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CompensatorExecutor,
  InMemoryLogger,
  InMemoryMetricsRecorder,
  NonRetryableError,
  RetryableError,
  TaskExecutor
} from '../../lib/workflow/RetryExecutor';
import { parseRetryPolicy } from '../../lib/retry/policies';

describe('Retry executors', () => {
  let metrics: InMemoryMetricsRecorder;
  let logger: InMemoryLogger;

  beforeEach(() => {
    metrics = new InMemoryMetricsRecorder();
    logger = new InMemoryLogger();
    vi.useFakeTimers();
    vi.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('skips retries for non-retryable errors', async () => {
    const executor = new TaskExecutor({ metrics, logger });
    const task = vi.fn().mockRejectedValue(new NonRetryableError('fatal'));

    await expect(executor.execute(task)).rejects.toThrow('fatal');
    expect(task).toHaveBeenCalledTimes(1);
    expect(metrics.attempts).toHaveLength(1);
    expect(metrics.failures).toHaveLength(1);
    expect(logger.entries.some(entry => entry.message === 'task_aborted')).toBe(true);
  });

  it('retries retryable errors using policy parameters', async () => {
    const executor = new TaskExecutor({
      metrics,
      logger,
      policy: {
        name: 'custom',
        max_attempts: 4,
        initial_delay_ms: 10,
        max_delay_ms: 50,
        multiplier: 2,
        jitter: false,
        max_elapsed_ms: 200
      }
    });

    let attempt = 0;
    const task = vi.fn().mockImplementation(() => {
      attempt++;
      if (attempt < 3) {
        throw new RetryableError('transient');
      }
      return 'success';
    });

    const execution = executor.execute(task);
    await vi.runAllTimersAsync();
    await expect(execution).resolves.toBe('success');

    expect(task).toHaveBeenCalledTimes(3);
    expect(metrics.attempts.map((a) => a.attempt)).toEqual([1, 2, 3]);
    expect(logger.entries.filter(entry => entry.message === 'task_retrying')).toHaveLength(2);
  });

  it('records metrics and logs for compensator execution', async () => {
    const compensator = new CompensatorExecutor({ metrics, logger, policy: 'conservative' });
    const task = vi.fn().mockImplementationOnce(() => {
      throw new RetryableError('compensate');
    }).mockResolvedValue('ok');

    const resultPromise = compensator.execute(task);
    await vi.runAllTimersAsync();
    await expect(resultPromise).resolves.toBe('ok');

    const policyUsed = parseRetryPolicy('conservative');
    expect(metrics.attempts[0].policy.max_attempts).toBe(policyUsed.max_attempts);
    expect(metrics.successes).toHaveLength(1);
    expect(logger.entries.find(entry => entry.message === 'task_success')).toBeTruthy();
    expect(logger.entries.some(entry => entry.message === 'task_retrying')).toBe(true);
  });
});
