import { NextFunction, Request, Response } from "express";

/**
 * Performance optimization middleware for HTTP caching headers
 * Sets appropriate Cache-Control headers for static assets and API responses
 */
export function cachingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const url = req.url;
  const method = req.method;

  // Only set caching for GET requests
  if (method !== "GET") {
    return next();
  }

  // Static assets (images, fonts, CSS, JS)
  if (isStaticAsset(url)) {
    // Cache static assets for 1 year (31536000 seconds)
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("ETag", generateETag(url));
    return next();
  }

  // API responses - cache based on endpoint
  if (url.startsWith("/api/")) {
    const cacheMaxAge = getApiCacheMaxAge(url);
    if (cacheMaxAge > 0) {
      res.setHeader("Cache-Control", `public, max-age=${cacheMaxAge}`);
      res.setHeader("ETag", generateETag(`${url}${JSON.stringify(req.query)}`));
    } else {
      // No cache for dynamic endpoints
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }

  next();
}

/**
 * Check if the URL is a static asset
 */
function isStaticAsset(url: string): boolean {
  const staticExtensions = [
    ".js",
    ".css",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
  ];

  return staticExtensions.some((ext) => url.endsWith(ext));
}

/**
 * Get appropriate cache max-age for API endpoints
 * Returns seconds, 0 means no cache
 */
function getApiCacheMaxAge(url: string): number {
  // Health checks - short cache
  if (url.includes("/health")) {
    return 300; // 5 minutes
  }

  // Static data that rarely changes
  if (
    url.includes("/api/projects") ||
    url.includes("/api/referrals") ||
    url.includes("/api/docs")
  ) {
    return 900; // 15 minutes
  }

  // User-specific data - no cache
  if (
    url.includes("/api/agents") ||
    url.includes("/api/workflow") ||
    url.includes("/api/documents") ||
    url.includes("/api/groundtruth") ||
    url.includes("/api/billing") ||
    url.includes("/api/admin")
  ) {
    return 0; // No cache
  }

  // Default for other API endpoints
  return 300; // 5 minutes
}

/**
 * Generate a simple ETag for caching
 */
function generateETag(input: string): string {
  const crypto = require("crypto");
  return `"${crypto.createHash("md5").update(input).digest("hex")}"`;
}
