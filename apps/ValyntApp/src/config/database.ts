import { getEnvVar } from "../lib/env";

import { settings } from "./settings.server";

export function getDatabaseUrl(): string | undefined {
  return settings.DATABASE_URL ?? getEnvVar("DATABASE_URL");
}
