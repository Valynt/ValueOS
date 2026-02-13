/**
 * Server Configuration
 *
 * Server-only configuration that reads secure environment variables.
 */
import { z } from "zod";
declare const ServerConfigSchema: z.ZodObject<{
    database: z.ZodObject<{
        url: z.ZodString;
        poolSize: z.ZodDefault<z.ZodNumber>;
        timeout: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        url?: string;
        timeout?: number;
        poolSize?: number;
    }, {
        url?: string;
        timeout?: number;
        poolSize?: number;
    }>;
    supabase: z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        anonKey: z.ZodOptional<z.ZodString>;
        serviceRoleKey: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        url?: string;
        serviceRoleKey?: string;
        anonKey?: string;
    }, {
        url?: string;
        serviceRoleKey?: string;
        anonKey?: string;
    }>;
    security: z.ZodObject<{
        jwtSecret: z.ZodOptional<z.ZodString>;
        encryptionKey: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        jwtSecret?: string;
        encryptionKey?: string;
    }, {
        jwtSecret?: string;
        encryptionKey?: string;
    }>;
    billing: z.ZodObject<{
        stripeWebhookSecret: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        stripeWebhookSecret?: string;
    }, {
        stripeWebhookSecret?: string;
    }>;
    webhooks: z.ZodObject<{
        alertWebhookUrl: z.ZodOptional<z.ZodString>;
        slackWebhookUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        alertWebhookUrl?: string;
        slackWebhookUrl?: string;
    }, {
        alertWebhookUrl?: string;
        slackWebhookUrl?: string;
    }>;
}, "strip", z.ZodTypeAny, {
    database?: {
        url?: string;
        timeout?: number;
        poolSize?: number;
    };
    billing?: {
        stripeWebhookSecret?: string;
    };
    supabase?: {
        url?: string;
        serviceRoleKey?: string;
        anonKey?: string;
    };
    security?: {
        jwtSecret?: string;
        encryptionKey?: string;
    };
    webhooks?: {
        alertWebhookUrl?: string;
        slackWebhookUrl?: string;
    };
}, {
    database?: {
        url?: string;
        timeout?: number;
        poolSize?: number;
    };
    billing?: {
        stripeWebhookSecret?: string;
    };
    supabase?: {
        url?: string;
        serviceRoleKey?: string;
        anonKey?: string;
    };
    security?: {
        jwtSecret?: string;
        encryptionKey?: string;
    };
    webhooks?: {
        alertWebhookUrl?: string;
        slackWebhookUrl?: string;
    };
}>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
declare class ServerConfigLoader {
    private static instance;
    private config;
    private constructor();
    static getInstance(): ServerConfigLoader;
    load(): ServerConfig;
    private loadFromEnvironment;
    reload(): ServerConfig;
    validate(): {
        valid: boolean;
        errors: string[];
    };
}
export declare const serverConfig: ServerConfigLoader;
export declare const getServerConfig: () => ServerConfig;
export declare const getServerSupabaseConfig: () => {
    url?: string;
    serviceRoleKey?: string;
    anonKey?: string;
};
export declare const getServerWebhookConfig: () => {
    alertWebhookUrl?: string;
    slackWebhookUrl?: string;
};
export declare const getServerBillingConfig: () => {
    stripeWebhookSecret?: string;
};
export declare const getDatabaseConfig: () => {
    url?: string;
    timeout?: number;
    poolSize?: number;
};
export {};
//# sourceMappingURL=server-config.d.ts.map