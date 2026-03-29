import { context, type Span, trace } from "@opentelemetry/api";

import { logger } from "./logger";

export interface FrontendObservabilityInitOptions {
  appName: string;
  release: string;
  environment: string;
}

export interface ObservabilityTags {
  service: string;
  env: string;
  tenant_id: string;
  trace_id: string;
  [key: string]: string;
}

const DEFAULT_SERVICE = "valynt-app";
const DEFAULT_ENV = import.meta.env.MODE || "development";

let observabilityInitialized = false;

export function initFrontendObservability(options: FrontendObservabilityInitOptions): void {
  if (observabilityInitialized) {
    return;
  }

  observabilityInitialized = true;

  logger.info("[observability.init]", {
    appName: options.appName,
    release: options.release,
    environment: options.environment,
  });
}

export function recordMetric(name: string, value: number, tags: ObservabilityTags): void {
  logger.debug("[observability.metric]", { name, value, ...tags });
}

export function startSpan(name: string, tags: ObservabilityTags): { end: () => void; span: Span } {
  const tracer = trace.getTracer(DEFAULT_SERVICE);
  const span = tracer.startSpan(name, {
    attributes: tags,
  });
  return {
    span,
    end: () => {
      span.end();
    },
  };
}

export async function trackFrontendFlow<T>(
  flowName: string,
  tags: Partial<ObservabilityTags>,
  operation: () => Promise<T>
): Promise<T> {
  const spanTags: ObservabilityTags = {
    service: tags.service || DEFAULT_SERVICE,
    env: tags.env || DEFAULT_ENV,
    tenant_id: tags.tenant_id || "anonymous",
    trace_id: tags.trace_id || `frontend-${flowName}-${Date.now()}`,
  };

  const { span, end } = startSpan(`frontend.${flowName}`, spanTags);
  recordMetric("frontend_flow_started", 1, spanTags);

  try {
    return await context.with(trace.setSpan(context.active(), span), operation);
  } catch (error) {
    logger.error(`[observability] frontend flow "${flowName}" failed:`, error);
    recordMetric("frontend_flow_failed", 1, spanTags);
    throw error;
  } finally {
    recordMetric("frontend_flow_completed", 1, spanTags);
    end();
  }
}
