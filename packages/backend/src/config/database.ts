import { getEnvVar } from "@shared/lib/env";
import { settings } from "./settings.js"

export function getDatabaseUrl(): string | undefined {
  return settings.DATABASE_URL ?? getEnvVar("DATABASE_URL");
}
