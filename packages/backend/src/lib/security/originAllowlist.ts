export interface OriginResolutionSuccess {
  ok: true;
  origin: string;
}

export interface OriginResolutionFailure {
  ok: false;
  error: string;
}

export type OriginResolution = OriginResolutionSuccess | OriginResolutionFailure;

function parseOriginCandidate(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    if (parsed.username || parsed.password) {
      return null;
    }

    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveValidatedOriginFromAppUrl(appUrl: string | undefined): OriginResolution {
  const trimmed = appUrl?.trim();

  if (!trimmed) {
    return {
      ok: false,
      error: 'APP_URL must be configured as an absolute URL for OAuth callbacks',
    };
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        error: 'APP_URL must use http or https',
      };
    }

    if (parsed.username || parsed.password) {
      return {
        ok: false,
        error: 'APP_URL must not include user credentials',
      };
    }

    return { ok: true, origin: parsed.origin };
  } catch {
    return {
      ok: false,
      error: 'APP_URL must be a valid absolute URL',
    };
  }
}

export function isOriginAllowedExact(allowedOrigin: string, candidateOrigin: string): boolean {
  const normalizedAllowed = parseOriginCandidate(allowedOrigin);
  const normalizedCandidate = parseOriginCandidate(candidateOrigin);

  if (!normalizedAllowed || !normalizedCandidate) {
    return false;
  }

  return normalizedAllowed === normalizedCandidate;
}
