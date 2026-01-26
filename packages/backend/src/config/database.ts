import { getEnvVar } from "@shared/lib/env";
import { settings } from "./settings";

export function getDatabaseUrl(): string | undefined {
  return settings.DATABASE_URL ?? getEnvVar("DATABASE_URL");
}
