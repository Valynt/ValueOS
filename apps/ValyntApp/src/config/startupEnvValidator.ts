const SECRET_PLACEHOLDERS = ["", "your-", "placeholder", "changeme"];

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return SECRET_PLACEHOLDERS.some((marker) =>
    marker === "" ? normalized.length === 0 : normalized.includes(marker)
  );
}

function buildErrorMessage(scope: string, missing: string[], placeholders: string[]): string {
  const lines = [`${scope} startup configuration is invalid.`];

  if (missing.length > 0) {
    lines.push("Missing required environment variables:");
    missing.forEach((key) => lines.push(`  - ${key}`));
  }

  if (placeholders.length > 0) {
    lines.push("Environment variables still contain placeholder values:");
    placeholders.forEach((key) => lines.push(`  - ${key}`));
  }

  lines.push("Expected ownership:");
  lines.push("  - .env.example: non-secret defaults");
  lines.push("  - .env.ports: generated port mappings");
  lines.push("  - .env.local: secrets only");

  return lines.join("\n");
}

function validateRequired(scope: string, source: Record<string, string | undefined>, required: string[]) {
  const missing = required.filter((key) => !source[key]?.trim());
  const placeholders = required.filter((key) => {
    const value = source[key];
    return typeof value === "string" && isPlaceholder(value);
  });

  if (missing.length > 0 || placeholders.length > 0) {
    throw new Error(buildErrorMessage(scope, missing, placeholders));
  }
}

export function validateFrontendStartupEnv(viteEnv: Record<string, string | undefined>): void {
  validateRequired("Frontend", viteEnv, [
    "VITE_API_BASE_URL",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
  ]);
}
