/**
 * Client Configuration
 *
 * Browser-safe configuration that only reads VITE_-prefixed values.
 */
import { z } from "zod";
declare const ClientConfigSchema: z.ZodObject<{
    app: z.ZodObject<{
        name: z.ZodDefault<z.ZodString>;
        version: z.ZodDefault<z.ZodString>;
        environment: z.ZodDefault<z.ZodEnum<["development", "staging", "production"]>>;
        debug: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        debug?: boolean;
        name?: string;
        version?: string;
        environment?: "development" | "production" | "staging";
    }, {
        debug?: boolean;
        name?: string;
        version?: string;
        environment?: "development" | "production" | "staging";
    }>;
    supabase: z.ZodObject<{
        url: z.ZodString;
        anonKey: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url?: string;
        anonKey?: string;
    }, {
        url?: string;
        anonKey?: string;
    }>;
    api: z.ZodObject<{
        baseUrl: z.ZodDefault<z.ZodString>;
        timeout: z.ZodDefault<z.ZodNumber>;
        retryAttempts: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        timeout?: number;
        baseUrl?: string;
        retryAttempts?: number;
    }, {
        timeout?: number;
        baseUrl?: string;
        retryAttempts?: number;
    }>;
}, "strip", z.ZodTypeAny, {
    app?: {
        debug?: boolean;
        name?: string;
        version?: string;
        environment?: "development" | "production" | "staging";
    };
    supabase?: {
        url?: string;
        anonKey?: string;
    };
    api?: {
        timeout?: number;
        baseUrl?: string;
        retryAttempts?: number;
    };
}, {
    app?: {
        debug?: boolean;
        name?: string;
        version?: string;
        environment?: "development" | "production" | "staging";
    };
    supabase?: {
        url?: string;
        anonKey?: string;
    };
    api?: {
        timeout?: number;
        baseUrl?: string;
        retryAttempts?: number;
    };
}>;
export type ClientConfig = z.infer<typeof ClientConfigSchema>;
declare class ClientConfigLoader {
    private static instance;
    private config;
    private constructor();
    static getInstance(): ClientConfigLoader;
    load(): ClientConfig;
    private loadFromEnvironment;
    reload(): ClientConfig;
    validate(): {
        valid: boolean;
        errors: string[];
    };
}
export declare const clientConfig: ClientConfigLoader;
export declare const getClientConfig: () => ClientConfig;
export declare const isClientProduction: () => boolean;
export declare const getClientSupabaseConfig: () => {
    url?: string;
    anonKey?: string;
};
export declare const getClientApiConfig: () => {
    timeout?: number;
    baseUrl?: string;
    retryAttempts?: number;
};
export {};
//# sourceMappingURL=client-config.d.ts.map