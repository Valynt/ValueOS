/**
 * Execution Trace Logger
 * Writes structured execution trace for post-mortem analysis
 */

import fs from "fs";
import path from "path";

export class TraceLogger {
  constructor(projectRoot) {
    this.logPath = path.join(projectRoot, ".dx-trace.log");
    this.stream = fs.createWriteStream(this.logPath, { flags: "a" });
  }

  write(entry) {
    const line = JSON.stringify(entry) + "\n";
    this.stream.write(line);
  }

  stepStart(step, metadata) {
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

  stepSuccess(step, startTime, metadata) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    this.write({
      timestamp: new Date().toISOString(),
      level: "SUCCESS",
      step,
      message: `STEP_SUCCESS: ${step} (duration: ${duration}s)`,
      metadata: { ...metadata, duration },
    });
  }

  stepError(step, error, metadata) {
    this.write({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      step,
      message: `STEP_ERROR: ${step} - ${error.message}`,
      metadata: { ...metadata, error: error.stack },
    });
  }

  info(message, metadata) {
    this.write({
      timestamp: new Date().toISOString(),
      level: "INFO",
      message,
      metadata,
    });
  }

  warn(message, metadata) {
    this.write({
      timestamp: new Date().toISOString(),
      level: "WARN",
      message,
      metadata,
    });
  }

  error(message, metadata) {
    this.write({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      message,
      metadata,
    });
  }

  close() {
    this.stream.end();
  }
}
