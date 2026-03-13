/**
 * Secret Rotation Scheduler
 *
 * Automated secret rotation with zero-downtime
 * Supports rotation policies, grace periods, and notifications
 *
 * Sprint 3: Kubernetes Integration
 * Created: 2024-11-29
 */

import { EventEmitter } from "events";

import { CronJob } from "cron";

import { logger } from "../../lib/logger.js"
import { auditLogService } from "../../services/security/AuditLogService.js"

import type {
  ISecretProvider,
  RotationPolicy,
  SecretMetadata,
} from "./ISecretProvider";

/**
 * Rotation job configuration
 */
export interface RotationJob {
  tenantId: string;
  secretKey: string;
  policy: RotationPolicy;
  cronSchedule: string;
  lastRotation?: Date;
  nextRotation?: Date;
  lastMissedAlertAt?: Date;
}

/**
 * Rotation event
 */
export interface RotationEvent {
  tenantId: string;
  secretKey: string;
  success: boolean;
  timestamp: Date;
  duration: number;
  error?: string;
}

/**
 * Secret rotation scheduler
 *
 * Automatically rotates secrets based on policies
 * Supports dual-secret transition periods for zero-downtime
 */
export class SecretRotationScheduler extends EventEmitter {
  private provider: ISecretProvider;
  private jobs: Map<string, CronJob> = new Map();
  private jobMetadata: Map<string, RotationJob> = new Map();
  private rotationHistory: RotationEvent[] = [];
  private maxHistorySize: number = 1000;
  private previousVersions: Map<string, SecretValue> = new Map(); // Store previous versions for rollback
  private isRunning: boolean = false;
  private monitorIntervalId: NodeJS.Timeout | null = null;

  constructor(provider: ISecretProvider) {
    super();
    this.provider = provider;

    logger.info("Secret rotation scheduler initialized", {
      provider: provider.getProviderName(),
    });
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Rotation scheduler already running");
      return;
    }

    this.isRunning = true;

    logger.info("Secret rotation scheduler started");
    this.emit("started");

    const monitorIntervalMs = parseInt(
      process.env.SECRETS_ROTATION_MONITOR_INTERVAL_MS || "900000",
      10
    ); // 15 minutes default

    this.monitorIntervalId = setInterval(() => {
      this.checkForMissedRotations();
    }, monitorIntervalMs);

    this.checkForMissedRotations();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    // Stop all cron jobs
    for (const [jobKey, job] of this.jobs.entries()) {
      job.stop();
      logger.info("Stopped rotation job", { jobKey });
    }

    this.jobs.clear();
    this.jobMetadata.clear();
    this.isRunning = false;

    if (this.monitorIntervalId) {
      clearInterval(this.monitorIntervalId);
      this.monitorIntervalId = null;
    }

    logger.info("Secret rotation scheduler stopped");
    this.emit("stopped");
  }

  /**
   * Schedule a secret for automatic rotation
   */
  scheduleRotation(config: RotationJob): void {
    if (!config.policy.enabled) {
      logger.warn("Rotation policy disabled", {
        tenantId: config.tenantId,
        secretKey: config.secretKey,
      });
      return;
    }

    const jobKey = this.getJobKey(config.tenantId, config.secretKey);

    // Stop existing job if any
    if (this.jobs.has(jobKey)) {
      this.jobs.get(jobKey)!.stop();
      this.jobs.delete(jobKey);
    }

    // Create cron job
    const cronJob = new CronJob(
      config.cronSchedule,
      async () => {
        await this.executeRotation(
          config.tenantId,
          config.secretKey,
          config.policy
        );
      },
      null,
      false, // Don't start immediately
      "UTC"
    );

    this.jobs.set(jobKey, cronJob);

    // Start if scheduler is running
    if (this.isRunning) {
      cronJob.start();
    }

    const nextRotation = this.getNextRotationDate(cronJob, config.cronSchedule);

    this.jobMetadata.set(jobKey, {
      ...config,
      nextRotation,
    });

    logger.info("Scheduled secret rotation", {
      tenantId: config.tenantId,
      secretKey: config.secretKey,
      schedule: config.cronSchedule,
      intervalDays: config.policy.intervalDays,
      nextRotation: nextRotation?.toISOString(),
    });

    this.emit("job-scheduled", {
      tenantId: config.tenantId,
      secretKey: config.secretKey,
      schedule: config.cronSchedule,
      nextRotation,
    });
  }

  /**
   * Execute secret rotation
   */
  private async executeRotation(
    tenantId: string,
    secretKey: string,
    policy: RotationPolicy
  ): Promise<void> {
    const startTime = Date.now();

    logger.info("Starting secret rotation", {
      tenantId,
      secretKey,
      policy: policy.intervalDays,
    });

    try {
      // Phase 0: Store previous version for rollback
      const previousVersionKey = `${tenantId}:${secretKey}`;
      try {
        const currentSecret = await this.provider.getSecret(
          tenantId,
          secretKey
        );
        this.previousVersions.set(previousVersionKey, currentSecret);
        logger.info("Stored previous secret version for rollback", {
          tenantId,
          secretKey,
        });
      } catch (error) {
        logger.warn(
          "Failed to store previous secret version for rollback",
          error instanceof Error ? error : new Error(String(error)),
          {
            tenantId,
            secretKey,
          }
        );
      }

      // Phase 1: Generate new secret
      const newSecret = await this.provider.rotateSecret(
        tenantId,
        secretKey,
        "system"
      );

      if (!newSecret) {
        throw new Error("Failed to generate new secret");
      }

      // Phase 2: Grace period (both old and new valid)
      if (policy.gracePeriodHours > 0) {
        logger.info("Grace period started", {
          tenantId,
          secretKey,
          gracePeriodHours: policy.gracePeriodHours,
        });

        this.emit("grace-period-started", {
          tenantId,
          secretKey,
          gracePeriodHours: policy.gracePeriodHours,
        });

        // Note: In production, this would schedule grace period expiry
        // For now, we just log it
      }

      // Phase 3: Notify stakeholders
      if (policy.notifyStakeholders && policy.notifyStakeholders.length > 0) {
        await this.notifyStakeholders(
          policy.notifyStakeholders,
          tenantId,
          secretKey,
          "rotated"
        );
      }

      // Record success
      const duration = Date.now() - startTime;
      this.recordRotation({
        tenantId,
        secretKey,
        success: true,
        timestamp: new Date(),
        duration,
      });

      this.updateRotationMetadata(tenantId, secretKey);

      logger.info("Secret rotation completed successfully", {
        tenantId,
        secretKey,
        duration,
      });

      this.emit("rotation-success", {
        tenantId,
        secretKey,
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failure
      this.recordRotation({
        tenantId,
        secretKey,
        success: false,
        timestamp: new Date(),
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      this.updateRotationMetadata(tenantId, secretKey);

      logger.error(
        "Secret rotation failed",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          secretKey,
          duration,
        }
      );

      this.emit("rotation-failure", {
        tenantId,
        secretKey,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      // Attempt rollback
      await this.attemptRollback(tenantId, secretKey);
    }
  }

  /**
   * Attempt to rollback a failed rotation
   */
  private async attemptRollback(
    tenantId: string,
    secretKey: string
  ): Promise<void> {
    logger.warn("Attempting rotation rollback", {
      tenantId,
      secretKey,
    });

    const previousVersionKey = `${tenantId}:${secretKey}`;
    const previousVersion = this.previousVersions.get(previousVersionKey);

    if (!previousVersion) {
      logger.error("No previous version available for rollback", {
        tenantId,
        secretKey,
      });
      throw new Error("No previous version available for rollback");
    }

    try {
      // Create metadata for the rollback
      const rollbackMetadata: SecretMetadata = {
        tenantId,
        secretPath: `rollback/${tenantId}/${secretKey}`,
        createdAt: new Date().toISOString(),
        version: "rollback",
        sensitivityLevel: "high",
        rotationPolicy: {
          enabled: false,
          intervalDays: 0,
          autoRotate: false,
        },
      };

      // Restore the previous version
      const success = await this.provider.setSecret(
        tenantId,
        secretKey,
        previousVersion,
        rollbackMetadata,
        "system-rollback"
      );

      if (!success) {
        throw new Error("Provider returned false for rollback operation");
      }

      // Clean up the stored previous version
      this.previousVersions.delete(previousVersionKey);

      logger.info("Rollback successful - previous secret version restored", {
        tenantId,
        secretKey,
      });

      this.emit("rollback-success", {
        tenantId,
        secretKey,
      });
    } catch (error) {
      logger.error(
        "Rollback failed",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          secretKey,
        }
      );

      this.emit("rollback-failure", {
        tenantId,
        secretKey,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Notify stakeholders of rotation
   */
  private async notifyStakeholders(
    stakeholders: string[],
    tenantId: string,
    secretKey: string,
    status: "rotated" | "failed"
  ): Promise<void> {
    logger.info("Notifying stakeholders", {
      tenantId,
      secretKey,
      status,
      stakeholderCount: stakeholders.length,
    });

    // In production, this would send emails/Slack messages
    // For now, we just log it
    for (const stakeholder of stakeholders) {
      logger.info("Notification sent", {
        stakeholder,
        tenantId,
        secretKey,
        status,
      });
    }
  }

  /**
   * Record rotation event in history
   */
  private recordRotation(event: RotationEvent): void {
    this.rotationHistory.unshift(event);

    // Trim history if too large
    if (this.rotationHistory.length > this.maxHistorySize) {
      this.rotationHistory = this.rotationHistory.slice(0, this.maxHistorySize);
    }
  }

  private updateRotationMetadata(tenantId: string, secretKey: string): void {
    const jobKey = this.getJobKey(tenantId, secretKey);
    const meta = this.jobMetadata.get(jobKey);
    const cronJob = this.jobs.get(jobKey);

    if (!meta || !cronJob) {
      return;
    }

    const nextRotation = this.getNextRotationDate(
      cronJob,
      meta.cronSchedule
    );

    this.jobMetadata.set(jobKey, {
      ...meta,
      lastRotation: new Date(),
      nextRotation,
      lastMissedAlertAt: undefined,
    });
  }

  private getNextRotationDate(
    cronJob: CronJob,
    cronSchedule: string
  ): Date | undefined {
    try {
      const nextDate = cronJob.nextDates().toDate();
      return nextDate;
    } catch (error) {
      logger.warn("Failed to compute next rotation date", {
        schedule: cronSchedule,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  private checkForMissedRotations(currentTime: Date = new Date()): void {
    for (const [jobKey, meta] of this.jobMetadata.entries()) {
      if (!meta.nextRotation) {
        continue;
      }

      const gracePeriodMs = Math.max(
        (meta.policy.gracePeriodHours || 0) * 60 * 60 * 1000,
        0
      );

      if (currentTime.getTime() <= meta.nextRotation.getTime() + gracePeriodMs) {
        continue;
      }

      const lastMissedAlert = meta.lastMissedAlertAt;
      if (
        lastMissedAlert &&
        lastMissedAlert.getTime() >= meta.nextRotation.getTime()
      ) {
        continue;
      }

      logger.warn("Rotation appears overdue", {
        jobKey,
        tenantId: meta.tenantId,
        secretKey: meta.secretKey,
        expectedAt: meta.nextRotation.toISOString(),
        gracePeriodHours: meta.policy.gracePeriodHours,
      });

      this.jobMetadata.set(jobKey, {
        ...meta,
        lastMissedAlertAt: currentTime,
      });

      this.emit("rotation-missed", {
        tenantId: meta.tenantId,
        secretKey: meta.secretKey,
        expectedAt: meta.nextRotation,
      });
    }
  }

  /**
   * Get job key
   */
  private getJobKey(tenantId: string, secretKey: string): string {
    return `${tenantId}:${secretKey}`;
  }

  /**
   * Unschedule a rotation job
   */
  unscheduleRotation(tenantId: string, secretKey: string): void {
    const jobKey = this.getJobKey(tenantId, secretKey);
    const job = this.jobs.get(jobKey);

    if (job) {
      job.stop();
      this.jobs.delete(jobKey);

      logger.info("Unscheduled rotation job", {
        tenantId,
        secretKey,
      });

      this.emit("job-unscheduled", {
        tenantId,
        secretKey,
      });
    }
  }

  /**
   * Get rotation history
   */
  getRotationHistory(limit: number = 100): RotationEvent[] {
    return this.rotationHistory.slice(0, limit);
  }

  /**
   * Get rotation statistics
   */
  getStatistics(): {
    totalRotations: number;
    successfulRotations: number;
    failedRotations: number;
    successRate: number;
    activeJobs: number;
  } {
    const totalRotations = this.rotationHistory.length;
    const successfulRotations = this.rotationHistory.filter(
      (e) => e.success
    ).length;
    const failedRotations = totalRotations - successfulRotations;
    const successRate =
      totalRotations > 0 ? (successfulRotations / totalRotations) * 100 : 0;

    return {
      totalRotations,
      successfulRotations,
      failedRotations,
      successRate,
      activeJobs: this.jobs.size,
    };
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get all scheduled jobs
   */
  getScheduledJobs(): Array<{
    tenantId: string;
    secretKey: string;
    running: boolean;
  }> {
    const jobs: unknown[] = [];

    for (const [jobKey, cronJob] of this.jobs.entries()) {
      const [tenantId, secretKey] = jobKey.split(":");
      jobs.push({
        tenantId,
        secretKey,
        running: cronJob.running,
      });
    }

    return jobs;
  }
}

/**
 * Create rotation scheduler from environment
 */
export function createRotationScheduler(
  provider: ISecretProvider
): SecretRotationScheduler {
  const scheduler = new SecretRotationScheduler(provider);

  // Handle events
  scheduler.on("rotation-success", (event) => {
    logger.info("Rotation success event", event);
  });

  scheduler.on("rotation-failure", (event) => {
    logger.error(
      "Rotation failure event",
      new Error(event.error || "Unknown error"),
      event
    );
  });

  scheduler.on("rotation-missed", (event) => {
    logger.warn("Rotation missed event", event);
  });

  scheduler.on("rollback-success", (event) => {
    logger.info("Rollback success event", event);
  });

  scheduler.on("rollback-failure", (event) => {
    logger.error(
      "Rollback failure event",
      new Error(event.error || "Unknown error"),
      event
    );
  });

  const logAuditEvent = async (
    event: RotationEvent,
    status: "success" | "failed"
  ): Promise<void> => {
    try {
      await auditLogService.createEntry({
        userId: "system-rotation",
        userName: "Rotation Scheduler",
        userEmail: "rotation@valuecanvas.io",
        action: "secret.rotate",
        resourceType: "secret",
        resourceId: `${event.tenantId}:${event.secretKey}`,
        status,
        details: {
          duration_ms: event.duration,
          error: event.error,
        },
      });
    } catch (error) {
      logger.error(
        "Failed to write audit entry for rotation",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: event.tenantId,
          secretKey: event.secretKey,
          status,
        }
      );
    }
  };

  scheduler.on("rotation-success", (event) => {
    void logAuditEvent(event, "success");
  });

  scheduler.on("rotation-failure", (event) => {
    void logAuditEvent(event, "failed");
  });

  scheduler.on("rotation-missed", (event) => {
    void auditLogService
      .createEntry({
        userId: "system-rotation",
        userName: "Rotation Scheduler",
        userEmail: "rotation@valuecanvas.io",
        action: "secret.rotate.missed",
        resourceType: "secret",
        resourceId: `${event.tenantId}:${event.secretKey}`,
        status: "failed",
        details: {
          expected_at: event.expectedAt?.toISOString(),
        },
      })
      .catch((error) => {
        logger.error(
          "Failed to write audit entry for missed rotation",
          error instanceof Error ? error : new Error(String(error)),
          {
            tenantId: event.tenantId,
            secretKey: event.secretKey,
          }
        );
      });
  });

  scheduler.on("job-scheduled", (event) => {
    void auditLogService
      .createEntry({
        userId: "system-rotation",
        userName: "Rotation Scheduler",
        userEmail: "rotation@valuecanvas.io",
        action: "secret.rotate.scheduled",
        resourceType: "secret",
        resourceId: `${event.tenantId}:${event.secretKey}`,
        status: "success",
        details: {
          schedule: event.schedule,
          next_rotation: event.nextRotation
            ? event.nextRotation.toISOString()
            : undefined,
        },
      })
      .catch((error) => {
        logger.error(
          "Failed to write audit entry for rotation scheduling",
          error instanceof Error ? error : new Error(String(error)),
          {
            tenantId: event.tenantId,
            secretKey: event.secretKey,
          }
        );
      });
  });

  return scheduler;
}

/**
 * Generate cron schedule from interval days
 */
export function generateCronSchedule(intervalDays: number): string {
  // Run at 2 AM UTC
  return `0 2 */${intervalDays} * *`;
}

/**
 * Common rotation policies
 */
export const RotationPolicies = {
  /**
   * Database credentials - rotate every 90 days
   */
  DATABASE_CREDENTIALS: {
    enabled: true,
    intervalDays: 90,
    gracePeriodHours: 24,
    autoRotate: true,
  } as RotationPolicy,

  /**
   * API keys - rotate every 30 days
   */
  API_KEYS: {
    enabled: true,
    intervalDays: 30,
    gracePeriodHours: 2,
    autoRotate: true,
  } as RotationPolicy,

  /**
   * JWT secrets - rotate every 180 days
   */
  JWT_SECRETS: {
    enabled: true,
    intervalDays: 180,
    gracePeriodHours: 48,
    autoRotate: true,
  } as RotationPolicy,

  /**
   * Encryption keys - manual rotation only
   */
  ENCRYPTION_KEYS: {
    enabled: false,
    intervalDays: 365,
    gracePeriodHours: 168, // 7 days
    autoRotate: false,
  } as RotationPolicy,
};
