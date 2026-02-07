/**
 * Execution Trace Logger
 * Writes structured execution trace for post-mortem analysis
 */

import fs from "fs";
import path from "path";

export interface TraceEntry {
  timestamp: string;
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR" | "STEP";
  step?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export class TraceLogger {
  private logPath: string;
  private stream: fs.WriteStream;

  constructor(projectRoot: string) {
    this.logPath = path.join(projectRoot, ".dx-trace.log");
    this.stream = fs.createWriteStream(this.logPath, { flags: "a" });
  }

  private write(entry: TraceEntry): void {
    const line = JSON.stringify(entry) + "\n";
    this.stream.write(line);
  }

  stepStart(step: string, metadata?: Record<string, unknown>): number {
    const startTime = Date.now();
    this.write({
      timestamp: new Date().toISOString(),
      level: "STEP",
      step,
      message: `STEP_START: ${step}`,
      metadata: { ...metadata, startTime },
    });
    return startTime;
  }

  stepSuccess(step: string, startTime: number, metadata?: Record<string, unknown>): void {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    this.write({
      timestamp: new Date().toISOString(),
      level: "SUCCESS",
      step,
      message: `STEP_SUCCESS: ${step} (duration: ${duration}s)`,
      metadata: { ...metadata, duration },
    });
  }

  stepError(step: string, error: Error, metadata?: Record<string, unknown>): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      step,
      message: `STEP_ERROR: ${step} - ${error.message}`,
      metadata: { ...metadata, error: error.stack },
    });
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    const entry: TraceEntry = {
      timestamp: new Date().toISOString(),
      level: "INFO",
      message,
    };
    if (metadata) {
      entry.metadata = metadata;
    }
    this.write(entry);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    const entry: TraceEntry = {
      timestamp: new Date().toISOString(),
      level: "WARN",
      message,
    };
    if (metadata) {
      entry.metadata = metadata;
    }
    this.write(entry);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    const entry: TraceEntry = {
      timestamp: new Date().toISOString(),
      level: "ERROR",
      message,
    };
    if (metadata) {
      entry.metadata = metadata;
    }
    this.write(entry);
  }

  close(): void {
    this.stream.end();
  }
}
