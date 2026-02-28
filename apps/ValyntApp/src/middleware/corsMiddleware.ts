/**
 * CORS Middleware
 *
 * Applies CORS headers to responses based on validated configuration
 *
 * API-001: Secure CORS implementation
 */

import { NextFunction, Request, Response } from "express";

import { getCORSHeaders, isOriginAllowed } from "../security/CORSValidator";
import { getSecurityConfig } from "../security/SecurityConfig";
import { logger } from "../utils/logger";

/**
 * CORS middleware for Express
 *
 * Applies appropriate CORS headers based on request origin
 */
export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const config = getSecurityConfig().cors;

  if (!config.enabled) {
    return next();
  }

  const requestOrigin = req.headers.origin;

  // Get appropriate CORS headers for this origin
  const corsHeaders = getCORSHeaders(requestOrigin, config);

  // Apply headers to response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    // Log preflight requests for monitoring
    if (requestOrigin && !isOriginAllowed(requestOrigin, config.origins)) {
      logger.warn("CORS preflight request from unauthorized origin", {
        origin: requestOrigin,
        method: req.headers["access-control-request-method"],
        path: req.path,
      });
      return res.status(403).json({ error: "Origin not allowed" });
    }

    return res.status(204).end();
  }

  next();
}

/**
 * Strict CORS middleware - rejects unauthorized origins
 * Use this for sensitive endpoints
 */
export function strictCorsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const config = getSecurityConfig().cors;
  const requestOrigin = req.headers.origin;

  if (!config.enabled) {
    return next();
  }

  // Reject if origin is not in whitelist
  if (requestOrigin && !isOriginAllowed(requestOrigin, config.origins)) {
    logger.warn("CORS request rejected from unauthorized origin", {
      origin: requestOrigin,
      path: req.path,
      method: req.method,
    });

    return res.status(403).json({
      error: "Forbidden",
      message: "Origin not allowed",
    });
  }

  // Apply CORS headers
  const corsHeaders = getCORSHeaders(requestOrigin, config);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  next();
}
