import { createHash } from "crypto";

const REDACTED_VALUE = "[REDACTED]";
const REDACTED_TEXT = "[redacted]";
const REDACTED_EMAIL_DOMAIN = "redacted.local";

const EMAIL_FIELD_NAMES = new Set([
  "email",
  "user_email",
  "contact_email",
  "owner_email",
  "billing_email",
]);

const NULLABLE_PROFILE_FIELDS = new Set([
  "full_name",
  "display_name",
  "first_name",
  "last_name",
  "avatar_url",
  "phone",
  "mobile",
  "telephone",
  "address",
  "dob",
  "date_of_birth",
  "birthdate",
]);

const REDACTED_TEXT_FIELDS = new Set([
  "content",
  "description",
  "notes",
  "message",
  "transcript",
  "diagnosis",
  "prescription",
]);

const SECRET_FIELD_KEYWORDS = [
  "token",
  "secret",
  "password",
  "auth",
  "session",
  "cookie",
  "ssn",
  "passport",
  "license",
  "tax",
  "credit",
  "card",
  "iban",
  "swift",
];

function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shouldRedactKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SECRET_FIELD_KEYWORDS.some((keyword) => lowerKey.includes(keyword));
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function looksLikePhone(value: string): boolean {
  return /(?:\+?\d[\d\s().-]{7,}\d)/.test(value);
}

function looksLikeSsn(value: string): boolean {
  return /\b\d{3}-\d{2}-\d{4}\b/.test(value);
}

function looksLikeCreditCard(value: string): boolean {
  return /\b(?:\d[ -]*?){13,19}\b/.test(value);
}

function looksLikeSecret(value: string): boolean {
  return (
    /^Bearer\s+[A-Za-z0-9._-]+$/i.test(value) ||
    /^[A-Za-z0-9_-]{32,}$/.test(value)
  );
}

function anonymizeScalar(key: string | undefined, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalizedKey = key?.toLowerCase();

  if (normalizedKey && EMAIL_FIELD_NAMES.has(normalizedKey)) {
    return buildDeletedPlaceholderEmail(value);
  }

  if (normalizedKey && NULLABLE_PROFILE_FIELDS.has(normalizedKey)) {
    return null;
  }

  if (normalizedKey && REDACTED_TEXT_FIELDS.has(normalizedKey)) {
    return REDACTED_TEXT;
  }

  if (normalizedKey && shouldRedactKey(normalizedKey)) {
    return REDACTED_VALUE;
  }

  if (looksLikeEmail(value)) {
    return buildDeletedPlaceholderEmail(value);
  }

  if (looksLikePhone(value) || looksLikeSsn(value) || looksLikeCreditCard(value) || looksLikeSecret(value)) {
    return REDACTED_VALUE;
  }

  return value;
}

export function buildDeletedPlaceholderEmail(value: string, fallbackId?: string): string {
  const seed = `${value}:${fallbackId ?? "anon"}`;
  return `deleted+${stableHash(seed)}@${REDACTED_EMAIL_DOMAIN}`;
}

export function buildAnonymizedMetadata(
  existing: unknown,
  anonymizedAt: string = new Date().toISOString(),
): Record<string, unknown> {
  const base = isRecord(existing) ? { ...existing } : {};
  return {
    ...base,
    anonymized: true,
    anonymized_at: anonymizedAt,
    source: "non-prod-anonymization-pipeline",
  };
}

export function anonymizeNonProductionData<T>(
  input: T,
  anonymizedAt: string = new Date().toISOString(),
): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((entry) => anonymizeNonProductionData(entry, anonymizedAt)) as T;
  }

  if (isRecord(input)) {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (key === "metadata") {
        result[key] = buildAnonymizedMetadata(value, anonymizedAt);
        continue;
      }

      if (Array.isArray(value)) {
        result[key] = value.map((entry) => anonymizeNonProductionData(entry, anonymizedAt));
        continue;
      }

      if (isRecord(value)) {
        result[key] = anonymizeNonProductionData(value, anonymizedAt);
        continue;
      }

      result[key] = anonymizeScalar(key, value);
    }

    return result as T;
  }

  return anonymizeScalar(undefined, input) as T;
}

export const NON_PROD_SENSITIVE_FIELD_NAMES = [
  ...EMAIL_FIELD_NAMES,
  ...NULLABLE_PROFILE_FIELDS,
  ...REDACTED_TEXT_FIELDS,
  ...SECRET_FIELD_KEYWORDS,
];

export const NON_PROD_ALLOWED_EMAIL_SUFFIXES = [`@${REDACTED_EMAIL_DOMAIN}`];
export const NON_PROD_REDACTED_VALUE = REDACTED_VALUE;
export const NON_PROD_REDACTED_TEXT = REDACTED_TEXT;
