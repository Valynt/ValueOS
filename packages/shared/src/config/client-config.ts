/**
 * Client Configuration
 *
 * Browser-safe configuration that only reads VITE_-prefixed values.
 */

import { z } from "zod";

const ClientConfigSchema = z.object({
  app: z.object({
    name: z.string().default("ValueOS"),
    version: z.string().default("1.0.0"),
    environment: z.enum(["development", "staging", "production"]).default("development"),
    debug: z.boolean().default(false),
  }),
  supabase: z.object({
    url: z.string(),
    anonKey: z.string(),
  }),
  api: z.object({
    baseUrl: z.string().default("/api"),
    timeout: z.number().default(30000),
    retryAttempts: z.number().default(3),
  }),
});

export type ClientConfig = z.infer<typeof ClientConfigSchema>;

const isBrowser = typeof window !== "undefined";
const envSource =
  (import.meta as any)?.env ?? (typeof process !== "undefined" ? process.env : undefined);

function getClientEnvVar(key: string): string | undefined {
  if (!key.startsWith("VITE_")) {
    return undefined;
  }

  return envSource?.[key];
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

class ClientConfigLoader {
  private static instance: ClientConfigLoader;
  private config: ClientConfig | null = null;

  private constructor() {}

  static getInstance(): ClientConfigLoader {
    if (!ClientConfigLoader.instance) {
      ClientConfigLoader.instance = new ClientConfigLoader();
    }
    return ClientConfigLoader.instance;
  }

  load(): ClientConfig {
    if (this.config) {
      return this.config;
    }

    const envConfig = this.loadFromEnvironment();
    this.config = ClientConfigSchema.parse(envConfig);
    return this.config;
  }

  private loadFromEnvironment(): Partial<ClientConfig> {
    return {
      app: {
        name: getClientEnvVar("VITE_APP_NAME") ?? "ValueOS",
        version: getClientEnvVar("VITE_APP_VERSION") ?? "1.0.0",
        environment:
          (getClientEnvVar("VITE_APP_ENV") as ClientConfig["app"]["environment"]) || "development",
        debug: getClientEnvVar("VITE_DEBUG") === "true",
      },
      supabase: {
        url: getClientEnvVar("VITE_SUPABASE_URL") ?? "",
        anonKey: getClientEnvVar("VITE_SUPABASE_ANON_KEY") ?? "",
      },
      api: {
        baseUrl: getClientEnvVar("VITE_API_URL") || getClientEnvVar("VITE_API_BASE_URL") || "/api",
        timeout: parseNumber(getClientEnvVar("VITE_API_TIMEOUT")) ?? 30000,
        retryAttempts: parseNumber(getClientEnvVar("VITE_API_RETRY_ATTEMPTS")) ?? 3,
      },
    };
  }

  reload(): ClientConfig {
    this.config = null;
    return this.load();
  }

  validate(): { valid: boolean; errors: string[] } {
    try {
      ClientConfigSchema.parse(this.loadFromEnvironment());
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
        };
      }
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : "Unknown validation error"],
      };
    }
  }
}

export const clientConfig = ClientConfigLoader.getInstance();

export const getClientConfig = (): ClientConfig => clientConfig.load();

export const isClientProduction = (): boolean => getClientConfig().app.environment === "production";

export const getClientSupabaseConfig = () => getClientConfig().supabase;

export const getClientApiConfig = () => getClientConfig().api;

if (isBrowser) {
  const validation = clientConfig.validate();
  if (!validation.valid) {
    console.error("Client configuration validation failed:");
    validation.errors.forEach((error) => console.error(`  - ${error}`));
  }
}
