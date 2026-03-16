/**
 * External module declarations for packages without type definitions.
 * These stubs prevent TS2307 errors for optional/runtime-only dependencies.
 */

declare module "node-vault" {
  interface VaultOptions {
    apiVersion?: string;
    endpoint?: string;
    token?: string;
  }

  interface VaultClient {
    read(path: string): Promise<Record<string, unknown>>;
    write(path: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete(path: string): Promise<void>;
    list(path: string): Promise<{ data: { keys: string[] } }>;
    health(): Promise<Record<string, unknown>>;
  }

  function vault(options?: VaultOptions): VaultClient;
  export default vault;
}

declare module "@opentelemetry/sdk-node" {
  export class NodeSDK {
    constructor(config?: Record<string, unknown>);
    start(): void;
    shutdown(): Promise<void>;
  }
}

declare module "@opentelemetry/auto-instrumentations-node" {
  export function getNodeAutoInstrumentations(config?: Record<string, unknown>): unknown[];
}

declare module "@opentelemetry/exporter-trace-otlp-http" {
  export class OTLPTraceExporter {
    constructor(config?: { url?: string; headers?: Record<string, string> });
  }
}

declare module "@opentelemetry/exporter-metrics-otlp-http" {
  export class OTLPMetricExporter {
    constructor(config?: { url?: string; headers?: Record<string, string> });
  }
}

declare module "@opentelemetry/sdk-metrics" {
  export class PeriodicExportingMetricReader {
    constructor(config?: { exporter: unknown; exportIntervalMillis?: number });
  }
}

declare module "@opentelemetry/resources" {
  export class Resource {
    constructor(attributes?: Record<string, string>);
    static default(): Resource;
    merge(other: Resource): Resource;
  }
}

declare module "@opentelemetry/semantic-conventions" {
  export const SEMRESATTRS_SERVICE_NAME: string;
  export const SEMRESATTRS_SERVICE_VERSION: string;
  export const SEMRESATTRS_DEPLOYMENT_ENVIRONMENT: string;
}
