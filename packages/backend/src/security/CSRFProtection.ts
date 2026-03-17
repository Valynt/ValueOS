/**
 * CSRF Protection for Backend
 *
 * Simplified version for server-side use - just wraps fetch
 */

export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // eslint-disable-next-line no-restricted-globals -- legitimate direct fetch usage
  return fetch(url, options);
}