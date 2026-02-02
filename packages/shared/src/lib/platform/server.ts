/**
 * Server Platform Utilities
 *
 * Server-specific utilities that require Node.js APIs.
 * This module should only be imported in server/Node.js contexts.
 *
 * @module @valueos/shared/platform/server
 */

/**
 * Check if code is running in a Node.js environment
 */
export function isServer(): boolean {
  return typeof process !== "undefined" && process.versions?.node !== undefined;
}

/**
 * Get an environment variable with optional default
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  if (!isServer()) {
    return defaultValue;
  }

  return process.env[key] ?? defaultValue;
}

/**
 * Get a required environment variable, throws if missing
 */
export function requireEnv(key: string): string {
  if (!isServer()) {
    throw new Error(`Cannot access environment variables outside of server context`);
  }

  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

/**
 * Get the current working directory
 */
export function getCwd(): string {
  if (!isServer()) {
    return "/";
  }

  return process.cwd();
}

/**
 * Get the Node.js version
 */
export function getNodeVersion(): string {
  if (!isServer()) {
    return "unknown";
  }

  return process.versions.node;
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  if (!isServer()) {
    return false;
  }

  return process.env.NODE_ENV === "production";
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  if (!isServer()) {
    return false;
  }

  return process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  if (!isServer()) {
    return false;
  }

  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

/**
 * Get memory usage in MB
 */
export function getMemoryUsage(): { heapUsed: number; heapTotal: number; rss: number } {
  if (!isServer()) {
    return { heapUsed: 0, heapTotal: 0, rss: 0 };
  }

  const usage = process.memoryUsage();
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    rss: Math.round(usage.rss / 1024 / 1024),
  };
}

/**
 * Get process uptime in seconds
 */
export function getUptime(): number {
  if (!isServer()) {
    return 0;
  }

  return Math.round(process.uptime());
}

/**
 * Exit the process with a code
 */
export function exit(code: number = 0): never {
  if (!isServer()) {
    throw new Error("Cannot exit process outside of server context");
  }

  process.exit(code);
}

/**
 * Register a handler for uncaught exceptions
 */
export function onUncaughtException(handler: (error: Error) => void): void {
  if (!isServer()) {
    return;
  }

  process.on("uncaughtException", handler);
}

/**
 * Register a handler for unhandled promise rejections
 */
export function onUnhandledRejection(handler: (reason: unknown) => void): void {
  if (!isServer()) {
    return;
  }

  process.on("unhandledRejection", handler);
}

/**
 * Register a handler for process termination signals
 */
export function onShutdown(handler: () => void | Promise<void>): void {
  if (!isServer()) {
    return;
  }

  const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT", "SIGHUP"];

  for (const signal of signals) {
    process.on(signal, async () => {
      await handler();
      process.exit(0);
    });
  }
}
