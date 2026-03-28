/**
 * Safe Navigation Utilities
 *
 * Provides validated, secure navigation helpers to prevent open redirect
 * vulnerabilities and ensure URL safety.
 */

import { logger } from "./logger";

// Valid internal path prefixes
const VALID_PATH_PREFIXES = [
  "/org/",
  "/dashboard",
  "/opportunities",
  "/models",
  "/agents",
  "/integrations",
  "/settings",
  "/workspace",
  "/billing",
  "/company",
  "/login",
  "/signup",
  "/reset-password",
  "/create-org",
  "/onboarding",
];

// UUID v4 regex for validating IDs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Safe slug regex (alphanumeric, hyphens, underscores)
const SAFE_SLUG_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Validates that a string is a safe UUID
 */
export function isValidUuid(value: string | undefined | null): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

/**
 * Validates that a string is a safe URL slug
 */
export function isValidSlug(value: string | undefined | null): boolean {
  if (!value) return false;
  return SAFE_SLUG_REGEX.test(value) && value.length > 0 && value.length <= 64;
}

/**
 * Validates a tenant-scoped path component
 */
export function isValidTenantPath(path: string): boolean {
  // Must start with /org/ and contain valid tenant identifier
  if (!path.startsWith("/org/")) {
    return false;
  }

  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) {
    return false;
  }

  // Validate tenant identifier (UUID or safe slug)
  const tenantId = parts[1];
  if (!isValidUuid(tenantId) && !isValidSlug(tenantId)) {
    return false;
  }

  return true;
}

/**
 * Sanitizes and validates an internal navigation path
 * Returns null if the path is unsafe
 */
export function sanitizeInternalPath(path: string): string | null {
  // Reject absolute URLs
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    logger.warn("Blocked absolute URL navigation attempt", { path });
    return null;
  }

  // Reject protocol-relative URLs
  if (path.startsWith("//")) {
    logger.warn("Blocked protocol-relative URL navigation attempt", { path });
    return null;
  }

  // Normalize path
  const normalized = path.startsWith("/") ? path : `/${path}`;

  // Check for path traversal attempts
  if (normalized.includes("..") || normalized.includes("./")) {
    logger.warn("Blocked path traversal attempt", { path });
    return null;
  }

  // Validate against allowed prefixes
  const isValidPrefix = VALID_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );

  if (!isValidPrefix) {
    logger.warn("Blocked navigation to invalid path prefix", { path });
    return null;
  }

  return normalized;
}

/**
 * Safely navigates to an internal path with validation
 * Falls back to the provided fallback path (default: /dashboard) if invalid
 */
export function safeNavigate(
  path: string,
  options: { fallback?: string; window?: Window } = {}
): void {
  if (typeof window === "undefined") return;

  const { fallback = "/dashboard", window: targetWindow = window } = options;

  const sanitized = sanitizeInternalPath(path);
  const safePath = sanitized ?? sanitizeInternalPath(fallback) ?? "/dashboard";

  targetWindow.location.href = safePath;
}

/**
 * Creates a tenant-scoped path safely
 */
export function buildTenantPath(
  tenantId: string,
  leafPath: string = "dashboard"
): string | null {
  if (!isValidUuid(tenantId) && !isValidSlug(tenantId)) {
    logger.warn("Invalid tenant ID for path building", { tenantId });
    return null;
  }

  const sanitizedLeaf = sanitizeInternalPath(leafPath);
  if (!sanitizedLeaf) {
    return null;
  }

  // Remove leading / if present in leaf path
  const cleanLeaf = sanitizedLeaf.startsWith("/")
    ? sanitizedLeaf.slice(1)
    : sanitizedLeaf;

  return `/org/${tenantId}/${cleanLeaf}`;
}

/**
 * Safely reloads the current page
 */
export function safeReload(): void {
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

/**
 * Navigates to login with optional return URL
 */
export function navigateToLogin(returnUrl?: string): void {
  if (typeof window === "undefined") return;

  if (returnUrl) {
    const sanitized = sanitizeInternalPath(returnUrl);
    if (sanitized) {
      const params = new URLSearchParams();
      params.set("returnTo", sanitized);
      window.location.href = `/login?${params.toString()}`;
      return;
    }
  }

  window.location.href = "/login";
}
