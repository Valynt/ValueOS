/**
 * Shared health check utilities
 * Common functions for health validation across different contexts
 */
export interface HealthCheckResult {
    healthy: boolean;
    message: string;
    latency?: number;
}
/**
 * Check HTTP/HTTPS endpoint with circuit breaker
 */
export declare function checkHttpEndpoint(url: string, timeout?: number): Promise<HealthCheckResult>;
/**
 * Check if a Docker service is running with circuit breaker
 */
export declare function checkDockerService(serviceName: string, projectRoot: string): HealthCheckResult;
/**
 * Check if a port is in use
 */
export declare function isPortInUse(port: number, host?: string): Promise<boolean>;
/**
 * Check if a command exists in PATH
 */
export declare function commandExists(command: string): boolean;
/**
 * Run a command and return its output
 */
export declare function runCommand(command: string, options?: {
    cwd?: string;
    timeout?: number;
}): string;
//# sourceMappingURL=checkUtils.d.ts.map