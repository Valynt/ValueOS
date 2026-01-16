import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type PendingQuery, type Sql } from "postgres";

type OperationKind = "read" | "write";

type RetryOptions = {
  operation: OperationKind;
  idempotencyKey?: string;
  isIdempotent?: boolean;
  requestTimeoutMs?: number;
  maxAttempts?: number;
};

type CircuitBreakerState = "closed" | "open" | "half-open";

const DEFAULTS = {
  poolMax: 10,
  poolMin: 0,
  idleTimeoutSeconds: 20,
  connectTimeoutSeconds: 10,
  statementTimeoutMs: 30_000,
  requestTimeoutMs: 15_000,
  retryMaxAttempts: 3,
  retryBaseDelayMs: 100,
  retryMaxDelayMs: 2_000,
  retryJitterMs: 100,
  circuitBreakerEnabled: true,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerResetTimeoutMs: 30_000,
  circuitBreakerHalfOpenMax: 2,
} as const;

const TRANSIENT_PG_ERROR_CODES = new Set([
  "40001", // serialization_failure
  "40P01", // deadlock_detected
  "55P03", // lock_not_available
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "08000", // connection_exception
  "08003", // connection_does_not_exist
  "08006", // connection_failure
  "53300", // too_many_connections
]);

let _db: ReturnType<typeof drizzle> | null = null;
let _client: Sql | null = null;
let _connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

const envNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const envBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  return value.toLowerCase() === "true";
};

export const dbConfig = {
  pool: {
    max: envNumber(process.env.DATABASE_POOL_MAX, DEFAULTS.poolMax),
    min: envNumber(process.env.DATABASE_POOL_MIN, DEFAULTS.poolMin),
    idleTimeoutSeconds: envNumber(
      process.env.DATABASE_POOL_IDLE_TIMEOUT_SECONDS,
      DEFAULTS.idleTimeoutSeconds,
    ),
  },
  timeouts: {
    connectTimeoutSeconds: envNumber(
      process.env.DATABASE_CONNECT_TIMEOUT_SECONDS,
      DEFAULTS.connectTimeoutSeconds,
    ),
    statementTimeoutMs: envNumber(
      process.env.DATABASE_STATEMENT_TIMEOUT_MS,
      DEFAULTS.statementTimeoutMs,
    ),
    requestTimeoutMs: envNumber(
      process.env.DATABASE_REQUEST_TIMEOUT_MS,
      DEFAULTS.requestTimeoutMs,
    ),
  },
  retry: {
    maxAttempts: envNumber(process.env.DATABASE_RETRY_MAX_ATTEMPTS, DEFAULTS.retryMaxAttempts),
    baseDelayMs: envNumber(process.env.DATABASE_RETRY_BASE_DELAY_MS, DEFAULTS.retryBaseDelayMs),
    maxDelayMs: envNumber(process.env.DATABASE_RETRY_MAX_DELAY_MS, DEFAULTS.retryMaxDelayMs),
    jitterMs: envNumber(process.env.DATABASE_RETRY_JITTER_MS, DEFAULTS.retryJitterMs),
  },
  circuitBreaker: {
    enabled: envBoolean(
      process.env.DATABASE_CIRCUIT_BREAKER_ENABLED,
      DEFAULTS.circuitBreakerEnabled,
    ),
    failureThreshold: envNumber(
      process.env.DATABASE_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      DEFAULTS.circuitBreakerFailureThreshold,
    ),
    resetTimeoutMs: envNumber(
      process.env.DATABASE_CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
      DEFAULTS.circuitBreakerResetTimeoutMs,
    ),
    halfOpenMax: envNumber(
      process.env.DATABASE_CIRCUIT_BREAKER_HALF_OPEN_MAX,
      DEFAULTS.circuitBreakerHalfOpenMax,
    ),
  },
} as const;

class DbCircuitBreaker {
  private state: CircuitBreakerState = "closed";
  private failureCount = 0;
  private lastFailureAt = 0;
  private halfOpenInFlight = 0;

  isOpen() {
    if (!dbConfig.circuitBreaker.enabled) {
      return false;
    }

    if (this.state === "open") {
      const elapsed = Date.now() - this.lastFailureAt;
      if (elapsed >= dbConfig.circuitBreaker.resetTimeoutMs) {
        this.state = "half-open";
        this.halfOpenInFlight = 0;
        return false;
      }
      return true;
    }

    if (this.state === "half-open") {
      return this.halfOpenInFlight >= dbConfig.circuitBreaker.halfOpenMax;
    }

    return false;
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = "closed";
    this.halfOpenInFlight = 0;
  }

  onFailure() {
    this.failureCount += 1;
    this.lastFailureAt = Date.now();

    if (this.state === "half-open") {
      this.state = "open";
      return;
    }

    if (this.failureCount >= dbConfig.circuitBreaker.failureThreshold) {
      this.state = "open";
    }
  }

  registerHalfOpenAttempt() {
    if (this.state === "half-open") {
      this.halfOpenInFlight += 1;
    }
  }
}

const circuitBreaker = new DbCircuitBreaker();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientPostgresError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: string }).code;
  return !!code && TRANSIENT_PG_ERROR_CODES.has(code);
};

const computeRetryDelay = (attempt: number) => {
  const base = dbConfig.retry.baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * dbConfig.retry.jitterMs);
  return Math.min(base + jitter, dbConfig.retry.maxDelayMs);
};

export const executeWithTimeout = async <T>(
  query: PendingQuery<T>,
  timeoutMs: number,
): Promise<T> => {
  const timer = setTimeout(() => query.cancel(), timeoutMs);
  try {
    return await query;
  } finally {
    clearTimeout(timer);
  }
};

const withRequestTimeout = async <T>(
  operation: () => Promise<T>,
  timeoutMs = dbConfig.timeouts.requestTimeoutMs,
): Promise<T> => {
  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Database request timeout")), timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  const shouldRetryWrites =
    options.operation === "read" || options.isIdempotent || !!options.idempotencyKey;
  const maxAttempts = shouldRetryWrites
    ? options.maxAttempts ?? dbConfig.retry.maxAttempts
    : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (circuitBreaker.isOpen()) {
      throw new Error("[Database] Circuit breaker open - refusing new requests");
    }

    circuitBreaker.registerHalfOpenAttempt();

    try {
      const result = await withRequestTimeout(operation, options.requestTimeoutMs);
      circuitBreaker.onSuccess();
      return result;
    } catch (error) {
      circuitBreaker.onFailure();

      if (!isTransientPostgresError(error) || attempt === maxAttempts) {
        throw error;
      }

      const delay = computeRetryDelay(attempt);
      await sleep(delay);
    }
  }

  throw new Error("[Database] Retry policy exhausted");
};

const createSqlClient = () => {
  return postgres(process.env.DATABASE_URL ?? "", {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    idle_timeout: dbConfig.pool.idleTimeoutSeconds,
    connect_timeout: dbConfig.timeouts.connectTimeoutSeconds,
    connection: {
      statement_timeout: dbConfig.timeouts.statementTimeoutMs,
      application_name: "vosacademy",
    },
    onnotice: () => {},
  });
};

/**
 * Get database connection with retry logic
 */
export async function getDbConnection() {
  if (_db) {
    return _db;
  }

  if (!process.env.DATABASE_URL) {
    console.error("[Database] DATABASE_URL not configured");
    return null;
  }

  if (_connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    console.error("[Database] Max connection attempts reached");
    return null;
  }

  try {
    _connectionAttempts += 1;
    console.log(`[Database] Connecting... (attempt ${_connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`);

    _client = createSqlClient();
    _db = drizzle(_client);

    await executeWithTimeout(_client`SELECT 1`, dbConfig.timeouts.requestTimeoutMs);

    console.log("[Database] Connected successfully");
    _connectionAttempts = 0;

    return _db;
  } catch (error) {
    console.error(`[Database] Connection failed (attempt ${_connectionAttempts}):`, error);
    _db = null;
    _client = null;

    if (_connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      const delay = computeRetryDelay(_connectionAttempts);
      console.log(`[Database] Retrying in ${delay}ms...`);
      await sleep(delay);
      return getDbConnection();
    }

    return null;
  }
}

export const getSqlClient = () => _client;

/**
 * Close database connection (for graceful shutdown)
 */
export async function closeDbConnection() {
  if (_client) {
    await _client.end({ timeout: 5 });
    _client = null;
    _db = null;
    console.log("[Database] Connection closed");
  }
}

/**
 * Check if database is connected
 */
export function isDbConnected(): boolean {
  return _db !== null && _client !== null;
}
