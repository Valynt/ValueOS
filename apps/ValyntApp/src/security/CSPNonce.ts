/**
 * CSP Nonce Generator
 *
 * Generates cryptographic nonces for Content Security Policy
 * to allow inline scripts/styles без using unsafe-inline
 *
 * SECURITY: INP-002 - Mitigates XSS by requiring nonces for inline content
 */

/**
 * Generate a cryptographically secure nonce
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Store for current request nonce (server-side)
 */
let currentNonce: string | null = null;

/**
 * Set nonce for current request
 */
export function setRequestNonce(nonce: string): void {
  currentNonce = nonce;
}

/**
 * Get current request nonce
 */
export function getRequestNonce(): string | null {
  return currentNonce;
}

/**
 * Clear request nonce
 */
export function clearRequestNonce(): void {
  currentNonce = null;
}

/**
 * Add nonce to CSP directives
 */
export function addNonceToCsp(
  directives: Record<string, string[]>,
  nonce: string
): Record<string, string[]> {
  return {
    ...directives,
    scriptSrc: [...(directives.scriptSrc || []), `'nonce-${nonce}'`],
    styleSrc: [...(directives.styleSrc || []), `'nonce-${nonce}'`],
  };
}

/**
 * Minimal Express-compatible middleware types (avoids importing @types/express in a browser bundle)
 */
interface ExpressResponse {
  locals: Record<string, unknown>;
  on: (event: string, listener: () => void) => void;
}
type NextFn = () => void;

/**
 * Express middleware to inject CSP nonce
 */
export function cspNonceMiddleware(_req: unknown, res: ExpressResponse, next: NextFn): void {
  const nonce = generateNonce();
  setRequestNonce(nonce);

  // Make nonce available to templates
  res.locals.cspNonce = nonce;

  // Clear after response
  res.on("finish", () => {
    clearRequestNonce();
  });

  next();
}
