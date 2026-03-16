import { createHash } from "node:crypto";

const DEFAULT_MAX_SUMMARY_LENGTH = 180;

/**
 * PII and secret patterns applied by redactSensitiveText().
 * Covers the full set required by .windsurf/rules/global.md:
 * SSN, credit card, email, phone, passport, DOB, healthcare IDs, secrets.
 *
 * Order matters: more specific patterns (CC, SSN) run before broader ones.
 */
const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // US Social Security Number: 123-45-6789 or 123 45 6789
  { pattern: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g, replacement: "[REDACTED_SSN]" },
  // Credit/debit card numbers anchored to known card prefixes to avoid false positives
  // on financial figures, timestamps, and numeric IDs.
  // Visa (4), Mastercard (51-55 / 2221-2720), Amex (34/37), Discover (6011/65)
  { pattern: /\b4\d{3}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, replacement: "[REDACTED_CC]" },
  { pattern: /\b5[1-5]\d{2}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, replacement: "[REDACTED_CC]" },
  { pattern: /\b2(?:2[2-9]\d|[3-6]\d{2}|7[01]\d|720)[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, replacement: "[REDACTED_CC]" },
  { pattern: /\b3[47]\d{2}[ -]?\d{6}[ -]?\d{5}\b/g, replacement: "[REDACTED_CC]" },
  { pattern: /\b6(?:011|5\d{2})[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, replacement: "[REDACTED_CC]" },
  // Passport numbers: letter(s) + 6–9 digits (common formats)
  { pattern: /\b[A-Z]{1,2}\d{6,9}\b/g, replacement: "[REDACTED_PASSPORT]" },
  // US NPI (National Provider Identifier): exactly 10 digits
  { pattern: /\bNPI[:\s#]*\d{10}\b/gi, replacement: "[REDACTED_NPI]" },
  // Date of birth patterns: MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY
  { pattern: /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g, replacement: "[REDACTED_DOB]" },
  { pattern: /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g, replacement: "[REDACTED_DOB]" },
  // Email addresses
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED_EMAIL]" },
  // Phone numbers (international and US formats)
  { pattern: /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?){2}\d{4}\b/g, replacement: "[REDACTED_PHONE]" },
  // Account / IBAN identifiers
  { pattern: /\b(?:acct|account|acc|iban|routing|customer)[-_\s:#]*[a-z0-9-]{4,}\b/gi, replacement: "[REDACTED_ACCOUNT_ID]" },
  // API keys, tokens, secrets
  { pattern: /\b(?:sk|pk|api|token|secret|key)[-_]?(?:live|test|prod)?[_-]?[a-z0-9]{8,}\b/gi, replacement: "[REDACTED_SECRET]" },
];

export interface RedactedText {
  redactedText: string;
  redactionCount: number;
}

export interface ContentSummary {
  summary: string;
  hash: string;
  redactionCount: number;
}

export function redactSensitiveText(text: string): RedactedText {
  let redactedText = text;
  let redactionCount = 0;

  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    redactedText = redactedText.replace(pattern, () => {
      redactionCount += 1;
      return replacement;
    });
  }

  return { redactedText, redactionCount };
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function summarizeSensitiveContent(content: string, maxLength = DEFAULT_MAX_SUMMARY_LENGTH): ContentSummary {
  const { redactedText, redactionCount } = redactSensitiveText(content);
  const normalized = redactedText.replace(/\s+/g, " ").trim();
  const truncated = normalized.length > maxLength
    ? (maxLength > 3
      ? `${normalized.slice(0, maxLength - 3)}...`
      : normalized.slice(0, maxLength))
    : normalized;

  return {
    summary: truncated,
    hash: hashContent(content),
    redactionCount,
  };
}

export function sanitizeLogPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitizedEntries = Object.entries(payload).map(([key, value]) => [key, sanitizeValue(value)]);
  return Object.fromEntries(sanitizedEntries);
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value).redactedText;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === "object") {
    return sanitizeLogPayload(value as Record<string, unknown>);
  }

  return value;
}
