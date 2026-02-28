import { NextFunction, Request, Response } from "express";

import { getAutonomyConfig } from "../config/autonomy";

import { nonceStore, NonceStoreUnavailableError } from "./nonceStore";

// Use browser-compatible crypto when available, fallback to Node crypto
const randomUUID = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for Node.js environment
  return require("crypto").randomUUID();
};

const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Lightweight service identity enforcement to begin mTLS/identity rollout.
 * If a SERVICE_IDENTITY_TOKEN is configured, incoming requests must include
 * a matching X-Service-Identity header and a nonce/timestamp for replay protection.
 */
export function serviceIdentityMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { serviceIdentityToken } = getAutonomyConfig();

  // Sprint 1: Fail fast with clear log if SERVICE_IDENTITY_TOKEN missing in production
  if (!serviceIdentityToken) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[FATAL] SERVICE_IDENTITY_TOKEN not configured in production - service identity enforcement disabled"
      );
      return res.status(503).json({
        error: "Service unavailable: identity configuration missing",
        code: "SERVICE_IDENTITY_NOT_CONFIGURED",
      });
    }
    // In development, allow bypass with warning
    console.warn(
      "[WARN] SERVICE_IDENTITY_TOKEN not set - skipping identity verification (dev only)"
    );
    return next();
  }

  const provided = req.header("x-service-identity") || "";
  const timestamp = Number(req.header("x-request-timestamp") || 0);
  const nonce = req.header("x-request-nonce") || "";

  if (provided !== serviceIdentityToken) {
    return res.status(401).json({ error: "Service identity verification failed" });
  }

  if (!timestamp || Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS) {
    return res.status(401).json({ error: "Request timestamp invalid or expired" });
  }

  if (!nonce) {
    return res.status(401).json({ error: "Request nonce required" });
  }

  const requireRedis = process.env.NODE_ENV === "production";
  nonceStore
    .consumeOnce(provided, nonce, { requireRedis })
    .then((unique) => {
      if (!unique) {
        return res.status(401).json({ error: "Replay detected" });
      }

      (req as any).serviceIdentityVerified = true;
      (req as any).requestNonce = nonce;
      next();
    })
    .catch((error) => {
      if (error instanceof NonceStoreUnavailableError) {
        return res.status(503).json({ error: "Replay protection unavailable" });
      }
      return res.status(500).json({ error: "Nonce validation failed" });
    });
}

/**
 * Helper to add outbound service identity + signing headers when calling internal services.
 */
export function addServiceIdentityHeader(headers: Record<string, string>): Record<string, string> {
  const { serviceIdentityToken } = getAutonomyConfig();
  if (serviceIdentityToken) {
    headers["X-Service-Identity"] = serviceIdentityToken;
    headers["X-Request-Timestamp"] = Date.now().toString();
    headers["X-Request-Nonce"] = randomUUID();
  }
  return headers;
}
