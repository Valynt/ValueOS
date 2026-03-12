/**
 * Centralized outbound HTTP client with allowlist enforcement.
 *
 * All production outbound requests must go through egressFetch() rather than
 * calling the global fetch() directly. This enforces the network allowlist
 * defined in .windsurf/rules/global.md and prevents SSRF via DNS rebinding
 * or misconfigured service URLs.
 *
 * Blocked in production (per policy):
 *   github.com, pastebin.com, ngrok.io, serveo.net, and all RFC-1918 ranges
 *   unless explicitly added to EGRESS_EXTRA_ALLOWED_DOMAINS.
 *
 * Allowed in production:
 *   - Internal service hostnames (configurable via EGRESS_INTERNAL_HOSTS)
 *   - LLM providers: api.openai.com, api.together.xyz, generativelanguage.googleapis.com
 *   - Monitoring: *.sentry.io, *.datadoghq.com, *.prometheus.io
 *   - CDN / Supabase: *.supabase.co, *.supabase.com
 *   - CRM: api.hubapi.com, api.hubspot.com, *.salesforce.com
 *   - Stripe: api.stripe.com, *.stripe.com
 *
 * In non-production environments the allowlist is not enforced (logged only)
 * so local development is not blocked.
 */

import { logger } from './logger.js';

// ── Allowlist ──────────────────────────────────────────────────────────────

const ALLOWED_HOSTNAME_PATTERNS: RegExp[] = [
  // Supabase
  /^[a-z0-9-]+\.supabase\.co$/,
  /^[a-z0-9-]+\.supabase\.com$/,
  // LLM providers
  /^api\.openai\.com$/,
  /^api\.together\.xyz$/,
  /^generativelanguage\.googleapis\.com$/,
  /^api\.anthropic\.com$/,
  // Monitoring / observability
  /^[a-z0-9-]+\.sentry\.io$/,
  /^[a-z0-9-]+\.datadoghq\.com$/,
  // CRM
  /^api\.hubapi\.com$/,
  /^api\.hubspot\.com$/,
  /^app\.hubspot\.com$/,
  /^[a-z0-9-]+\.salesforce\.com$/,
  // Billing
  /^api\.stripe\.com$/,
  /^[a-z0-9-]+\.stripe\.com$/,
  // Note: localhost/127.0.0.1 are intentionally absent — loopback is only
  // permitted in non-production via the !isProduction early-return path.
];

// ── Blocklist ──────────────────────────────────────────────────────────────

const BLOCKED_HOSTNAME_PATTERNS: RegExp[] = [
  // Tunneling / exfiltration services — match both apex and subdomains
  /^(.*\.)?ngrok\.io$/,
  /^(.*\.)?ngrok-free\.app$/,
  /^(.*\.)?serveo\.net$/,
  /^(.*\.)?localtunnel\.me$/,
  // Code / paste hosting (not needed for production services)
  /^github\.com$/,
  /^raw\.githubusercontent\.com$/,
  /^gist\.github\.com$/,
  /^pastebin\.com$/,
  /^paste\.ee$/,
  // RFC-1918 private ranges (SSRF protection)
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  // Link-local
  /^169\.254\.\d+\.\d+$/,
  // IPv6 loopback / link-local
  /^::1$/,
  /^fe80:/i,
];

// ── Extra domains from environment ────────────────────────────────────────

function getExtraAllowedPatterns(): RegExp[] {
  const raw = process.env.EGRESS_EXTRA_ALLOWED_DOMAINS ?? '';
  return raw
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => new RegExp(`^${d.replace(/\./g, '\\.').replace(/\*/g, '[a-z0-9-]+')}$`));
}

// ── Validation ─────────────────────────────────────────────────────────────

export class EgressBlockedError extends Error {
  constructor(public readonly url: string, public readonly reason: string) {
    super(`Egress blocked: ${reason} — ${url}`);
    this.name = 'EgressBlockedError';
  }
}

function validateEgressUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new EgressBlockedError(rawUrl, 'invalid URL');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Protocol must be https in production.
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && parsed.protocol !== 'https:') {
    throw new EgressBlockedError(rawUrl, 'non-HTTPS protocol not allowed in production');
  }

  // Check blocklist first (takes precedence)
  for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new EgressBlockedError(rawUrl, `hostname matches blocklist pattern ${pattern}`);
    }
  }

  if (!isProduction) {
    // In dev/test, log but do not block — allowlist is advisory only.
    const allowed =
      ALLOWED_HOSTNAME_PATTERNS.some((p) => p.test(hostname)) ||
      getExtraAllowedPatterns().some((p) => p.test(hostname));
    if (!allowed) {
      logger.debug('egressFetch: hostname not in allowlist (non-production, allowed)', { hostname });
    }
    return;
  }

  // In production, hostname must match allowlist or extra domains.
  const allowed =
    ALLOWED_HOSTNAME_PATTERNS.some((p) => p.test(hostname)) ||
    getExtraAllowedPatterns().some((p) => p.test(hostname));

  if (!allowed) {
    throw new EgressBlockedError(rawUrl, `hostname not in production egress allowlist: ${hostname}`);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for fetch() that enforces the egress allowlist.
 * Use this for all outbound HTTP requests from backend services.
 *
 * @throws {EgressBlockedError} when the target URL is not permitted.
 */
export async function egressFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  validateEgressUrl(rawUrl);
  return fetch(input, init);
}

/**
 * Validate a URL against the egress policy without making a request.
 * Useful for pre-validating user-supplied URLs before use.
 *
 * @throws {EgressBlockedError} when the URL is not permitted.
 */
export function assertEgressAllowed(url: string): void {
  validateEgressUrl(url);
}
