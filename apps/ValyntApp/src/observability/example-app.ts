/**
 * Example Express middleware demonstrating observability integration
 */

import express, { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import {
  initializeTelemetry,
  getTracer,
  Metrics,
  withSpan,
  getTraceContext,
} from "./instrumentation";

// Initialize telemetry on app startup
initializeTelemetry().catch((error) => {
  console.error("Failed to initialize telemetry:", error);
  process.exit(1);
});

const app = express();
app.use(express.json());

// ============================================================================
// MIDDLEWARE: Request tracing and metrics
// ============================================================================

app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const tracer = getTracer();

  // Create a span for this HTTP request
  const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`);

  // Add HTTP semantic conventions
  span.setAttribute("http.method", req.method);
  span.setAttribute("http.url", req.url);
  span.setAttribute("http.target", req.path);
  span.setAttribute("http.host", req.hostname);

  // Store span in request for nested operations
  (req as any).span = span;

  // Increment request counter
  Metrics.httpRequestsTotal.add(1, {
    method: req.method,
    route: req.path,
  });

  // Log request
  logger.info("Incoming request", {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  // Capture response
  res.on("finish", () => {
    const duration = (Date.now() - startTime) / 1000;

    // Record metrics
    Metrics.httpRequestDuration.record(duration, {
      method: req.method,
      route: req.path,
      status: res.statusCode.toString(),
    });

    // Add response status to span
    span.setAttribute("http.status_code", res.statusCode);

    // Log response
    logger.info("Request completed", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration * 1000,
    });

    span.end();
  });

  next();
});

// ============================================================================
// EXAMPLE ENDPOINTS
// ============================================================================

/**
 * Health check endpoint
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

/**
 * Example endpoint demonstrating all three observability signals
 */
app.get("/api/example", async (req: Request, res: Response) => {
  await withSpan("exampleOperation", async (span) => {
    // 1. LOGS: Structured logging with trace context
    logger.info("Processing example request", {
      user_id: req.query.user_id,
      custom_field: "example",
    });

    // 2. TRACES: Add custom attributes to span
    span.setAttribute("user.id", (req.query.user_id as string) || "anonymous");
    span.setAttribute("operation.type", "example");

    // 3. METRICS: Custom business metric
    const exampleCounter = Metrics.createCounter(
      "example_operations_total",
      "Total number of example operations"
    );
    exampleCounter.add(1, { status: "success" });

    // Simulate some work with nested spans
    await simulateWork();

    // Get trace context for response (useful for debugging)
    const { traceId, spanId } = getTraceContext();

    res.json({
      message: "Example endpoint with full observability",
      trace_id: traceId,
      span_id: spanId,
      timestamp: new Date().toISOString(),
    });
  });
});

/**
 * Simulate nested operation with child span
 */
async function simulateWork(): Promise<void> {
  await withSpan("simulateWork", async (span) => {
    span.setAttribute("work.type", "simulation");

    logger.debug("Performing simulated work");

    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 100));

    span.setAttribute("work.completed", true);
  });
}

/**
 * Example error endpoint (for testing error tracking)
 */
app.get("/api/error", async (_req: Request, _res: Response) => {
  await withSpan("errorOperation", async (_span) => {
    logger.error("Intentional error for testing");

    throw new Error("This is a test error");
  });
});

/**
 * Metrics endpoint (Prometheus scrapes this)
 */
app.get("/metrics", (_req: Request, _res: Response, next: NextFunction) => {
  // The PrometheusExporter automatically handles this endpoint
  // This route is just for documentation
  next();
});

// ============================================================================
// ERROR HANDLER
// ============================================================================

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    error: "Internal server error",
    trace_id: getTraceContext().traceId,
  });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📊 Metrics: http://localhost:${PORT}/metrics`);
  logger.info(`🔍 Grafana: http://localhost:3000`);
});

export { app };
