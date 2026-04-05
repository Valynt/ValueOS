import { createHash, timingSafeEqual } from "node:crypto";

import { createLogger } from "@shared/lib/logger";
import express, { Router } from "express";
import { z } from "zod";

import {
  RecordEventInputSchema,
  ValueLoopAnalytics,
} from "../analytics/ValueLoopAnalytics";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { createRateLimiter } from "../middleware/rateLimiter";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import { sanitizeForLog } from "../lib/validation/sanitize";
import { ReadThroughCacheService } from "../services/cache/ReadThroughCacheService";

const logger = createLogger({ component: "analytics-api" });
const analyticsRouter: Router = express.Router();
const publicTelemetryRouter: Router = express.Router();
const tenantAnalyticsRouter: Router = express.Router();

const PUBLIC_ANALYTICS_CACHE_SCOPE = "public-telemetry";
const PUBLIC_TELEMETRY_BODY_LIMIT = "16kb";
const PUBLIC_TELEMETRY_MAX_URL_LENGTH = 2048;
const PUBLIC_TELEMETRY_MAX_USER_AGENT_LENGTH = 256;
const PUBLIC_TELEMETRY_MAX_METRIC_NAME_LENGTH = 64;
const PUBLIC_TELEMETRY_MAX_EVENT_TYPE_LENGTH = 64;
const PUBLIC_TELEMETRY_MAX_CONTEXT_VALUE_LENGTH = 64;
const PUBLIC_TELEMETRY_KEY_HEADER = "x-telemetry-key";
// eslint-disable-next-line no-control-regex -- control characters are intentionally rejected for telemetry inputs
const CONTROL_CHARACTER_PATTERN = /[\r\n\x00-\x1f\x7f]/;
const SECURE_TELEMETRY_NODE_ENVS = new Set(["staging", "production"]);

const analyticsLimiter = createRateLimiter("standard", {
  message: "Too many analytics requests. Please slow down.",
});

const publicTelemetryJsonParser = express.json({
  limit: PUBLIC_TELEMETRY_BODY_LIMIT,
  strict: true,
});

const finiteNumberSchema = z.number().finite();

const boundedClientString = (field: string, maxLength: number) => z.string()
  .trim()
  .min(1, `${field} is required`)
  .max(maxLength, `${field} must be at most ${maxLength} characters`)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), `${field} contains control characters`);

const boundedIdentifier = (field: string, maxLength: number) => z.string()
  .trim()
  .min(1, `${field} is required`)
  .max(maxLength, `${field} must be at most ${maxLength} characters`)
  .regex(/^[A-Za-z0-9._:-]+$/, `${field} contains unsupported characters`)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), `${field} contains control characters`);

const telemetryTimestampSchema = z.string()
  .datetime({ offset: true })
  .max(64, "timestamp must be at most 64 characters")
  .optional();

const telemetryUrlSchema = z.string()
  .trim()
  .min(1, "url is required")
  .max(PUBLIC_TELEMETRY_MAX_URL_LENGTH, `url must be at most ${PUBLIC_TELEMETRY_MAX_URL_LENGTH} characters`)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), "url contains control characters")
  .pipe(z.string().url("url must be a valid absolute URL"));

const telemetryUserAgentSchema = boundedClientString("userAgent", PUBLIC_TELEMETRY_MAX_USER_AGENT_LENGTH);
const telemetryMetricNameSchema = boundedIdentifier("name", PUBLIC_TELEMETRY_MAX_METRIC_NAME_LENGTH);
const telemetryEventTypeSchema = boundedIdentifier("type", PUBLIC_TELEMETRY_MAX_EVENT_TYPE_LENGTH);
const telemetryContextValueSchema = boundedClientString("context value", PUBLIC_TELEMETRY_MAX_CONTEXT_VALUE_LENGTH);

const webVitalRatingSchema = z.enum(["good", "needs-improvement", "poor"]);

const webVitalsPayloadSchema = z.object({
  name: telemetryMetricNameSchema,
  value: finiteNumberSchema,
  rating: webVitalRatingSchema.optional(),
  delta: finiteNumberSchema.optional(),
  userAgent: telemetryUserAgentSchema.optional(),
  url: telemetryUrlSchema.optional(),
  timestamp: telemetryTimestampSchema,
}).strict();

const performanceMetricDataSchema = z.object({
  metricName: boundedIdentifier("metricName", PUBLIC_TELEMETRY_MAX_METRIC_NAME_LENGTH).optional(),
  value: finiteNumberSchema.optional(),
  duration: finiteNumberSchema.nonnegative().optional(),
  delta: finiteNumberSchema.optional(),
  rating: webVitalRatingSchema.optional(),
  navigationType: telemetryContextValueSchema.optional(),
  entryType: telemetryContextValueSchema.optional(),
}).strict();

const performancePayloadSchema = z.object({
  type: telemetryEventTypeSchema,
  data: performanceMetricDataSchema.default({}),
  timestamp: telemetryTimestampSchema,
  url: telemetryUrlSchema.optional(),
  userAgent: telemetryUserAgentSchema.optional(),
}).strict();

type PerformancePayload = z.infer<typeof performancePayloadSchema>;

analyticsRouter.use(optionalAuth);
analyticsRouter.use(analyticsLimiter);
analyticsRouter.use(publicTelemetryRouter);
analyticsRouter.use("/value-loop", requireAuth, tenantContextMiddleware(), tenantAnalyticsRouter);

function getTelemetryHashSalt(): string {
  const telemetryHashSalt = process.env.TELEMETRY_LOG_HASH_SALT?.trim();
  if (telemetryHashSalt) {
    return telemetryHashSalt;
  }

  if (isSecureTelemetryEnvironment()) {
    throw new Error("TELEMETRY_LOG_HASH_SALT must be configured in staging/production.");
  }

  return process.env.TCT_SECRET
    ?? "valueos-public-telemetry";
}

function hashTelemetryValue(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return createHash("sha256")
    .update(`${getTelemetryHashSalt()}:${value}`)
    .digest("hex")
    .slice(0, 16);
}

function redactTelemetryUrl(rawUrl: string | undefined): {
  sourceOrigin?: string;
  sourcePathHash?: string;
  hasQuery?: boolean;
} {
  if (!rawUrl) {
    return {};
  }

  try {
    const parsedUrl = new URL(rawUrl);
    return {
      sourceOrigin: `${parsedUrl.protocol}//${parsedUrl.host}`,
      sourcePathHash: hashTelemetryValue(parsedUrl.pathname || "/"),
      hasQuery: parsedUrl.search.length > 0,
    };
  } catch {
    return {
      sourcePathHash: hashTelemetryValue(sanitizeForLog(rawUrl, PUBLIC_TELEMETRY_MAX_URL_LENGTH)),
    };
  }
}

function getTelemetryAllowedOrigins(): string[] {
  return (process.env.BROWSER_TELEMETRY_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function isSecureTelemetryEnvironment(): boolean {
  const nodeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
  return SECURE_TELEMETRY_NODE_ENVS.has(nodeEnv);
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function rejectUnauthorizedTelemetryRequest(
  req: express.Request,
  res: express.Response,
): boolean {
  const secureTelemetryEnvironment = isSecureTelemetryEnvironment();
  const configuredTelemetryKey = process.env.BROWSER_TELEMETRY_INGESTION_KEY?.trim();
  const providedTelemetryKey = req.get(PUBLIC_TELEMETRY_KEY_HEADER)?.trim();

  if (!configuredTelemetryKey && secureTelemetryEnvironment) {
    logger.warn("Browser telemetry rejected", {
      reason: "missing_telemetry_key_configuration",
      ipHash: hashTelemetryValue(req.ip),
      originHash: hashTelemetryValue(req.get("origin") || undefined),
    });
    res.status(401).json({ error: "Telemetry key required" });
    return true;
  }

  if (configuredTelemetryKey && (!providedTelemetryKey || !constantTimeEquals(providedTelemetryKey, configuredTelemetryKey))) {
    logger.warn("Browser telemetry rejected", {
      reason: "invalid_telemetry_key",
      ipHash: hashTelemetryValue(req.ip),
      originHash: hashTelemetryValue(req.get("origin") || undefined),
    });
    res.status(401).json({ error: "Telemetry key required" });
    return true;
  }

  const allowedOrigins = getTelemetryAllowedOrigins();
  const hasWildcardOrigin = allowedOrigins.some((origin) => origin.includes("*"));
  if (secureTelemetryEnvironment && (allowedOrigins.length === 0 || hasWildcardOrigin)) {
    logger.warn("Browser telemetry rejected", {
      reason: "invalid_telemetry_origin_configuration",
      ipHash: hashTelemetryValue(req.ip),
      originHash: hashTelemetryValue(req.get("origin") || undefined),
    });
    res.status(403).json({ error: "Origin not allowed for browser telemetry" });
    return true;
  }

  if (allowedOrigins.length > 0) {
    const requestOrigin = req.get("origin")?.trim();
    if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
      logger.warn("Browser telemetry rejected", {
        reason: "origin_not_allowed",
        ipHash: hashTelemetryValue(req.ip),
        originHash: hashTelemetryValue(requestOrigin),
      });
      res.status(403).json({ error: "Origin not allowed for browser telemetry" });
      return true;
    }
  }

  return false;
}

function buildTelemetryLogContext(input: {
  request: express.Request;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  metricName?: string;
  eventType?: string;
  value?: number;
  delta?: number;
  rating?: z.infer<typeof webVitalRatingSchema>;
  metricData?: PerformancePayload["data"];
}): Record<string, unknown> {
  const resolvedUrl = input.url ?? input.request.get("referer") ?? undefined;
  const resolvedUserAgent = input.userAgent ?? input.request.get("user-agent") ?? undefined;

  return {
    metricName: input.metricName,
    eventType: input.eventType,
    value: typeof input.value === "number" ? Math.round(input.value * 1000) / 1000 : undefined,
    delta: typeof input.delta === "number" ? Math.round(input.delta * 1000) / 1000 : undefined,
    rating: input.rating,
    timestamp: input.timestamp ?? new Date().toISOString(),
    ipHash: hashTelemetryValue(input.request.ip),
    userAgentHash: hashTelemetryValue(resolvedUserAgent),
    userAgentLength: resolvedUserAgent?.length,
    ...redactTelemetryUrl(resolvedUrl),
    metricData: input.metricData
      ? {
          metricName: input.metricData.metricName,
          value: input.metricData.value,
          duration: input.metricData.duration,
          delta: input.metricData.delta,
          rating: input.metricData.rating,
          navigationType: input.metricData.navigationType,
          entryType: input.metricData.entryType,
        }
      : undefined,
  };
}

function respondWithValidationError(
  res: express.Response,
  error: z.ZodError<unknown>,
): express.Response {
  return res.status(400).json({
    error: "Invalid telemetry payload",
    details: error.flatten(),
  });
}

publicTelemetryRouter.get("/summary", async (req, res) => {
  try {
    const payload = await ReadThroughCacheService.getOrLoad(
      {
        tenantId: PUBLIC_ANALYTICS_CACHE_SCOPE,
        endpoint: "api-analytics-summary",
        scope: PUBLIC_ANALYTICS_CACHE_SCOPE,
        tier: "warm",
        keyPayload: req.query,
      },
      async () => ({
        success: true,
        data: {
          period: (req.query.period as string) || "24h",
          generatedAt: new Date().toISOString(),
          webVitalsEvents: 0,
          performanceEvents: 0,
        },
      })
    );

    res.status(200).json(payload);
    return;
  } catch (error) {
    logger.error("Failed to load analytics summary", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

publicTelemetryRouter.post("/web-vitals", publicTelemetryJsonParser, async (req, res) => {
  try {
    if (rejectUnauthorizedTelemetryRequest(req, res)) {
      return;
    }

    const parsedPayload = webVitalsPayloadSchema.safeParse(req.body);
    if (!parsedPayload.success) {
      return respondWithValidationError(res, parsedPayload.error);
    }

    const { name, value, rating, delta, userAgent, url, timestamp } = parsedPayload.data;

    logger.info("Web Vital recorded", buildTelemetryLogContext({
      request: req,
      metricName: name,
      value,
      delta,
      rating,
      timestamp,
      url,
      userAgent,
    }));

    await ReadThroughCacheService.invalidateEndpoint(PUBLIC_ANALYTICS_CACHE_SCOPE, "api-analytics-summary");

    res.status(200).json({ success: true });
    return;
  } catch (error) {
    logger.error("Failed to process web vitals", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

publicTelemetryRouter.post("/performance", publicTelemetryJsonParser, async (req, res) => {
  try {
    if (rejectUnauthorizedTelemetryRequest(req, res)) {
      return;
    }

    const parsedPayload = performancePayloadSchema.safeParse(req.body);
    if (!parsedPayload.success) {
      return respondWithValidationError(res, parsedPayload.error);
    }

    const { type, data, timestamp, url, userAgent } = parsedPayload.data;

    logger.info("Performance metric recorded", buildTelemetryLogContext({
      request: req,
      eventType: type,
      timestamp,
      url,
      userAgent,
      metricData: data,
    }));

    await ReadThroughCacheService.invalidateEndpoint(PUBLIC_ANALYTICS_CACHE_SCOPE, "api-analytics-summary");

    res.status(200).json({ success: true });
    return;
  } catch (error) {
    logger.error("Failed to process performance metric", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

// ─── Value loop analytics ─────────────────────────────────────────────────────

// POST /api/analytics/value-loop/events — record a single value loop event
tenantAnalyticsRouter.post(
  "/events",
  express.json(),
  async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: "Tenant context required" });
      }
      const requestedOrganizationId = req.body?.organizationId as string | undefined;
      if (requestedOrganizationId && requestedOrganizationId !== tenantId) {
        return res.status(403).json({ error: "Tenant context mismatch" });
      }

      const parsed = RecordEventInputSchema.safeParse({
        ...req.body,
        organizationId: tenantId,
      });

      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid event payload", details: parsed.error.flatten() });
      }

      await ValueLoopAnalytics.record(parsed.data);
      return res.status(201).json({ success: true });
    } catch (error) {
      logger.error("Failed to record value loop event", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// GET /api/analytics/value-loop/insights — aggregated insights for the tenant
tenantAnalyticsRouter.get(
  "/insights",
  async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: "Tenant context required" });
      }
      const windowDays = Math.min(Number(req.query.days ?? 30), 90);

      const insights = await ValueLoopAnalytics.getInsights(tenantId, windowDays);
      return res.status(200).json({ success: true, data: insights });
    } catch (error) {
      logger.error("Failed to get value loop insights", error instanceof Error ? error : undefined);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default analyticsRouter;
