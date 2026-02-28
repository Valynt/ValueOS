import { NextFunction, Request, Response } from "express";

/**
 * Middleware to set appropriate Cache-Control headers for API responses
 * Based on endpoint volatility and data freshness requirements
 */
export const cacheHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip caching for authenticated requests or mutations
  if (req.method !== "GET" || req.headers.authorization) {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    return next();
  }

  // Static or rarely changing data: 1 hour
  if (req.path.startsWith("/api/health") || req.path.startsWith("/api/version")) {
    res.set("Cache-Control", "public, max-age=3600");
  }
  // Moderately changing data: 5 minutes
  else if (req.path.startsWith("/api/projects") || req.path.startsWith("/api/workflows")) {
    res.set("Cache-Control", "public, max-age=300");
  }
  // Dynamic data: 1 minute
  else {
    res.set("Cache-Control", "public, max-age=60");
  }

  next();
};
