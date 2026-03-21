/**
 * Browser-safe ValyntApp configuration.
 *
 * This module must only resolve public Vite environment variables.
 */
import { z } from "zod";

import { getEnvVar } from "../lib/env";

import { PublicSettingsSchema } from "./settings.shared";

const readPublicEnv = (key: keyof z.infer<typeof PublicSettingsSchema>) => getEnvVar(key);

const resolvedPublicEnv = {
  VITE_SUPABASE_URL: readPublicEnv("VITE_SUPABASE_URL"),
  VITE_SUPABASE_ANON_KEY: readPublicEnv("VITE_SUPABASE_ANON_KEY"),
  VITE_APP_URL: readPublicEnv("VITE_APP_URL"),
  VITE_SENTRY_DSN: readPublicEnv("VITE_SENTRY_DSN"),
};

let parsedPublicSettings: z.infer<typeof PublicSettingsSchema>;

try {
  parsedPublicSettings = PublicSettingsSchema.parse(resolvedPublicEnv);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid public environment variables:", error.format());
    throw new Error(
      "Invalid public environment variables. Please check your Vite env configuration.",
    );
  }
  throw error;
}

export const settings = parsedPublicSettings;
