/**
 * OpenTelemetry Instrumentation for ValueCanvas
 * Provides distributed tracing, metrics, and logging
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const serviceName = process.env.SERVICE_NAME || 'valuecanvas-backend';
const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';
const environment = process.env.NODE_ENV || 'development';
const jaegerEndpoint = process.env.JAEGER_ENDPOINT || 'http://jaeger-collector:4318/v1/traces';

// Create resource with service information
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
});

// Configure trace exporter
const traceExporter = new OTLPTraceExporter({
  url: jaegerEndpoint,
  headers: {},
});

// Configure metric exporter for Prometheus
const prometheusExporter = new PrometheusExporter({
  port: 9464,
  endpoint: '/metrics',
});

// Configure OTLP metric exporter (optional, for additional backends)
const otlpMetricExporter = new OTLPMetricExporter({
  url: process.env.OTLP_METRICS_ENDPOINT || 'http://jaeger-collector:4318/v1/metrics',
});

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: prometheusExporter,
    exportIntervalMillis: 15000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable specific instrumentations if needed
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingPaths: ['/health', '/metrics'],
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-redis': {
        enabled: true,
      },
    }),
  ],
});

// Start the SDK
export function initTelemetry(): void {
  try {
    sdk.start();
    console.log('OpenTelemetry initialized successfully');
    console.log(`Service: ${serviceName}`);
    console.log(`Environment: ${environment}`);
    console.log(`Jaeger endpoint: ${jaegerEndpoint}`);
  } catch (error) {
    console.error('Error initializing OpenTelemetry:', error);
  }
}

// Graceful shutdown
export async function shutdownTelemetry(): Promise<void> {
  try {
    await sdk.shutdown();
    console.log('OpenTelemetry shut down successfully');
  } catch (error) {
    console.error('Error shutting down OpenTelemetry:', error);
  }
}

// Handle process termination
process.on('SIGTERM', async () => {
  await shutdownTelemetry();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownTelemetry();
  process.exit(0);
});

export default sdk;
