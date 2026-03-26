import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { globalErrorHandler } from "../globalErrorHandler";

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("../../lib/logger", () => ({
  logger: loggerMock,
  createLogger: vi.fn(() => loggerMock),
}));

vi.mock("../../config/telemetry", () => ({
  getTraceContextForLogging: vi.fn(() => ({ traceId: "trace-test" })),
  recordSpanException: vi.fn(),
}));

describe("global error handler secret redaction", () => {
  it("does not leak secrets in API error responses", async () => {
    const app = express();
    app.get("/explode", () => {
      throw new Error("Token leaked: sk-test-secret-value");
    });
    app.use(globalErrorHandler);

    const response = await request(app).get("/explode");

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("sk-test-secret-value");
  });

  it("redacts sensitive log fields when route throws", async () => {
    const app = express();
    app.get("/explode", (_req, _res, next) => {
      const err = new Error("Bearer top-secret-token");
      (err as Error & { details?: unknown }).details = { apiKey: "top-secret" };
      next(err);
    });
    app.use(globalErrorHandler);

    await request(app).get("/explode");

    expect(loggerMock.error.mock.calls.length + loggerMock.warn.mock.calls.length).toBeGreaterThan(0);
    const logCall = loggerMock.error.mock.calls[0] ?? loggerMock.warn.mock.calls[0];
    const [, meta] = logCall;
    expect(JSON.stringify(meta)).not.toContain("top-secret-token");
    expect(JSON.stringify(meta)).not.toContain("top-secret");
  });
});
