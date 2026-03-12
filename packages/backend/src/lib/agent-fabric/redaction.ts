import { createHash } from "node:crypto";

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
const ACCOUNT_ID_REGEX = /\b(?:acct|account|customer|client)[-_\s]?(?:id|number|no)?[:#\s-]*[A-Z0-9]{6,}\b/gi;
const SECRET_VALUE_REGEX = /\b(?:sk|pk|api|token|secret|password)[-_]?[A-Z0-9]{6,}\b/gi;

const REDACTED_EMAIL = "[REDACTED_EMAIL]";
const REDACTED_PHONE = "[REDACTED_PHONE]";
const REDACTED_ACCOUNT = "[REDACTED_ACCOUNT_ID]";
const REDACTED_SECRET = "[REDACTED_SECRET]";

export interface RedactionSummary {
  summary: string;
  hash: string;
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function redactSensitiveText(input: string): string {
  return input
    .replace(EMAIL_REGEX, REDACTED_EMAIL)
    .replace(PHONE_REGEX, REDACTED_PHONE)
    .replace(ACCOUNT_ID_REGEX, REDACTED_ACCOUNT)
    .replace(SECRET_VALUE_REGEX, REDACTED_SECRET);
}

export function redactSensitiveValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = redactSensitiveValue(entry);
    }
    return result;
  }

  return value;
}

export function summarizeRedactedContent(content: string, maxLength: number = 160): RedactionSummary {
  const redacted = redactSensitiveText(content);
  const normalized = redacted.replace(/\s+/g, " ").trim();
  const summary = normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;

  return {
    summary,
    hash: hashContent(redacted),
  };
}

export function buildProtectedMemoryContent(content: string, maxLength: number = 120): string {
  const { summary, hash } = summarizeRedactedContent(content, maxLength);
  return `[HIGH_TRUST_SUMMARY] ${summary} [HASH:${hash}]`;
}
