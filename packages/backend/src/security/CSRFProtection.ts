/**
 * CSRF Protection for Backend
 *
 * Simplified version for server-side use - just wraps fetch
 */

export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, options);
}