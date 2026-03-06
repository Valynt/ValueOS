import crypto from "node:crypto";

import { NextFunction, Request, Response } from "express";

/**
 * Performance optimization middleware for HTTP caching headers
 * Sets appropriate Cache-Control headers and payload/version-derived ETags.
 */
export function cachingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const url = req.url;
  const method = req.method;

  if (method !== "GET") {
    next();
    return;
  }

  const appVersion = process.env.APP_VERSION || process.env.npm_package_version || "dev";

  if (isStaticAsset(url)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("ETag", generateVersionedETag({ version: appVersion, payload: { url } }));
    next();
    return;
  }

  if (url.startsWith("/api/")) {
    const cacheMaxAge = getApiCacheMaxAge(url);
    if (cacheMaxAge > 0) {
      res.setHeader("Cache-Control", `public, max-age=${cacheMaxAge}`);

      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        const etag = generateVersionedETag({
          version: appVersion,
          payload: {
            method,
            path: req.path,
            query: req.query,
            body,
          },
        });

        res.setHeader("ETag", etag);

        if (req.headers["if-none-match"] === etag) {
          return res.status(304).end();
        }

        return originalJson(body);
      }) as Response["json"];
    } else {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }

  next();
}

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

function getApiCacheMaxAge(url: string): number {
  if (url.includes("/health")) {
    return 300;
  }

  if (url.includes("/api/projects") || url.includes("/api/referrals") || url.includes("/api/docs")) {
    return 900;
  }

  if (
    url.includes("/api/agents") ||
    url.includes("/api/workflow") ||
    url.includes("/api/documents") ||
    url.includes("/api/groundtruth") ||
    url.includes("/api/billing") ||
    url.includes("/api/admin")
  ) {
    return 0;
  }

  return 300;
}

function generateVersionedETag(input: { version: string; payload: unknown }): string {
  const digest = crypto
    .createHash("sha256")
    .update(`${input.version}:${JSON.stringify(input.payload)}`)
    .digest("base64url");
  return `W/\"${digest}\"`;
}
