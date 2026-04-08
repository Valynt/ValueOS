import { logger } from "../../lib/logger.js";

let allowedRenderOrigins: string[] | undefined;

export function getAllowedRenderOrigins(): string[] {
  if (allowedRenderOrigins !== undefined) {
    return allowedRenderOrigins;
  }

  const envOrigins = process.env.PDF_ALLOWED_ORIGINS;
  if (envOrigins) {
    allowedRenderOrigins = envOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    return allowedRenderOrigins;
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3001";
  try {
    allowedRenderOrigins = [new URL(appUrl).origin];
  } catch {
    logger.error(
      "PDF export: APP_URL is not a valid URL, all renderUrl requests will be blocked",
      {
        appUrl,
      }
    );
    allowedRenderOrigins = [];
  }

  return allowedRenderOrigins;
}

export function isAllowedRenderUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  return getAllowedRenderOrigins().some((allowed) => parsed.origin === allowed);
}

export function resetAllowedRenderOriginsCacheForTests(): void {
  allowedRenderOrigins = undefined;
}
