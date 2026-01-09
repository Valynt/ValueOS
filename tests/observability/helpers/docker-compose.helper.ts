/**
 * Docker Compose Helper
 * Manages lifecycle of observability stack for testing
 */

import { ChildProcess, execSync, spawn } from "child_process";
import { promisify } from "util";
import axios from "axios";

const sleep = promisify(setTimeout);

export interface DockerComposeOptions {
  composeFile?: string;
  projectName?: string;
  services?: string[];
}

export class DockerComposeHelper {
  private composeFile: string;
  private projectName: string;
  private services: string[];

  constructor(options: DockerComposeOptions = {}) {
    this.composeFile =
      options.composeFile || "docker-compose.observability.yml";
    this.projectName = options.projectName || "valueos-observability";
    this.services = options.services || [
      "grafana",
      "loki",
      "tempo",
      "prometheus",
    ];
  }

  /**
   * Start the observability stack
   */
  async up(detached: boolean = true): Promise<void> {
    console.log("🚀 Starting observability stack...");

    const args = ["-f", this.composeFile, "-p", this.projectName, "up"];
    if (detached) args.push("-d");

    execSync(`docker-compose ${args.join(" ")}`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    if (detached) {
      await this.waitForHealthy();
    }
  }

  /**
   * Stop the observability stack
   */
  async down(removeVolumes: boolean = false): Promise<void> {
    console.log("🛑 Stopping observability stack...");

    const args = ["-f", this.composeFile, "-p", this.projectName, "down"];
    if (removeVolumes) args.push("-v");

    execSync(`docker-compose ${args.join(" ")}`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  }

  /**
   * Check if a service is running
   */
  isServiceRunning(serviceName: string): boolean {
    try {
      const output = execSync(
        `docker-compose -f ${this.composeFile} -p ${this.projectName} ps -q ${serviceName}`,
        { encoding: "utf-8" }
      );
      return output.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get logs from a service
   */
  logs(serviceName: string, tail: number = 100): string {
    return execSync(
      `docker-compose -f ${this.composeFile} -p ${this.projectName} logs --tail=${tail} ${serviceName}`,
      { encoding: "utf-8" }
    );
  }

  /**
   * Wait for all services to be healthy
   */
  async waitForHealthy(timeoutMs: number = 60000): Promise<void> {
    console.log("⏳ Waiting for services to be healthy...");

    const startTime = Date.now();
    const healthChecks = {
      loki: "http://localhost:3100/ready",
      tempo: "http://localhost:3200/ready",
      prometheus: "http://localhost:9090/-/ready",
      grafana: "http://localhost:3000/api/health",
    };

    while (Date.now() - startTime < timeoutMs) {
      let allHealthy = true;

      for (const [service, url] of Object.entries(healthChecks)) {
        try {
          const response = await axios.get(url, { timeout: 2000 });
          if (response.status !== 200) {
            allHealthy = false;
            console.log(`  ⏳ ${service} not ready yet...`);
          }
        } catch (error) {
          allHealthy = false;
          // Service not ready yet
        }
      }

      if (allHealthy) {
        console.log("✅ All services healthy!");
        return;
      }

      await sleep(2000);
    }

    throw new Error(`Services did not become healthy within ${timeoutMs}ms`);
  }

  /**
   * Wait for a specific service to be healthy
   */
  async waitForService(
    serviceName: string,
    healthUrl: string,
    timeoutMs: number = 30000,
    intervalMs: number = 1000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await axios.get(healthUrl, { timeout: 2000 });
        if (response.status === 200) {
          console.log(`✅ ${serviceName} is healthy`);
          return;
        }
      } catch {
        // Not ready yet
      }

      await sleep(intervalMs);
    }

    throw new Error(
      `${serviceName} did not become healthy within ${timeoutMs}ms`
    );
  }

  /**
   * Execute a command inside a service container
   */
  exec(serviceName: string, command: string): string {
    return execSync(
      `docker-compose -f ${this.composeFile} -p ${this.projectName} exec -T ${serviceName} ${command}`,
      { encoding: "utf-8" }
    );
  }

  /**
   * Restart a specific service
   */
  async restart(serviceName: string): Promise<void> {
    console.log(`🔄 Restarting ${serviceName}...`);
    execSync(
      `docker-compose -f ${this.composeFile} -p ${this.projectName} restart ${serviceName}`,
      { stdio: "inherit" }
    );
  }
}
