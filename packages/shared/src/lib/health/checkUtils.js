/**
 * Shared health check utilities
 * Common functions for health validation across different contexts
 */
import https from "https";
import http from "http";
import net from "net";
import { execSync } from "child_process";
/**
 * Circuit breaker states
 */
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "closed";
    CircuitState["OPEN"] = "open";
    CircuitState["HALF_OPEN"] = "half_open";
})(CircuitState || (CircuitState = {}));
/**
 * Circuit breaker for health checks
 */
class CircuitBreaker {
    constructor(failureThreshold = 5, recoveryTimeout = 60000, // 1 minute
    monitoringPeriod = 300000 // 5 minutes
    ) {
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
        this.monitoringPeriod = monitoringPeriod;
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.nextAttemptTime = 0;
    }
    async execute(operation) {
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
        }
        catch (error) {
            this.failureCount++;
            this.lastFailureTime = now;
            if (this.failureCount >= this.failureThreshold) {
                this.state = CircuitState.OPEN;
                this.nextAttemptTime = now + this.recoveryTimeout;
            }
            else if (this.state === CircuitState.HALF_OPEN) {
                // Failed during recovery attempt
                this.state = CircuitState.OPEN;
                this.nextAttemptTime = now + this.recoveryTimeout;
            }
            throw error;
        }
    }
    getState() {
        return this.state;
    }
    getFailureCount() {
        return this.failureCount;
    }
    getLastFailureTime() {
        return this.lastFailureTime;
    }
    getNextAttemptTime() {
        return this.nextAttemptTime;
    }
    reset() {
        this.failureCount = 0;
        this.state = CircuitState.CLOSED;
        this.lastFailureTime = 0;
        this.nextAttemptTime = 0;
    }
    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.failureThreshold) {
            this.state = CircuitState.OPEN;
            this.nextAttemptTime = Date.now() + this.recoveryTimeout;
        }
    }
}
// Global circuit breakers for different services
const circuitBreakers = new Map();
/**
 * Get or create circuit breaker for a service
 */
function getCircuitBreaker(serviceName) {
    if (!circuitBreakers.has(serviceName)) {
        circuitBreakers.set(serviceName, new CircuitBreaker());
    }
    return circuitBreakers.get(serviceName);
}
/**
 * Check HTTP/HTTPS endpoint with circuit breaker
 */
export async function checkHttpEndpoint(url, timeout = 5000) {
    const circuitBreaker = getCircuitBreaker(`http:${url}`);
    try {
        const result = await circuitBreaker.execute(async () => {
            const startTime = Date.now();
            return new Promise((resolve) => {
                const client = url.startsWith("https:") ? https : http;
                const req = client.get(url, { timeout }, (res) => {
                    const responseTime = Date.now() - startTime;
                    const isHealthy = Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300);
                    res.on("data", () => { }); // Consume response
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
                req.on("error", (err) => {
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
    }
    catch {
        return {
            healthy: false,
            message: "Circuit breaker open - service temporarily unavailable",
        };
    }
}
/**
 * Check if a Docker service is running with circuit breaker
 */
export function checkDockerService(serviceName, projectRoot) {
    const circuitBreaker = getCircuitBreaker(`docker:${serviceName}`);
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
        if (circuitBreaker.getState() === "open") {
            const nextAttempt = circuitBreaker.getNextAttemptTime();
            if (now < nextAttempt) {
                return {
                    healthy: false,
                    message: "Circuit breaker open - service temporarily unavailable",
                };
            }
        }
        const output = execSync(`docker compose ps ${serviceName}`, {
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
    }
    catch (error) {
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
export async function isPortInUse(port, host = "127.0.0.1") {
    return new Promise((resolve) => {
        const tester = net
            .createServer()
            .once("error", (error) => {
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
export function commandExists(command) {
    try {
        execSync(`command -v ${command}`, { stdio: "ignore" });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Run a command and return its output
 */
export function runCommand(command, options = {}) {
    return execSync(command, {
        cwd: options.cwd,
        stdio: "pipe",
        encoding: "utf8",
        timeout: options.timeout,
        ...options,
    });
}
//# sourceMappingURL=checkUtils.js.map