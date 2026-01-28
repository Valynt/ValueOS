/**
 * Shared fetchWithRetry utility for Ground Truth clients
 * Exports a single function used across multiple API clients to provide
 * exponential-backoff retry semantics and structured logging.
 */
import { logger } from "../lib/logger";

export async function fetchWithRetry(
  url: string,
  options: any = {},
  retries = 3,
  backoff = 500
): Promise<Response> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      lastError = err;
      logger.warn("Fetch failed, retrying", { url, attempt, error: err });
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, backoff * Math.pow(2, attempt)));
      }
    }
  }

  logger.error("Fetch failed after retries", { url, error: lastError });
  throw lastError;
}
