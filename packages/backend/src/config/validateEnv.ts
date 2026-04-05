/**
 * Environment Validation
 *
 * Validates required environment variables at startup with actionable error messages.
 * Fail-fast pattern: detect misconfiguration before the application crashes unexpectedly.
 */

/* eslint-disable security/detect-object-injection -- Controlled environment variable access with hardcoded configuration */

import { logger } from "../lib/logger.js";
import { validateAuditLogEncryptionConfig } from "../services/agents/AuditLogEncryptionConfig.js";
import { getSensitiveEnvKeys } from "./secrets/RuntimeSecretStore.js";
import { createHmac, timingSafeEqual } from "node:crypto";

export interface ValidationResult {
  valid: boolean;
  /** Alias for valid */
  isValid?: boolean;
  errors: string[];
  warnings: string[];
  provider?: string;
  providerAvailable?: boolean;
  llm?: ValidationResult;
  supabase?: ValidationResult;
  summary?: {
    totalErrors: number;
    totalWarnings: number;
  };
}

// Database env precedence: prefer DATABASE_URL everywhere.
// Legacy DB_* atomics are deprecated and should only be used in explicit fallback paths.
const REQUIRED_VARS = [
  { name: "DATABASE_URL", fix: "Run: pnpm run dx:env --mode local --force" },
  { name: "SUPABASE_URL", fix: "Run: pnpm run dx:env --mode local --force" },
  {
    name: "SUPABASE_KEY",
    fix: "Set SUPABASE_KEY to the same value as SUPABASE_ANON_KEY. See ops/env/README.md.",
  },
  {
    name: "WEB_SCRAPER_ENCRYPTION_KEY",
    fix: "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" and set in ops/env/.env.backend.<mode>",
  },
];

// TCT_SECRET is required in all environments to keep startup behavior consistent and fail-fast.
const REQUIRED_VARS_ALL_ENVS = [
  {
    name: "TCT_SECRET",
    fix: "Generate with: openssl rand -hex 32 and set in ops/env/.env.backend.<mode>. For test mode only, set TCT_ALLOW_EPHEMERAL_SECRET=true.",
  },
];

const RECOMMENDED_VARS = [
  { name: "SUPABASE_ANON_KEY", fix: "Set to local Supabase demo key" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", fix: "Only needed for admin operations" },
  { name: "REDIS_URL", fix: "Run: pnpm run dx to start Redis" },
];

const SECURE_NODE_ENVS = new Set(["staging", "production"]);
const STRICT_POSTGRES_SSL_MODES = new Set(["require", "verify-ca", "verify-full"]);

const DEPRECATED_ALIASES = [
  { deprecated: "SUPABASE_SERVICE_KEY", canonical: "SUPABASE_SERVICE_ROLE_KEY" },
];
const AUTH_FALLBACK_HARD_MAX_TTL_SECONDS = 30 * 60;
const AUTH_FALLBACK_INCIDENT_ID_PATTERN = /^INC-\d{4,}$/;
const FALLBACK_APPROVAL_ACTOR_PATTERN = /^[a-z0-9._:-]{3,128}$/i;


function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function validateCacheEncryptionRules(nodeEnv: string, errors: string[]): void {
  if (!SECURE_NODE_ENVS.has(nodeEnv)) {
    return;
  }

  if (!process.env.REDIS_URL) {
    return;
  }

  if (process.env.CACHE_ENCRYPTION_ENABLED === "false") {
    errors.push(`In ${nodeEnv}, CACHE_ENCRYPTION_ENABLED must not be false.`);
  }

  const cacheEncryptionKey = process.env.CACHE_ENCRYPTION_KEY;
  if (!cacheEncryptionKey) {
    errors.push(`In ${nodeEnv}, CACHE_ENCRYPTION_KEY is required.`);
  }
}

function parseBrowserTelemetryAllowedOrigins(rawOrigins: string | undefined): string[] {
  if (!rawOrigins) {
    return [];
  }

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function validateBrowserTelemetryControls(nodeEnv: string, errors: string[]): void {
  if (!SECURE_NODE_ENVS.has(nodeEnv)) {
    return;
  }

  const telemetryHashSalt = process.env.TELEMETRY_LOG_HASH_SALT?.trim();
  if (!telemetryHashSalt) {
    errors.push(`In ${nodeEnv}, TELEMETRY_LOG_HASH_SALT is required and must be non-empty.`);
  }

  const telemetryIngestionKey = process.env.BROWSER_TELEMETRY_INGESTION_KEY?.trim();
  if (!telemetryIngestionKey) {
    errors.push(`In ${nodeEnv}, BROWSER_TELEMETRY_INGESTION_KEY is required and must be non-empty.`);
  }

  const allowedOrigins = parseBrowserTelemetryAllowedOrigins(process.env.BROWSER_TELEMETRY_ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0) {
    errors.push(`In ${nodeEnv}, BROWSER_TELEMETRY_ALLOWED_ORIGINS must contain at least one explicit origin.`);
    return;
  }

  if (allowedOrigins.some((origin) => origin.includes("*"))) {
    errors.push(`In ${nodeEnv}, BROWSER_TELEMETRY_ALLOWED_ORIGINS must not include wildcard origins.`);
  }
}


function validateNoSecretInEnvPolicy(nodeEnv: string, errors: string[]): void {
  if (nodeEnv !== "production") {
    return;
  }

  const rawAllowlist = process.env.SECRET_ENV_ALLOWLIST ?? "";
  const allowlisted = new Set(
    rawAllowlist
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  for (const key of getSensitiveEnvKeys()) {
    if (!process.env[key]) {
      continue;
    }

    if (!allowlisted.has(key)) {
      errors.push(`Sensitive secret ${key} must not be sourced from process.env in production.`);
    }
  }
}

function validateSecureTransportRules(errors: string[]): void {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (!SECURE_NODE_ENVS.has(nodeEnv)) {
    return;
  }

  const dbUrlRaw = process.env.DATABASE_URL;
  if (dbUrlRaw) {
    const dbUrl = parseUrl(dbUrlRaw);
    if (!dbUrl) {
      errors.push("Invalid DATABASE_URL format. Must be a valid postgres URL.");
    } else {
      const sslMode = (dbUrl.searchParams.get("sslmode") ?? "").toLowerCase();
      if (!STRICT_POSTGRES_SSL_MODES.has(sslMode)) {
        errors.push(
          `In ${nodeEnv}, DATABASE_URL must enable TLS with sslmode=require, verify-ca, or verify-full.`
        );
      }
    }
  }

  const redisUrlRaw = process.env.REDIS_URL;
  if (redisUrlRaw) {
    const redisUrl = parseUrl(redisUrlRaw);
    if (!redisUrl) {
      errors.push("Invalid REDIS_URL format. Must be a valid redis URL.");
    } else if (redisUrl.protocol !== "rediss:") {
      errors.push(`In ${nodeEnv}, REDIS_URL must use TLS (rediss://...).`);
    }
  }

  const rejectUnauthorized = (process.env.REDIS_TLS_REJECT_UNAUTHORIZED ?? "true").toLowerCase();
  if (rejectUnauthorized !== "true") {
    errors.push(
      `In ${nodeEnv}, REDIS_TLS_REJECT_UNAUTHORIZED must be true to enforce certificate validation.`
    );
  }

  if (!process.env.REDIS_TLS_CA_CERT_PATH && !process.env.REDIS_TLS_CA_CERT) {
    errors.push(
      `In ${nodeEnv}, set REDIS_TLS_CA_CERT_PATH (preferred) or REDIS_TLS_CA_CERT to validate Redis certificates.`
    );
  }

  if (!process.env.REDIS_TLS_SERVERNAME) {
    errors.push(`In ${nodeEnv}, REDIS_TLS_SERVERNAME is required for Redis certificate hostname validation.`);
  }
}

function parseAuthFallbackList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function isStrictFallbackRoutePattern(routePattern: string, nodeEnv: string): boolean {
  const trimmed = routePattern.trim();
  if (!trimmed.startsWith("/")) {
    return false;
  }
  if (trimmed.includes("?") || trimmed.includes("#") || /\s/.test(trimmed)) {
    return false;
  }

  const wildcardCount = (trimmed.match(/\*/g) ?? []).length;
  if (wildcardCount === 0) {
    return true;
  }

  if (nodeEnv === "production") {
    return false;
  }

  return wildcardCount === 1 && trimmed.endsWith("*") && trimmed.length > 2;
}

function validateAuthFallbackConfig(nodeEnv: string, errors: string[]): void {
  if (nodeEnv !== "production") {
    return;
  }

  if (process.env.ALLOW_LOCAL_JWT_FALLBACK === "true") {
    errors.push("ALLOW_LOCAL_JWT_FALLBACK=true is forbidden in production.");
  }

  if (process.env.AUTH_FALLBACK_EMERGENCY_MODE !== "true") {
    return;
  }

  const ttlUntil = process.env.AUTH_FALLBACK_EMERGENCY_TTL_UNTIL;
  if (!ttlUntil) {
    errors.push("AUTH_FALLBACK_EMERGENCY_MODE=true requires AUTH_FALLBACK_EMERGENCY_TTL_UNTIL.");
    return;
  }

  const ttlDate = new Date(ttlUntil);
  if (Number.isNaN(ttlDate.getTime())) {
    errors.push("AUTH_FALLBACK_EMERGENCY_TTL_UNTIL must be a valid ISO-8601 timestamp.");
    return;
  }

  const ttlRemainingSeconds = Math.floor((ttlDate.getTime() - Date.now()) / 1000);
  if (ttlRemainingSeconds <= 0) {
    errors.push("AUTH_FALLBACK_EMERGENCY_TTL_UNTIL must be in the future.");
    return;
  }

  const maxDuration = Number(process.env.AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS ?? "14400");
  if (!Number.isFinite(maxDuration) || maxDuration <= 0) {
    errors.push("AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS must be a positive number.");
    return;
  }

  if (ttlRemainingSeconds > maxDuration) {
    errors.push(
      "AUTH_FALLBACK_EMERGENCY_TTL_UNTIL exceeds AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS."
    );
  }

  if (ttlRemainingSeconds > AUTH_FALLBACK_HARD_MAX_TTL_SECONDS) {
    errors.push(
      `AUTH_FALLBACK_EMERGENCY_TTL_UNTIL exceeds hard limit of ${AUTH_FALLBACK_HARD_MAX_TTL_SECONDS} seconds (30 minutes).`
    );
  }

  const incidentId = process.env.AUTH_FALLBACK_INCIDENT_ID;
  const incidentSeverity = process.env.AUTH_FALLBACK_INCIDENT_SEVERITY;
  const incidentStartedAt = process.env.AUTH_FALLBACK_INCIDENT_STARTED_AT;
  const incidentCorrelationId = process.env.AUTH_FALLBACK_INCIDENT_CORRELATION_ID;
  const allowedRoutes = parseAuthFallbackList(process.env.AUTH_FALLBACK_ALLOWED_ROUTES);
  const allowedMethods = parseAuthFallbackList(process.env.AUTH_FALLBACK_ALLOWED_METHODS);
  const signingSecret = process.env.AUTH_FALLBACK_INCIDENT_SIGNING_SECRET;
  const signature = process.env.AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE;
  const approvalToken = process.env.AUTH_FALLBACK_APPROVAL_TOKEN;
  const approvalSigningSecret = process.env.AUTH_FALLBACK_APPROVAL_SIGNING_SECRET;
  const maintenanceStart = process.env.AUTH_FALLBACK_MAINTENANCE_WINDOW_START;
  const maintenanceEnd = process.env.AUTH_FALLBACK_MAINTENANCE_WINDOW_END;

  if (!incidentId || !incidentSeverity || !incidentStartedAt || !incidentCorrelationId) {
    errors.push(
      "AUTH_FALLBACK_EMERGENCY_MODE=true requires AUTH_FALLBACK_INCIDENT_ID, AUTH_FALLBACK_INCIDENT_SEVERITY, AUTH_FALLBACK_INCIDENT_STARTED_AT, and AUTH_FALLBACK_INCIDENT_CORRELATION_ID."
    );
    return;
  }
  if (!AUTH_FALLBACK_INCIDENT_ID_PATTERN.test(incidentId)) {
    errors.push("AUTH_FALLBACK_INCIDENT_ID must match incident ticket format INC-<digits>.");
    return;
  }

  if (allowedRoutes.length === 0) {
    errors.push(
      "AUTH_FALLBACK_EMERGENCY_MODE=true requires AUTH_FALLBACK_ALLOWED_ROUTES."
    );
    return;
  }
  if (!allowedRoutes.every((routePattern) => isStrictFallbackRoutePattern(routePattern, nodeEnv))) {
    errors.push("AUTH_FALLBACK_ALLOWED_ROUTES must use strict route patterns; broad wildcards are forbidden in production.");
    return;
  }

  const effectiveMethods = allowedMethods.length > 0 ? allowedMethods.map((method) => method.toUpperCase()) : ["GET", "HEAD", "OPTIONS"];
  if (effectiveMethods.some((method) => !["GET", "HEAD", "OPTIONS"].includes(method))) {
    errors.push("AUTH_FALLBACK_ALLOWED_METHODS may only include GET, HEAD, or OPTIONS.");
    return;
  }

  if (!signingSecret || !signature) {
    errors.push(
      "AUTH_FALLBACK_EMERGENCY_MODE=true requires AUTH_FALLBACK_INCIDENT_SIGNING_SECRET and AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE."
    );
    return;
  }

  const payload = [
    incidentId,
    incidentSeverity,
    incidentStartedAt,
    incidentCorrelationId,
    ttlUntil,
    allowedRoutes.join(","),
    effectiveMethods.join(","),
  ].join("|");
  const expectedSignature = createHmac("sha256", signingSecret).update(payload).digest("hex");
  const providedSignature = signature.trim();

  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))
  ) {
    errors.push("AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE does not match signed incident context.");
  }

  if (!approvalToken || !approvalSigningSecret) {
    errors.push("AUTH_FALLBACK_EMERGENCY_MODE=true requires AUTH_FALLBACK_APPROVAL_TOKEN and AUTH_FALLBACK_APPROVAL_SIGNING_SECRET.");
    return;
  }

  const [approvalVersion, payloadSegment, signatureSegment] = approvalToken.split(".");
  if (!approvalVersion || !payloadSegment || !signatureSegment || approvalVersion !== "v1") {
    errors.push("AUTH_FALLBACK_APPROVAL_TOKEN must use format v1.<base64url-payload>.<hex-signature>.");
    return;
  }

  const expectedApprovalSignature = createHmac("sha256", approvalSigningSecret).update(payloadSegment).digest("hex");
  if (
    signatureSegment.length !== expectedApprovalSignature.length ||
    !timingSafeEqual(Buffer.from(signatureSegment), Buffer.from(expectedApprovalSignature))
  ) {
    errors.push("AUTH_FALLBACK_APPROVAL_TOKEN signature verification failed.");
    return;
  }

  let parsedApprovalPayload: {
    incidentId?: string;
    incidentCorrelationId?: string;
    approvedAt?: string;
    expiresAt?: string;
    scope?: string;
    ticketId?: string;
    approvedByPrimary?: string;
    approvedBySecondary?: string;
    approvalJustification?: string;
  } | null = null;
  try {
    parsedApprovalPayload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as typeof parsedApprovalPayload;
  } catch {
    errors.push("AUTH_FALLBACK_APPROVAL_TOKEN payload must be valid JSON.");
    return;
  }

  if (
    !parsedApprovalPayload ||
    parsedApprovalPayload.scope !== "auth-fallback" ||
    parsedApprovalPayload.incidentId !== incidentId ||
    parsedApprovalPayload.incidentCorrelationId !== incidentCorrelationId
  ) {
    errors.push("AUTH_FALLBACK_APPROVAL_TOKEN payload must match incidentId, incidentCorrelationId, and scope=auth-fallback.");
    return;
  }
  if (
    parsedApprovalPayload.ticketId !== incidentId ||
    !parsedApprovalPayload.approvedByPrimary ||
    !parsedApprovalPayload.approvedBySecondary ||
    parsedApprovalPayload.approvedByPrimary === parsedApprovalPayload.approvedBySecondary ||
    !FALLBACK_APPROVAL_ACTOR_PATTERN.test(parsedApprovalPayload.approvedByPrimary) ||
    !FALLBACK_APPROVAL_ACTOR_PATTERN.test(parsedApprovalPayload.approvedBySecondary) ||
    !parsedApprovalPayload.approvalJustification ||
    parsedApprovalPayload.approvalJustification.trim().length < 12
  ) {
    errors.push(
      "AUTH_FALLBACK_APPROVAL_TOKEN must include ticketId plus distinct approvedByPrimary/approvedBySecondary metadata and approvalJustification."
    );
    return;
  }

  const approvedAt = parsedApprovalPayload.approvedAt ? new Date(parsedApprovalPayload.approvedAt) : null;
  const expiresAt = parsedApprovalPayload.expiresAt ? new Date(parsedApprovalPayload.expiresAt) : null;
  if (!approvedAt || Number.isNaN(approvedAt.getTime()) || !expiresAt || Number.isNaN(expiresAt.getTime())) {
    errors.push("AUTH_FALLBACK_APPROVAL_TOKEN must include valid approvedAt and expiresAt timestamps.");
    return;
  }

  if (approvedAt.getTime() > Date.now() || expiresAt.getTime() <= Date.now()) {
    errors.push("AUTH_FALLBACK_APPROVAL_TOKEN must be currently valid.");
    return;
  }

  if (expiresAt.getTime() > ttlDate.getTime()) {
    errors.push("AUTH_FALLBACK_APPROVAL_TOKEN expiresAt must not exceed AUTH_FALLBACK_EMERGENCY_TTL_UNTIL.");
    return;
  }

  if (!maintenanceStart || !maintenanceEnd) {
    errors.push("AUTH_FALLBACK_EMERGENCY_MODE=true requires AUTH_FALLBACK_MAINTENANCE_WINDOW_START and AUTH_FALLBACK_MAINTENANCE_WINDOW_END.");
    return;
  }

  const maintenanceStartDate = new Date(maintenanceStart);
  const maintenanceEndDate = new Date(maintenanceEnd);
  if (Number.isNaN(maintenanceStartDate.getTime()) || Number.isNaN(maintenanceEndDate.getTime())) {
    errors.push("AUTH_FALLBACK_MAINTENANCE_WINDOW_START and AUTH_FALLBACK_MAINTENANCE_WINDOW_END must be valid ISO-8601 timestamps.");
    return;
  }

  const now = Date.now();
  if (maintenanceStartDate.getTime() >= maintenanceEndDate.getTime() || now < maintenanceStartDate.getTime() || now > maintenanceEndDate.getTime()) {
    errors.push("AUTH_FALLBACK_EMERGENCY_MODE=true is only allowed inside the approved maintenance window.");
    return;
  }

  const fallbackAlertThreshold = Number(process.env.AUTH_FALLBACK_ALERT_THRESHOLD ?? "1");
  const fallbackAlertWindowSeconds = Number(process.env.AUTH_FALLBACK_ALERT_WINDOW_SECONDS ?? "300");
  if (!Number.isFinite(fallbackAlertThreshold) || fallbackAlertThreshold <= 0) {
    errors.push("AUTH_FALLBACK_ALERT_THRESHOLD must be a positive number.");
    return;
  }
  if (fallbackAlertThreshold > 1) {
    errors.push("AUTH_FALLBACK_ALERT_THRESHOLD must be 1 to alert on any fallback activation.");
    return;
  }
  if (!Number.isFinite(fallbackAlertWindowSeconds) || fallbackAlertWindowSeconds <= 0) {
    errors.push("AUTH_FALLBACK_ALERT_WINDOW_SECONDS must be a positive number.");
    return;
  }
}

export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const llm = validateLLMConfig();
  const supabaseErrors: string[] = [];
  const supabaseWarnings: string[] = [];

  for (const { deprecated, canonical } of DEPRECATED_ALIASES) {
    if (process.env[deprecated]) {
      errors.push(`Deprecated ${deprecated} is set. Use ${canonical} instead.`);
    }
  }

  // Check required variables
  for (const { name, fix } of REQUIRED_VARS) {
    if (!process.env[name]) {
      errors.push(`Missing ${name}. Fix: ${fix}`);
    }
  }

  // Check vars required in all modes
  for (const { name, fix } of REQUIRED_VARS_ALL_ENVS) {
    if (!process.env[name]) {
      errors.push(`Missing ${name}. Fix: ${fix}`);
    }
  }

  // Check recommended variables (warnings only)
  for (const { name, fix } of RECOMMENDED_VARS) {
    if (!process.env[name]) {
      warnings.push(`Missing ${name}. ${fix}`);
    }
  }

  // Production: require Together API key to prevent misconfiguration
  errors.push(...llm.errors);
  warnings.push(...llm.warnings);

  // Production: MFA should be enabled. Keep this as a warning so health checks
  // can surface the risk without masking other validation categories.
  if (nodeEnv === "production" && process.env.MFA_ENABLED !== "true") {
    warnings.push(
      "MFA_ENABLED is not set to 'true' in production. Set MFA_ENABLED=true to enforce multi-factor authentication for all users."
    );
  }

  // Production: an encryption key must be present and in a format that encryption.ts
  // can parse: hex (64 chars), base64 (44 chars), or pbkdf2:<iterations>:<salt>:<passphrase>.
  // encryption.ts reads APP_ENCRYPTION_KEY first, falling back to ENCRYPTION_KEY, so mirror
  // that precedence here to avoid false-positive startup failures when only APP_ENCRYPTION_KEY
  // is set.
  if (nodeEnv === "production") {
    const encryptionKey = process.env.APP_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      errors.push("APP_ENCRYPTION_KEY (or ENCRYPTION_KEY) is required in production");
    } else if (
      !encryptionKey.startsWith("pbkdf2:") &&
      !encryptionKey.startsWith("hex:") &&
      !encryptionKey.startsWith("base64:") &&
      encryptionKey.length < 44 // minimum for a raw base64-encoded 32-byte key
    ) {
      errors.push(
        "APP_ENCRYPTION_KEY is too short. Use one of: hex (64 chars, generate with: openssl rand -hex 32), " +
        "base64 (44 chars, generate with: openssl rand -base64 32), " +
        "or pbkdf2:<iterations>:<salt>:<passphrase>"
      );
    }
  }


  // Canonical DB precedence: DATABASE_URL first, with explicit DB_URL fallback only for legacy compatibility.
  if (process.env.DB_URL && !process.env.DATABASE_URL) {
    warnings.push("Using legacy DB_URL fallback. Prefer DATABASE_URL.");
  }

  if (process.env.DB_URL && process.env.DATABASE_URL && process.env.DB_URL !== process.env.DATABASE_URL) {
    warnings.push("DATABASE_URL and DB_URL differ; DATABASE_URL takes precedence.");
  }

  // Validate DATABASE_URL format if present
  if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL;
    if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
      errors.push(`Invalid DATABASE_URL format. Must start with postgresql:// or postgres://`);
    }
  }

  // Validate SUPABASE_URL format if present
  if (process.env.SUPABASE_URL) {
    const url = process.env.SUPABASE_URL;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      errors.push(`Invalid SUPABASE_URL format. Must start with http:// or https://`);
    }
  }

  if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
    supabaseErrors.push("Missing SUPABASE_URL or VITE_SUPABASE_URL.");
  }

  if (!process.env.SUPABASE_KEY && !process.env.SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY) {
    supabaseErrors.push("Missing SUPABASE_KEY or SUPABASE_ANON_KEY.");
  }

  validateNoSecretInEnvPolicy(nodeEnv, errors);
  validateSecureTransportRules(errors);
  validateCacheEncryptionRules(nodeEnv, errors);
  validateBrowserTelemetryControls(nodeEnv, errors);
  validateAuthFallbackConfig(nodeEnv, errors);
  errors.push(...validateAuditLogEncryptionConfig(process.env));

  return {
    valid: errors.length === 0,
    isValid: errors.length === 0,
    errors,
    warnings,
    llm,
    supabase: {
      valid: supabaseErrors.length === 0,
      isValid: supabaseErrors.length === 0,
      errors: supabaseErrors,
      warnings: supabaseWarnings,
    },
    summary: {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
    },
  };
}

export function validateEnvOrThrow(): void {
  const { valid, errors, warnings } = validateEnv();

  // Log warnings but don't fail
  if (warnings.length > 0) {
    logger.warn("[validateEnv] Warnings:", { warnings });
  }

  if (!valid) {
    logger.error("[validateEnv] Environment validation failed:", { errors });
    logger.error("Run 'pnpm run dx:validate' for a full diagnostic.");
    throw new Error(`Environment validation failed: ${errors.join(", ")}`);
  }
}

export function validateLLMConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawProvider = process.env.VITE_LLM_PROVIDER?.trim().toLowerCase();
  const provider = rawProvider || "together";
  const providerAvailable = Boolean(process.env.TOGETHER_API_KEY);

  if (rawProvider && rawProvider !== "together") {
    errors.push(`together is the only supported provider. Received: ${rawProvider}`);
  }

  if (process.env.VITE_TOGETHER_API_KEY) {
    errors.push("SECURITY: VITE_TOGETHER_API_KEY must not be exposed to the browser.");
  }

  if ((process.env.NODE_ENV ?? "").toLowerCase() === "production" && !process.env.TOGETHER_API_KEY) {
    errors.push("TOGETHER_API_KEY is required in production");
  }

  if (!providerAvailable) {
    warnings.push("No Together API key configured");
  }

  return {
    valid: errors.length === 0,
    isValid: errors.length === 0,
    errors,
    warnings,
    provider,
    providerAvailable,
  };
}
