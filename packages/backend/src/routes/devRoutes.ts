import type { Application } from "express";

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
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isNonProduction = nodeEnv !== "production";
  return isNonProduction && process.env.ENABLE_DEV_ROUTES === "true";
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

  const { default: devRouter } = await import("./dev.js");
  app.use("/api/dev", devRouter);
  return true;
}
