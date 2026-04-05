/**
 * Shared health check utilities
 * Common functions for health validation across different contexts
 */

import { execFileSync, spawnSync } from "child_process";
import http from "http";
import https from "https";
import net from "net";

export interface HealthCheckResult {
  healthy: boolean;
  message: string;
  latency?: number;
}

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = "closed", // Normal operation
  OPEN = "open", // Failing, skip checks
  HALF_OPEN = "half_open", // Testing recovery
}

/**
 * Circuit breaker for health checks
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000, // 1 minute
    private readonly monitoringPeriod: number = 300000 // 5 minutes
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T | null> {
    const now = Date.now();

    // Reset failure count if monitoring period has passed
    if (now - this.lastFailureTime > this.monitoringPeriod) {
      this.failureCount = 0;
      this.state = CircuitState.CLOSED;
    }

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (now < this.nextAttemptTime) {
        return null; // Skip the operation
      }
      // Time to try again
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await operation();

      // Success - reset circuit
      this.failureCount = 0;
      this.state = CircuitState.CLOSED;

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = now;

      if (this.failureCount >= this.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = now + this.recoveryTimeout;
      } else if (this.state === CircuitState.HALF_OPEN) {
        // Failed during recovery attempt
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = now + this.recoveryTimeout;
      }

      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getLastFailureTime(): number {
    return this.lastFailureTime;
  }

  getNextAttemptTime(): number {
    return this.nextAttemptTime;
  }

  reset(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.recoveryTimeout;
    }
  }
}

const SERVICE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const SAFE_TOKEN_PATTERN = /^[a-zA-Z0-9._/:=-]+$/;
const DIAGNOSTIC_COMMAND_ALLOWLIST = new Set(["docker", "which", "node", "pnpm", "npm", "git"]);
const SHELL_METACHARACTER_PATTERN = /[|&;<>`$\\\n\r]/;

function hasShellMetacharacters(value: string): boolean {
  return SHELL_METACHARACTER_PATTERN.test(value);
}

function isValidToken(token: string): boolean {
  return token.length > 0 && SAFE_TOKEN_PATTERN.test(token) && !hasShellMetacharacters(token);
}

// Global circuit breakers for different services
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create circuit breaker for a service
 */
function getCircuitBreaker(serviceName: string): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker());
  }
  return circuitBreakers.get(serviceName)!;
}

/**
 * Check HTTP/HTTPS endpoint with circuit breaker
 */
export async function checkHttpEndpoint(
  url: string,
  timeout: number = 5000
): Promise<HealthCheckResult> {
  const circuitBreaker = getCircuitBreaker(`http:${url}`);

  try {
    const result = await circuitBreaker.execute(async () => {
      const startTime = Date.now();

      return new Promise<HealthCheckResult>((resolve) => {
        const client = url.startsWith("https:") ? https : http;
        const req = client.get(url, { timeout }, (res) => {
          const responseTime = Date.now() - startTime;
          const isHealthy = Boolean(
            res.statusCode && res.statusCode >= 200 && res.statusCode < 300
          );

          res.on("data", () => {}); // Consume response
          res.on("end", () => {
            resolve({
              healthy: isHealthy,
              message: isHealthy
                ? `HTTP ${res.statusCode} (${responseTime}ms)`
                : `HTTP ${res.statusCode}`,
              latency: responseTime,
            });
          });
        });

        req.on("error", (err: NodeJS.ErrnoException) => {
          resolve({
            healthy: false,
            message: err.code || err.message || "Connection error",
            latency: Date.now() - startTime,
          });
        });

        req.on("timeout", () => {
          req.destroy();
          resolve({
            healthy: false,
            message: "timeout",
            latency: Date.now() - startTime,
          });
        });
      });
    });

    // Handle null result from circuit breaker (circuit is open)
    if (result === null) {
      return {
        healthy: false,
        message: "Circuit breaker open - service temporarily unavailable",
      };
    }

    return result;
  } catch {
    return {
      healthy: false,
      message: "Circuit breaker open - service temporarily unavailable",
    };
  }
}

/**
 * Check if a Docker service is running with circuit breaker
 */
export function checkDockerService(serviceName: string, projectRoot: string): HealthCheckResult {
  const circuitBreaker = getCircuitBreaker(`docker:${serviceName}`);

  if (!SERVICE_NAME_PATTERN.test(serviceName)) {
    return {
      healthy: false,
      message: "invalid service name",
    };
  }

  try {
    // For synchronous operations, we need to check circuit breaker state manually
    const now = Date.now();

    // Reset failure count if monitoring period has passed
    const lastFailure = circuitBreaker.getLastFailureTime();
    if (now - lastFailure > 300000) {
      // 5 minutes
      circuitBreaker.reset();
    }

    // Check if circuit is open
    if (circuitBreaker.getState() === CircuitState.OPEN) {
      const nextAttempt = circuitBreaker.getNextAttemptTime();
      if (now < nextAttempt) {
        return {
          healthy: false,
          message: "Circuit breaker open - service temporarily unavailable",
        };
      }
    }

    const output = execFileSync("docker", ["compose", "ps", serviceName], {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: 10000,
    });

    const isRunning = output.includes(serviceName) && !output.includes("Exit");

    // Success - reset circuit breaker
    circuitBreaker.reset();

    return {
      healthy: isRunning,
      message: isRunning ? "running" : "not running",
    };
  } catch {
    // Record failure in circuit breaker
    circuitBreaker.recordFailure();

    return {
      healthy: false,
      message: "Circuit breaker open - service temporarily unavailable",
    };
  }
}

/**
 * Check if a port is in use
 */
export async function isPortInUse(port: number, host: string = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", (error: NodeJS.ErrnoException) => {
        resolve(error.code === "EADDRINUSE");
      })
      .once("listening", () => {
        tester.close(() => resolve(false));
      })
      .listen(port, host);
  });
}

/**
 * Check if a command exists in PATH
 */
export function commandExists(command: string): boolean {
  if (!isValidToken(command)) {
    return false;
  }

  const result = spawnSync("which", [command], {
    stdio: "ignore",
    shell: false,
  });

  return result.status === 0;
}

export interface DiagnosticCommand {
  cmd: string;
  args: string[];
}

/**
 * Run a command and return its output
 */
export function runCommand(
  command: DiagnosticCommand,
  options: { cwd?: string; timeout?: number } = {}
): string {
  if (!isValidToken(command.cmd)) {
    throw new Error("Invalid command token");
  }

  if (!DIAGNOSTIC_COMMAND_ALLOWLIST.has(command.cmd)) {
    throw new Error(`Command '${command.cmd}' is not allowed`);
  }

  if (!Array.isArray(command.args) || !command.args.every((arg) => isValidToken(arg))) {
    throw new Error("Invalid command arguments");
  }

  return execFileSync(command.cmd, command.args, {
    cwd: options.cwd,
    stdio: "pipe",
    encoding: "utf8",
    timeout: options.timeout,
  });
}
