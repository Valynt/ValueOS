"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWithRetry = fetchWithRetry;
/**
 * Shared fetchWithRetry utility for Ground Truth clients
 * Exports a single function used across multiple API clients to provide
 * exponential-backoff retry semantics and structured logging.
 */
const logger_1 = require("../../../lib/logger");
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 500) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, options);
            return res;
        }
        catch (err) {
            lastError = err;
            logger_1.logger.warn("Fetch failed, retrying", { url, attempt, error: err });
            if (attempt < retries) {
                await new Promise((res) => setTimeout(res, backoff * Math.pow(2, attempt)));
            }
        }
    }
    logger_1.logger.error("Fetch failed after retries", { url, error: lastError });
    throw lastError;
}
//# sourceMappingURL=fetchWithRetry.js.map