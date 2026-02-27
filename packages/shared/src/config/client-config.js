"use strict";
/**
 * Client Configuration
 *
 * Browser-safe configuration that only reads VITE_-prefixed values.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientApiConfig = exports.getClientSupabaseConfig = exports.isClientProduction = exports.getClientConfig = exports.clientConfig = void 0;
const zod_1 = require("zod");
const ClientConfigSchema = zod_1.z.object({
    app: zod_1.z.object({
        name: zod_1.z.string().default("ValueOS"),
        version: zod_1.z.string().default("1.0.0"),
        environment: zod_1.z.enum(["development", "staging", "production"]).default("development"),
        debug: zod_1.z.boolean().default(false),
    }),
    supabase: zod_1.z.object({
        url: zod_1.z.string(),
        anonKey: zod_1.z.string(),
    }),
    api: zod_1.z.object({
        baseUrl: zod_1.z.string().default("/api"),
        timeout: zod_1.z.number().default(30000),
        retryAttempts: zod_1.z.number().default(3),
    }),
});
const isBrowser = typeof window !== "undefined";
const envSource = import.meta?.env ?? (typeof process !== "undefined" ? process.env : undefined);
function getClientEnvVar(key) {
    if (!key.startsWith("VITE_")) {
        return undefined;
    }
    return envSource?.[key];
}
function parseNumber(value) {
    if (!value)
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function normalizeApiBaseUrl(value) {
    if (!value)
        return "/api";
    const trimmed = value.trim();
    if (!trimmed)
        return "/api";
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed.replace(/\/$/, "");
    }
    const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return normalizedPath.replace(/\/$/, "") || "/api";
}
class ClientConfigLoader {
    static instance;
    config = null;
    constructor() { }
    static getInstance() {
        if (!ClientConfigLoader.instance) {
            ClientConfigLoader.instance = new ClientConfigLoader();
        }
        return ClientConfigLoader.instance;
    }
    load() {
        if (this.config) {
            return this.config;
        }
        const envConfig = this.loadFromEnvironment();
        this.config = ClientConfigSchema.parse(envConfig);
        return this.config;
    }
    loadFromEnvironment() {
        return {
            app: {
                name: getClientEnvVar("VITE_APP_NAME") ?? "ValueOS",
                version: getClientEnvVar("VITE_APP_VERSION") ?? "1.0.0",
                environment: getClientEnvVar("VITE_APP_ENV") || "development",
                debug: getClientEnvVar("VITE_DEBUG") === "true",
            },
            supabase: {
                url: getClientEnvVar("VITE_SUPABASE_URL") ?? "",
                anonKey: getClientEnvVar("VITE_SUPABASE_ANON_KEY") ?? "",
            },
            api: {
                baseUrl: normalizeApiBaseUrl(getClientEnvVar("VITE_API_BASE_URL") || "/api"),
                timeout: parseNumber(getClientEnvVar("VITE_API_TIMEOUT")) ?? 30000,
                retryAttempts: parseNumber(getClientEnvVar("VITE_API_RETRY_ATTEMPTS")) ?? 3,
            },
        };
    }
    reload() {
        this.config = null;
        return this.load();
    }
    validate() {
        try {
            ClientConfigSchema.parse(this.loadFromEnvironment());
            return { valid: true, errors: [] };
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
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
exports.clientConfig = ClientConfigLoader.getInstance();
const getClientConfig = () => exports.clientConfig.load();
exports.getClientConfig = getClientConfig;
const isClientProduction = () => (0, exports.getClientConfig)().app.environment === "production";
exports.isClientProduction = isClientProduction;
const getClientSupabaseConfig = () => (0, exports.getClientConfig)().supabase;
exports.getClientSupabaseConfig = getClientSupabaseConfig;
const getClientApiConfig = () => (0, exports.getClientConfig)().api;
exports.getClientApiConfig = getClientApiConfig;
if (isBrowser) {
    const validation = exports.clientConfig.validate();
    if (!validation.valid) {
        console.error("Client configuration validation failed:");
        validation.errors.forEach((error) => console.error(`  - ${error}`));
    }
}
//# sourceMappingURL=client-config.js.map