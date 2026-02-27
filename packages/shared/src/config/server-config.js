/**
 * Server Configuration
 *
 * Server-only configuration that reads secure environment variables.
 */
import { z } from "zod";
const ServerConfigSchema = z.object({
    database: z.object({
        url: z.string(),
        poolSize: z.number().default(10),
        timeout: z.number().default(30000),
    }),
    supabase: z.object({
        url: z.string().optional(),
        anonKey: z.string().optional(),
        serviceRoleKey: z.string().optional(),
    }),
    security: z.object({
        jwtSecret: z.string().optional(),
        encryptionKey: z.string().optional(),
    }),
    billing: z.object({
        stripeWebhookSecret: z.string().optional(),
    }),
    webhooks: z.object({
        alertWebhookUrl: z.string().url().optional(),
        slackWebhookUrl: z.string().url().optional(),
    }),
});
function parseNumber(value) {
    if (!value)
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
class ServerConfigLoader {
    static instance;
    config = null;
    constructor() { }
    static getInstance() {
        if (!ServerConfigLoader.instance) {
            ServerConfigLoader.instance = new ServerConfigLoader();
        }
        return ServerConfigLoader.instance;
    }
    load() {
        if (this.config) {
            return this.config;
        }
        const envConfig = this.loadFromEnvironment();
        this.config = ServerConfigSchema.parse(envConfig);
        return this.config;
    }
    loadFromEnvironment() {
        return {
            database: {
                url: process.env.DATABASE_URL ?? "",
                poolSize: parseNumber(process.env.DATABASE_POOL_SIZE) ?? 10,
                timeout: parseNumber(process.env.DATABASE_TIMEOUT) ?? 30000,
            },
            supabase: {
                url: process.env.SUPABASE_URL,
                anonKey: process.env.SUPABASE_ANON_KEY,
                serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
            },
            security: {
                jwtSecret: process.env.JWT_SECRET,
                encryptionKey: process.env.ENCRYPTION_KEY,
            },
            billing: {
                stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            },
            webhooks: {
                alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
                slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
            },
        };
    }
    reload() {
        this.config = null;
        return this.load();
    }
    validate() {
        try {
            ServerConfigSchema.parse(this.loadFromEnvironment());
            return { valid: true, errors: [] };
        }
        catch (error) {
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
export const serverConfig = ServerConfigLoader.getInstance();
export const getServerConfig = () => serverConfig.load();
export const getServerSupabaseConfig = () => getServerConfig().supabase;
export const getServerWebhookConfig = () => getServerConfig().webhooks;
export const getServerBillingConfig = () => getServerConfig().billing;
export const getDatabaseConfig = () => getServerConfig().database;
//# sourceMappingURL=server-config.js.map