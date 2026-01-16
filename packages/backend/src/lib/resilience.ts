import {
  AppError,
  InternalError,
  ServiceUnavailableError,
  isAppError,
} from './errors';

type ErrorClassification = 'operational' | 'programmer';

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio?: number;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  cooldownMs: number;
  halfOpenSuccesses?: number;
}

export interface BulkheadOptions {
  maxConcurrent: number;
}

export interface ResilienceOptions {
  dependencyName: string;
  timeoutMs?: number;
  retry?: RetryOptions;
  circuitBreaker?: CircuitBreakerOptions;
  bulkhead?: BulkheadOptions;
  idempotent?: boolean;
  classifyError?: (error: unknown) => ErrorClassification;
}

const circuitBreakers = new Map<string, CircuitBreaker>();
const bulkheads = new Map<string, Bulkhead>();

export class DependencyUnavailableError extends ServiceUnavailableError {
  constructor(dependencyName: string, cause?: Error) {
    super(dependencyName, cause);
    this.name = 'DependencyUnavailableError';
  }
}

export class DependencyTimeoutError extends ServiceUnavailableError {
  constructor(dependencyName: string, cause?: Error) {
    super(dependencyName, cause);
    this.name = 'DependencyTimeoutError';
  }
}

export class CircuitOpenError extends ServiceUnavailableError {
  constructor(dependencyName: string, cause?: Error) {
    super(dependencyName, cause);
    this.name = 'CircuitOpenError';
  }
}

export class BulkheadRejectedError extends ServiceUnavailableError {
  constructor(dependencyName: string, cause?: Error) {
    super(dependencyName, cause);
    this.name = 'BulkheadRejectedError';
  }
}

class Bulkhead {
  private inFlight = 0;

  constructor(private readonly maxConcurrent: number) {}

  acquire(dependencyName: string): () => void {
    if (this.inFlight >= this.maxConcurrent) {
      throw new BulkheadRejectedError(dependencyName);
    }

    this.inFlight += 1;
    return () => {
      this.inFlight = Math.max(0, this.inFlight - 1);
    };
  }
}

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failureCount = 0;
  private halfOpenSuccesses = 0;
  private openedAt: number | null = null;

  constructor(private readonly options: CircuitBreakerOptions) {}

  canExecute(): boolean {
    if (this.state === 'open') {
      const openedAt = this.openedAt ?? 0;
      if (Date.now() - openedAt >= this.options.cooldownMs) {
        this.state = 'half_open';
        this.halfOpenSuccesses = 0;
        return true;
      }
      return false;
    }

    return true;
  }

  recordSuccess(): void {
    if (this.state === 'half_open') {
      this.halfOpenSuccesses += 1;
      const required = this.options.halfOpenSuccesses ?? 1;
      if (this.halfOpenSuccesses >= required) {
        this.reset();
      }
      return;
    }

    this.reset();
  }

  recordFailure(): void {
    if (this.state === 'half_open') {
      this.trip();
      return;
    }

    this.failureCount += 1;
    if (this.failureCount >= this.options.failureThreshold) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = 'open';
    this.openedAt = Date.now();
    this.failureCount = 0;
    this.halfOpenSuccesses = 0;
  }

  private reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.halfOpenSuccesses = 0;
    this.openedAt = null;
  }
}

export const isIdempotentMethod = (method?: string): boolean => {
  const normalized = (method ?? 'GET').toUpperCase();
  return ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'].includes(normalized);
};

export async function executeWithResilience<T>(
  operation: () => Promise<T>,
  options: ResilienceOptions
): Promise<T> {
  const circuitBreaker = options.circuitBreaker
    ? getCircuitBreaker(options.dependencyName, options.circuitBreaker)
    : undefined;
  const bulkhead = options.bulkhead
    ? getBulkhead(options.dependencyName, options.bulkhead)
    : undefined;
  const maxAttempts = options.retry?.attempts ?? 1;
  const allowRetry = options.idempotent ?? true;

  let attempt = 0;
  let lastError: Error | undefined;

  while (attempt < maxAttempts) {
    if (circuitBreaker && !circuitBreaker.canExecute()) {
      throw new CircuitOpenError(options.dependencyName);
    }

    let release: (() => void) | undefined;
    try {
      if (bulkhead) {
        release = bulkhead.acquire(options.dependencyName);
      }

      const result = await withTimeout(operation(), options.timeoutMs, options.dependencyName);
      circuitBreaker?.recordSuccess();
      return result;
    } catch (error) {
      const classification = classifyError(error, options);
      if (classification === 'programmer') {
        throw normalizeProgrammerError(error);
      }

      const operationalError = normalizeOperationalError(error, options.dependencyName);
      circuitBreaker?.recordFailure();
      lastError = operationalError;
      attempt += 1;

      if (!allowRetry || attempt >= maxAttempts) {
        break;
      }

      const delayMs = calculateDelay(options.retry, attempt);
      await sleep(delayMs);
    } finally {
      release?.();
    }
  }

  if (lastError) {
    throw lastError;
  }
  
  // This should only happen if maxAttempts is 0 or negative
  throw new DependencyUnavailableError(options.dependencyName);
}

export async function resilientFetch(
  url: string,
  init: RequestInit | undefined,
  options: ResilienceOptions
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const method = init?.method ?? 'GET';
  const idempotent = options.idempotent ?? isIdempotentMethod(method);

  return executeWithResilience(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const signal = mergeAbortSignals(init?.signal, controller.signal);

      try {
        return await fetch(url, { ...init, signal });
      } finally {
        clearTimeout(timeoutId);
      }
    },
    {
      ...options,
      timeoutMs,
      idempotent,
    }
  );
}

function getCircuitBreaker(key: string, options: CircuitBreakerOptions): CircuitBreaker {
  if (!circuitBreakers.has(key)) {
    circuitBreakers.set(key, new CircuitBreaker(options));
  }

  return circuitBreakers.get(key)!;
}

function getBulkhead(key: string, options: BulkheadOptions): Bulkhead {
  if (!bulkheads.has(key)) {
    bulkheads.set(key, new Bulkhead(options.maxConcurrent));
  }

  return bulkheads.get(key)!;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  dependencyName: string
): Promise<T> {
  if (!timeoutMs) {
    return promise;
  }

  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new DependencyTimeoutError(dependencyName));
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }),
    timeoutPromise,
  ]);
}

function calculateDelay(retry: RetryOptions | undefined, attempt: number): number {
  if (!retry) {
    return 0;
  }

  const exponent = Math.pow(2, Math.max(0, attempt - 1));
  const baseDelay = retry.baseDelayMs * exponent;
  const capped = Math.min(baseDelay, retry.maxDelayMs);
  const jitterRatio = retry.jitterRatio ?? 0.2;
  const jitter = capped * jitterRatio * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(capped + jitter));
}

async function sleep(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function classifyError(error: unknown, options: ResilienceOptions): ErrorClassification {
  if (options.classifyError) {
    return options.classifyError(error);
  }

  if (isAppError(error)) {
    return error.isOperational ? 'operational' : 'programmer';
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      error.name === 'AbortError' ||
      message.includes('timeout') ||
      message.includes('fetch') ||
      message.includes('econn')
    ) {
      return 'operational';
    }

    if (['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError'].includes(error.name)) {
      return 'programmer';
    }
  }

  return 'operational';
}

function normalizeProgrammerError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message, error);
  }

  return new InternalError('Unexpected failure');
}

function normalizeOperationalError(error: unknown, dependencyName: string): Error {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new DependencyTimeoutError(dependencyName, error);
    }

    return new DependencyUnavailableError(dependencyName, error);
  }

  return new DependencyUnavailableError(dependencyName);
}

function mergeAbortSignals(
  primary: AbortSignal | null | undefined,
  secondary: AbortSignal
): AbortSignal {
  if (!primary) {
    return secondary;
  }

  const abortSignalAny = (AbortSignal as typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal;
  }).any;
  if (abortSignalAny) {
    return abortSignalAny([primary, secondary]);
  }

  const controller = new AbortController();
  const handleAbort = () => controller.abort();
  primary.addEventListener('abort', handleAbort, { once: true });
  secondary.addEventListener('abort', handleAbort, { once: true });
  return controller.signal;
}
