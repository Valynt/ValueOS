import type { Application } from "express";

import { logger } from "../lib/logger.js";

const DEFAULT_DEV_ROUTE_HOST_ALLOWLIST = ["localhost", "127.0.0.1", "::1"];

function normalizeHost(input: string): string {
  return input.trim().toLowerCase().replace(/:\d+$/, "");
}

function parseAllowlist(rawAllowlist?: string): string[] {
  if (!rawAllowlist) {
    return DEFAULT_DEV_ROUTE_HOST_ALLOWLIST;
  }

  const entries = rawAllowlist
    .split(",")
    .map((entry) => normalizeHost(entry))
    .filter(Boolean);

  return entries.length > 0 ? entries : DEFAULT_DEV_ROUTE_HOST_ALLOWLIST;
}

export function getDevRouteHostAllowlist(): string[] {
  return parseAllowlist(process.env.DEV_ROUTES_ALLOWED_HOSTS);
}

export function shouldEnableDevRoutes(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv) {
    return false;
  }

  const isNonProduction = nodeEnv !== "production";
  return isNonProduction && process.env.ENABLE_DEV_ROUTES === "true";
}

export function assertDevRoutesConfiguration(): void {
  const enableDevRoutes = process.env.ENABLE_DEV_ROUTES === "true";
  const nodeEnv = process.env.NODE_ENV;

  if (enableDevRoutes && nodeEnv === "production") {
    // Log before exiting so the reason is visible in structured logs, then
    // hard-exit rather than throwing — a thrown error can be caught and swallowed
    // by a caller, whereas process.exit cannot.
    logger.error(
      "[Security] FATAL: ENABLE_DEV_ROUTES=true is not allowed when NODE_ENV=production. " +
      "Dev routes include child_process.exec which must never be reachable in production. " +
      "Disable dev routes or set NODE_ENV to a non-production value."
    );
    process.exit(1);
  }
}

export function isDevRouteHostAllowed(hostname: string | undefined): boolean {
  if (!hostname) {
    return false;
  }

  const normalizedHost = normalizeHost(hostname);
  const allowlist = getDevRouteHostAllowlist();

  return allowlist.some((allowedHost) => {
    if (!allowedHost) {
      return false;
    }
    if (allowedHost.startsWith(".")) {
      return normalizedHost.endsWith(allowedHost);
    }
    return normalizedHost === allowedHost;
  });
}

export async function registerDevRoutes(app: Application): Promise<boolean> {
  if (!shouldEnableDevRoutes()) {
    return false;
  }

  logger.warn("Dev routes are enabled in a non-production environment", {
    nodeEnv: process.env.NODE_ENV,
  });

  const { default: devRouter } = await import("./dev.js");
  app.use("/api/dev", devRouter);
  return true;
}
