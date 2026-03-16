/**
 * FIDES-style context sanitization
 *
 * Removes fields tagged pii or secret from agent reasoning context before
 * they are injected into LLM prompts. Prevents raw PII from appearing in
 * agent reasoning paths (ComplianceAuditorAgent, FinancialModelingAgent).
 *
 * Fields are tagged by including a parallel metadata object with the same
 * key suffixed by "_meta": { ssn: "123-45-6789", ssn_meta: { pii: true } }
 * OR by matching a static list of known PII/secret field names.
 *
 * Replaced values become the string "[REDACTED]".
 */

const KNOWN_PII_FIELDS = new Set([
  "ssn",
  "social_security_number",
  "date_of_birth",
  "dob",
  "passport_number",
  "credit_card",
  "card_number",
  "healthcare_id",
  "npi",
  "email",
  "phone",
  "phone_number",
  "address",
  "street_address",
]);

const KNOWN_SECRET_FIELDS = new Set([
  "password",
  "secret",
  "api_key",
  "access_token",
  "refresh_token",
  "private_key",
  "client_secret",
  "token",
  "credential",
]);

type ContextValue = string | number | boolean | null | undefined | Record<string, unknown> | unknown[];

/**
 * Sanitize a flat or nested context object for agent consumption.
 * - Fields with a matching `_meta: { pii: true }` or `_meta: { secret: true }` sibling are redacted.
 * - Fields whose key matches KNOWN_PII_FIELDS or KNOWN_SECRET_FIELDS are redacted.
 * - Nested objects are recursively sanitized.
 * - Arrays are passed through (elements are not individually inspected).
 */
export function sanitizeForAgent(context: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    // Skip meta-annotation keys — they are consumed here, not forwarded.
    if (key.endsWith("_meta")) continue;

    const meta = context[`${key}_meta`];
    const isTaggedPii = typeof meta === "object" && meta !== null && (meta as Record<string, unknown>).pii === true;
    const isTaggedSecret = typeof meta === "object" && meta !== null && (meta as Record<string, unknown>).secret === true;
    const isKnownPii = KNOWN_PII_FIELDS.has(key.toLowerCase());
    const isKnownSecret = KNOWN_SECRET_FIELDS.has(key.toLowerCase());

    if (isTaggedPii || isTaggedSecret || isKnownPii || isKnownSecret) {
      out[key] = "[REDACTED]";
      continue;
    }

    // Recurse into nested objects.
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizeForAgent(value as Record<string, unknown>);
      continue;
    }

    out[key] = value as ContextValue;
  }

  return out;
}
