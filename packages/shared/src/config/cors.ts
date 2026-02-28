export interface ParseCorsAllowlistOptions {
  source: string;
  credentials?: boolean;
  requireNonEmpty?: boolean;
}

export function parseCorsAllowlist(
  value: string | undefined,
  options: ParseCorsAllowlistOptions
): string[] {
  const credentialsEnabled = options.credentials ?? true;
  const requireNonEmpty = options.requireNonEmpty ?? true;
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (requireNonEmpty && origins.length === 0) {
    throw new Error(
      `${options.source} must define at least one CORS origin when credentials are enabled`
    );
  }

  if (credentialsEnabled) {
    const wildcardOrigin = origins.find((origin) => origin.includes("*"));
    if (wildcardOrigin) {
      throw new Error(
        `${options.source} contains wildcard CORS origin \"${wildcardOrigin}\" which is not allowed when credentials are enabled`
      );
    }
  }

  return origins;
}
