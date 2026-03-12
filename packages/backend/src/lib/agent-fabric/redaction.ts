import { createHash } from "node:crypto";

const DEFAULT_MAX_SUMMARY_LENGTH = 180;

const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED_EMAIL]" },
  { pattern: /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?){2}\d{4}\b/g, replacement: "[REDACTED_PHONE]" },
  { pattern: /\b(?:acct|account|acc|iban|routing|customer)[-_\s:#]*[a-z0-9-]{4,}\b/gi, replacement: "[REDACTED_ACCOUNT_ID]" },
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
    ? `${normalized.slice(0, maxLength)}...`
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
