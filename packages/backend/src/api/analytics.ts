import { createHash } from "node:crypto";

import { createLogger } from "@shared/lib/logger";
import express, { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";

import {
  RecordEventInputSchema,
  ValueLoopAnalytics,
} from "../analytics/ValueLoopAnalytics";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { createRateLimiter } from "../middleware/rateLimiter";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import { ReadThroughCacheService } from "../services/cache/ReadThroughCacheService";

const logger = createLogger({ component: "analytics-api" });
const analyticsRouter: Router = express.Router();
const publicTelemetryRouter: Router = express.Router();
const tenantAnalyticsRouter: Router = express.Router();

const PUBLIC_ANALYTICS_CACHE_SCOPE = "public-telemetry";
const PUBLIC_TELEMETRY_BODY_LIMIT = "16kb";
const URL_MAX_LENGTH = 2048;
const USER_AGENT_MAX_LENGTH = 512;
const METRIC_NAME_MAX_LENGTH = 64;
const EVENT_TYPE_MAX_LENGTH = 64;
const METADATA_KEY_MAX_LENGTH = 32;
const ISO_TIMESTAMP_MAX_LENGTH = 64;
const HASH_LENGTH = 16;
const SAFE_IDENTIFIER_PATTERN = /^[a-zA-Z0-9._:-]+$/;
const SAFE_NAVIGATION_TYPE_PATTERN = /^[a-zA-Z0-9._:/-]+$/;
const WEB_VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const;

const analyticsLimiter = createRateLimiter("standard", {
  message: "Too many analytics requests. Please slow down.",
});
const publicTelemetryJsonParser = express.json({ limit: PUBLIC_TELEMETRY_BODY_LIMIT });

const safeIdentifierSchema = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} must be at most ${maxLength} characters`)
    .regex(
      SAFE_IDENTIFIER_PATTERN,
      `${label} may only contain letters, numbers, dots, colons, underscores, and dashes`,
    );

const urlSchema = z
  .string()
  .trim()
  .max(URL_MAX_LENGTH, `url must be at most ${URL_MAX_LENGTH} characters`)
  .url("url must be a valid URL");

const userAgentSchema = z
  .string()
  .trim()
  .min(1, "userAgent cannot be empty")
  .max(USER_AGENT_MAX_LENGTH, `userAgent must be at most ${USER_AGENT_MAX_LENGTH} characters`);

const timestampSchema = z
  .string()
  .trim()
  .max(ISO_TIMESTAMP_MAX_LENGTH, `timestamp must be at most ${ISO_TIMESTAMP_MAX_LENGTH} characters`)
  .datetime({ offset: true, message: "timestamp must be an ISO-8601 datetime" });

const webVitalsPayloadSchema = z
  .object({
    name: safeIdentifierSchema("name", METRIC_NAME_MAX_LENGTH),
    value: z.number().finite(),
    rating: z.enum(WEB_VITAL_RATINGS).optional(),
    delta: z.number().finite().optional(),
    userAgent: userAgentSchema.optional(),
    url: urlSchema.optional(),
    timestamp: timestampSchema.optional(),
  })
  .strict();

const performanceTelemetryDataSchema = z
  .object({
    metricName: safeIdentifierSchema("metricName", METRIC_NAME_MAX_LENGTH).optional(),
    duration: z.number().finite().min(0).max(600_000).optional(),
    value: z.number().finite().optional(),
    rating: z.enum(WEB_VITAL_RATINGS).optional(),
    navigationType: z
      .string()
      .trim()
      .min(1, "navigationType cannot be empty")
      .max(METADATA_KEY_MAX_LENGTH, `navigationType must be at most ${METADATA_KEY_MAX_LENGTH} characters`)
      .regex(
        SAFE_NAVIGATION_TYPE_PATTERN,
        "navigationType may only contain letters, numbers, dots, colons, slashes, underscores, and dashes",
      )
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "data must include at least one supported performance metric field",
  });

const performanceTelemetryPayloadSchema = z
  .object({
    type: safeIdentifierSchema("type", EVENT_TYPE_MAX_LENGTH),
    data: performanceTelemetryDataSchema,
    userAgent: userAgentSchema.optional(),
    url: urlSchema.optional(),
    timestamp: timestampSchema.optional(),
  })
  .strict();

analyticsRouter.use(optionalAuth);
analyticsRouter.use(analyticsLimiter);
analyticsRouter.use(publicTelemetryRouter);
analyticsRouter.use("/value-loop", requireAuth, tenantContextMiddleware(), tenantAnalyticsRouter);

function hashValue(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return createHash("sha256").update(value).digest("hex").slice(0, HASH_LENGTH);
}

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}


function getAllowedTelemetryOrigins(): string[] {
  const rawOrigins = process.env.PUBLIC_TELEMETRY_ALLOWED_ORIGINS;
  if (!rawOrigins) {
    return [];
  }

  return rawOrigins
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin));
}

function getEffectiveOrigin(req: Request): string | undefined {
  const originHeader = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const refererHeader = typeof req.headers.referer === "string" ? req.headers.referer : undefined;
  return normalizeOrigin(originHeader) ?? normalizeOrigin(refererHeader);
}

function getTelemetryLogContext(
  req: Request,
  payload: { userAgent?: string; url?: string },
): Record<string, string | undefined> {
  const refererHeader = typeof req.headers.referer === "string" ? req.headers.referer : undefined;
  const requestUserAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;

  return {
    ipHash: hashValue(req.ip),
    userAgentHash: hashValue(payload.userAgent ?? requestUserAgent),
    urlHash: hashValue(payload.url),
    referrerHash: hashValue(refererHeader),
    originHash: hashValue(getEffectiveOrigin(req)),
  };
}

function enforcePublicTelemetryAccess(req: Request, res: Response): boolean {
  const expectedToken = process.env.PUBLIC_TELEMETRY_INGESTION_TOKEN?.trim();
  const providedToken = req.header("x-telemetry-key")?.trim();

  if (expectedToken && providedToken !== expectedToken) {
    logger.warn("Rejected public telemetry request", {
      reason: "invalid_ingestion_token",
      originHash: hashValue(getEffectiveOrigin(req)),
      ipHash: hashValue(req.ip),
    });
    res.status(401).json({ error: "Telemetry ingestion key required" });
    return false;
  }

  const allowedOrigins = getAllowedTelemetryOrigins();
  if (allowedOrigins.length > 0) {
    const origin = getEffectiveOrigin(req);
    if (!origin || !allowedOrigins.includes(origin)) {
      logger.warn("Rejected public telemetry request", {
        reason: "origin_not_allowed",
        originHash: hashValue(origin),
        ipHash: hashValue(req.ip),
      });
      res.status(403).json({ error: "Origin not allowed for telemetry ingestion" });
      return false;
    }
  }

  return true;
}

function handleTelemetryValidationError(res: Response, error: z.ZodError): Response {
  return res.status(400).json({
    error: "Invalid payload",
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
    if (!enforcePublicTelemetryAccess(req, res)) {
      return;
    }

    const parsed = webVitalsPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return handleTelemetryValidationError(res, parsed.error);
    }

    const telemetry = parsed.data;
    logger.info("Web Vital recorded", {
      name: telemetry.name,
      value: Math.round(telemetry.value),
      rating: telemetry.rating,
      delta: telemetry.delta !== undefined ? Math.round(telemetry.delta) : undefined,
      timestamp: telemetry.timestamp || new Date().toISOString(),
      ...getTelemetryLogContext(req, telemetry),
    });

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
    if (!enforcePublicTelemetryAccess(req, res)) {
      return;
    }

    const parsed = performanceTelemetryPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return handleTelemetryValidationError(res, parsed.error);
    }

    const telemetry = parsed.data;
    logger.info("Performance metric recorded", {
      type: telemetry.type,
      metricName: telemetry.data.metricName,
      duration: telemetry.data.duration,
      value: telemetry.data.value,
      rating: telemetry.data.rating,
      navigationType: telemetry.data.navigationType,
      timestamp: telemetry.timestamp || new Date().toISOString(),
      ...getTelemetryLogContext(req, telemetry),
    });

    await ReadThroughCacheService.invalidateEndpoint(PUBLIC_ANALYTICS_CACHE_SCOPE, "api-analytics-summary");

    res.status(200).json({ success: true });
    return;
  } catch (error) {
    logger.error("Failed to process performance metric", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

publicTelemetryRouter.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  const payloadError = error as { type?: string; status?: number };

  if (payloadError?.type === "entity.too.large" || payloadError?.status === 413) {
    res.status(413).json({ error: "Telemetry payload too large" });
    return;
  }

  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "Malformed JSON payload" });
    return;
  }

  next(error);
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
