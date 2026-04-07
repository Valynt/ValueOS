/**
 * Graph Sharing — Generate shareable links for graph views
 *
 * Phase 5.4: Value Graph Polish
 *
 * Creates read-only, time-limited shareable links to graph views.
 */

import type { WarmthState } from "@shared/domain/Warmth";

interface ShareableView {
  /** Filter by warmth state */
  warmth?: WarmthState;
  /** Filter by defensibility score threshold */
  defensibilityMin?: number;
  /** Filter by evidence age (days) */
  evidenceMaxAge?: number;
  /** Filter by value range */
  valueMin?: number;
  valueMax?: number;
  /** Active view mode */
  view: "canvas" | "narrative" | "list";
  /** Selected node IDs */
  selectedNodes?: string[];
  /** Canvas position */
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

/**
 * Generate a shareable link for a graph view.
 *
 * @param caseId — Case ID
 * @param view — View configuration
 * @param options — Link options
 * @returns Shareable URL
 */
export function generateGraphShareLink(
  caseId: string,
  view: Partial<ShareableView>,
  options: {
    /** Time-to-live in hours (default: 168 = 7 days) */
    ttl?: number;
    /** Whether link requires authentication */
    requireAuth?: boolean;
    /** Specific permissions for the link */
    permissions?: "read" | "comment" | "edit";
  } = {}
): string {
  const { ttl = 168, requireAuth = false, permissions = "read" } = options;

  // Encode view configuration
  const viewParam = encodeURIComponent(JSON.stringify(view));

  // Generate token (in production, this would be a signed JWT)
  const token = generateShareToken(caseId, view, { ttl, requireAuth, permissions });

  // Build URL
  const baseUrl = window.location.origin;
  const url = new URL(`${baseUrl}/share/graph/${caseId}`);
  url.searchParams.set("v", viewParam);
  url.searchParams.set("t", token);

  return url.toString();
}

/**
 * Parse a shareable link and extract view configuration.
 *
 * @param url — URL to parse
 * @returns Parsed view configuration or null if invalid
 */
export function parseGraphShareLink(url: string): {
  caseId: string;
  view: ShareableView;
  isValid: boolean;
} | null {
  try {
    const parsedUrl = new URL(url);
    const viewParam = parsedUrl.searchParams.get("v");
    const token = parsedUrl.searchParams.get("t");

    if (!viewParam || !token) return null;

    // Verify token (in production, validate signature)
    const isValid = verifyShareToken(token);
    if (!isValid) return null;

    // Extract case ID from path
    const pathMatch = parsedUrl.pathname.match(/\/share\/graph\/([^/]+)/);
    if (!pathMatch) return null;
    const caseId = pathMatch[1];

    // Parse view configuration
    const view = JSON.parse(decodeURIComponent(viewParam)) as ShareableView;

    return { caseId, view, isValid: true };
  } catch {
    return null;
  }
}

/**
 * Generate a share token (simplified stub).
 * In production, this would create a signed JWT.
 *
 * @param caseId — Case ID
 * @param view — View configuration
 * @param options — Token options
 * @returns Token string
 */
function generateShareToken(
  caseId: string,
  view: Partial<ShareableView>,
  options: {
    ttl: number;
    requireAuth: boolean;
    permissions: string;
  }
): string {
  const payload = {
    caseId,
    view,
    exp: Date.now() + options.ttl * 60 * 60 * 1000,
    auth: options.requireAuth,
    perm: options.permissions,
  };

  // Simple base64 encoding for stub
  // In production, use proper JWT signing
  return btoa(JSON.stringify(payload));
}

/**
 * Verify a share token (simplified stub).
 * In production, this would validate JWT signature.
 *
 * @param token — Token to verify
 * @returns true if valid
 */
function verifyShareToken(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token));

    // Check expiration
    if (payload.exp && payload.exp < Date.now()) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Revoke a shareable link.
 * In production, this would add token to a revocation list.
 *
 * @param token — Token to revoke
 */
export function revokeShareLink(token: string): void {
  // TODO: Implement token revocation
  console.log(`Revoking token: ${token.substring(0, 10)}...`);
}

/**
 * Get share link metadata.
 *
 * @param token — Share token
 * @returns Metadata or null if invalid
 */
export function getShareLinkMetadata(token: string): {
  caseId: string;
  expiresAt: Date;
  permissions: string;
  isExpired: boolean;
} | null {
  try {
    const payload = JSON.parse(atob(token));

    return {
      caseId: payload.caseId,
      expiresAt: new Date(payload.exp),
      permissions: payload.perm,
      isExpired: payload.exp < Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Encode filters into URL query parameters.
 *
 * @param filters — Filter configuration
 * @returns Query parameter string
 */
export function encodeFilters(filters: Partial<ShareableView>): string {
  const params = new URLSearchParams();

  if (filters.warmth) params.set("warmth", filters.warmth);
  if (filters.defensibilityMin !== undefined)
    params.set("defMin", String(filters.defensibilityMin));
  if (filters.evidenceMaxAge !== undefined)
    params.set("evAge", String(filters.evidenceMaxAge));
  if (filters.valueMin !== undefined)
    params.set("valMin", String(filters.valueMin));
  if (filters.valueMax !== undefined)
    params.set("valMax", String(filters.valueMax));
  if (filters.view) params.set("view", filters.view);

  return params.toString();
}

/**
 * Decode filters from URL query parameters.
 *
 * @param searchString — URL search string
 * @returns Filter configuration
 */
export function decodeFilters(searchString: string): Partial<ShareableView> {
  const params = new URLSearchParams(searchString);
  const filters: Partial<ShareableView> = {};

  const warmth = params.get("warmth");
  if (warmth) filters.warmth = warmth as WarmthState;

  const defMin = params.get("defMin");
  if (defMin !== null) filters.defensibilityMin = parseFloat(defMin);

  const evAge = params.get("evAge");
  if (evAge !== null) filters.evidenceMaxAge = parseInt(evAge, 10);

  const valMin = params.get("valMin");
  if (valMin !== null) filters.valueMin = parseFloat(valMin);

  const valMax = params.get("valMax");
  if (valMax !== null) filters.valueMax = parseFloat(valMax);

  const view = params.get("view");
  if (view) filters.view = view as ShareableView["view"];

  return filters;
}
