import { getEnvVar } from "../lib/env";

import { serverSettings } from "./settings.server";

export function getDatabaseUrl(): string | undefined {
  return serverSettings.DATABASE_URL ?? getEnvVar("DATABASE_URL");
}
