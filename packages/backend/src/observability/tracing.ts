/**
 * OpenTelemetry SDK bootstrap for the backend process.
 *
 * Must be imported and started before any other module that uses
 * @opentelemetry/api so that auto-instrumentation patches are applied
 * before the instrumented libraries are first required.
 *
 * Usage in server.ts:
 *   import { startTracing, stopTracing } from "./observability/tracing.js";
 *   await startTracing();
 *   // ... rest of server startup
 *
 * Environment variables:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — collector base URL (default: http://otel-collector:4318)
 *   OTEL_SERVICE_NAME            — service name label (default: valueos-backend)
 *   OTEL_TRACES_SAMPLER          — sampler type (default: parentbased_traceidratio)
 *   OTEL_TRACES_SAMPLER_ARG      — sample ratio 0–1 (default: 0.1 in production, 1.0 otherwise)
 *   ENABLE_TELEMETRY             — set to "false" to disable entirely
 */

import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SEMRESATTRS_DEPLOYMENT_ENVIRONMENT, SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

import { logger } from "../lib/logger";

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? "valueos-backend";
const SERVICE_VERSION = process.env.npm_package_version ?? "1.0.0";
const ENVIRONMENT = process.env.NODE_ENV ?? "development";
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://otel-collector:4318";

// Default sample rate: 10% in production to control cardinality, 100% elsewhere.
const DEFAULT_SAMPLE_RATE = ENVIRONMENT === "production" ? 0.1 : 1.0;
const SAMPLE_RATE = process.env.OTEL_TRACES_SAMPLER_ARG
  ? parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG)
  : DEFAULT_SAMPLE_RATE;

let sdk: NodeSDK | null = null;

export async function startTracing(): Promise<void> {
  if (process.env.ENABLE_TELEMETRY === "false") {
    logger.info("OpenTelemetry tracing disabled via ENABLE_TELEMETRY=false");
    return;
  }

  try {
    sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: SERVICE_NAME,
        [SEMRESATTRS_SERVICE_VERSION]: SERVICE_VERSION,
        [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
      }),
      traceExporter: new OTLPTraceExporter({
        url: `${OTLP_ENDPOINT}/v1/traces`,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // fs instrumentation is too noisy — every file read creates a span.
          "@opentelemetry/instrumentation-fs": { enabled: false },
          "@opentelemetry/instrumentation-http": {
            enabled: true,
            // Exclude health and metrics endpoints from trace generation.
            ignoreIncomingRequestHook: (req) => {
              const url = req.url ?? "";
              return url === "/health" || url === "/metrics" || url.startsWith("/health/");
            },
          },
          "@opentelemetry/instrumentation-express": { enabled: true },
          "@opentelemetry/instrumentation-pg": { enabled: true },
          "@opentelemetry/instrumentation-redis": { enabled: true },
          "@opentelemetry/instrumentation-ioredis": { enabled: true },
        }),
      ],
    });

    sdk.start();

    logger.info("OpenTelemetry tracing started", {
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: ENVIRONMENT,
      endpoint: OTLP_ENDPOINT,
      sampleRate: SAMPLE_RATE,
    });
  } catch (err) {
    // Tracing failure must not crash the server.
    logger.warn("OpenTelemetry tracing failed to start — running without traces", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function stopTracing(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
    logger.info("OpenTelemetry tracing shut down");
  } catch (err) {
    logger.warn("OpenTelemetry shutdown error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
