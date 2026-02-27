"use strict";
/**
 * Server Configuration
 *
 * Server-only configuration that reads secure environment variables.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseConfig = exports.getServerBillingConfig = exports.getServerWebhookConfig = exports.getServerSupabaseConfig = exports.getServerConfig = exports.serverConfig = void 0;
const zod_1 = require("zod");
const ServerConfigSchema = zod_1.z.object({
    database: zod_1.z.object({
        url: zod_1.z.string(),
        poolSize: zod_1.z.number().default(10),
        timeout: zod_1.z.number().default(30000),
    }),
    supabase: zod_1.z.object({
        url: zod_1.z.string().optional(),
        anonKey: zod_1.z.string().optional(),
        serviceRoleKey: zod_1.z.string().optional(),
    }),
    security: zod_1.z.object({
        jwtSecret: zod_1.z.string().optional(),
        encryptionKey: zod_1.z.string().optional(),
    }),
    billing: zod_1.z.object({
        stripeWebhookSecret: zod_1.z.string().optional(),
    }),
    webhooks: zod_1.z.object({
        alertWebhookUrl: zod_1.z.string().url().optional(),
        slackWebhookUrl: zod_1.z.string().url().optional(),
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
exports.serverConfig = ServerConfigLoader.getInstance();
const getServerConfig = () => exports.serverConfig.load();
exports.getServerConfig = getServerConfig;
const getServerSupabaseConfig = () => (0, exports.getServerConfig)().supabase;
exports.getServerSupabaseConfig = getServerSupabaseConfig;
const getServerWebhookConfig = () => (0, exports.getServerConfig)().webhooks;
exports.getServerWebhookConfig = getServerWebhookConfig;
const getServerBillingConfig = () => (0, exports.getServerConfig)().billing;
exports.getServerBillingConfig = getServerBillingConfig;
const getDatabaseConfig = () => (0, exports.getServerConfig)().database;
exports.getDatabaseConfig = getDatabaseConfig;
//# sourceMappingURL=server-config.js.map