import { logger } from "../lib/logger.js";
/**
 * Problem Monitor Service
 *
 * Monitors IDE/build problems and logs them periodically.
 * This service runs every 5 minutes to check for code issues.
 */

export interface Problem {
  path: string;
  message: string;
  severity: "error" | "warning" | "info";
  startLine?: number;
  endLine?: number;
}

export interface ProblemStats {
  totalProblems: number;
  errors: number;
  warnings: number;
  infos: number;
  byFile: Map<string, number>;
  timestamp: Date;
}

class ProblemMonitorService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private problems: Problem[] = [];
  private listeners: Array<(stats: ProblemStats) => void> = [];
  private isRunning = false;

  /**
   * Start monitoring for problems
   */
  start(): void {
    if (this.isRunning) {
      console.warn("⚠️ Problem monitor is already running");
      return;
    }

    logger.info("🔍 Starting problem monitor (checking every 5 minutes)...");
    this.isRunning = true;

    // Run immediately on start
    this.checkProblems();

    // Then run every 5 minutes
    this.intervalId = setInterval(() => {
      this.checkProblems();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info("🛑 Problem monitor stopped");
  }

  /**
   * Update the current problems list
   * This should be called from external sources (e.g., IDE, build tools)
   */
  updateProblems(problems: Problem[]): void {
    this.problems = problems;
  }

  /**
   * Get current problems
   */
  getProblems(): Problem[] {
    return [...this.problems];
  }

  /**
   * Subscribe to problem check events
   */
  subscribe(listener: (stats: ProblemStats) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Check problems and notify listeners
   */
  private checkProblems(): void {
    const stats = this.calculateStats();

    // Log to console
    this.logProblems(stats);

    // Notify all listeners
    this.listeners.forEach((listener) => {
      try {
        listener(stats);
      } catch (error) {
        console.error("Error in problem monitor listener:", error);
      }
    });
  }

  /**
   * Calculate statistics from current problems
   */
  private calculateStats(): ProblemStats {
    const byFile = new Map<string, number>();
    let errors = 0;
    let warnings = 0;
    let infos = 0;

    this.problems.forEach((problem) => {
      // Count by severity
      switch (problem.severity) {
        case "error":
          errors++;
          break;
        case "warning":
          warnings++;
          break;
        case "info":
          infos++;
          break;
      }

      // Count by file
      const count = byFile.get(problem.path) || 0;
      byFile.set(problem.path, count + 1);
    });

    return {
      totalProblems: this.problems.length,
      errors,
      warnings,
      infos,
      timestamp: new Date(),
      byFile,
    };
  }

  /**
   * Log problems to console
   */
  private logProblems(stats: ProblemStats): void {
    const timestamp = stats.timestamp.toISOString();

    logger.info("\n" + "=".repeat(80));
    logger.info(`🔍 Problem Monitor Report - ${timestamp}`);
    logger.info("=".repeat(80));

    if (stats.totalProblems === 0) {
      logger.info("✅ No problems found!");
    } else {
      logger.info(`📊 Total Problems: ${stats.totalProblems}`);
      logger.info(`   ❌ Errors: ${stats.errors}`);
      logger.info(`   ⚠️  Warnings: ${stats.warnings}`);
      logger.info(`   ℹ️  Info: ${stats.infos}`);

      if (stats.byFile.size > 0) {
        logger.info("\n📁 Problems by file:");

        // Sort files by problem count (descending)
        const sortedFiles = Array.from(stats.byFile.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10); // Show top 10 files

        sortedFiles.forEach(([file, count]) => {
          logger.info(`   ${count.toString().padStart(3)} - ${file}`);
        });

        if (stats.byFile.size > 10) {
          logger.info(`   ... and ${stats.byFile.size - 10} more files`);
        }
      }

      // Show critical errors
      const criticalErrors = this.problems.filter(
        (p) => p.severity === "error"
      );
      if (criticalErrors.length > 0) {
        logger.info("\n❌ Critical Errors:");
        criticalErrors.slice(0, 5).forEach((error) => {
          const location = error.startLine ? `:${error.startLine}` : "";
          logger.info(`   ${error.path}${location}`);
          logger.info(`      ${error.message}`);
        });

        if (criticalErrors.length > 5) {
          logger.info(`   ... and ${criticalErrors.length - 5} more errors`);
        }
      }
    }

    logger.info("=".repeat(80) + "\n");
  }

  /**
   * Get a summary of current problems
   */
  getSummary(): string {
    const stats = this.calculateStats();

    if (stats.totalProblems === 0) {
      return "✅ No problems";
    }

    return `${stats.errors} errors, ${stats.warnings} warnings, ${stats.infos} info`;
  }

  /**
   * Check if there are any critical errors
   */
  hasCriticalErrors(): boolean {
    return this.problems.some((p) => p.severity === "error");
  }
}

// Export singleton instance
export const problemMonitor = new ProblemMonitorService();

// Export for testing
export { ProblemMonitorService };
