/**
 * Environment Variable Utilities
 * Browser-safe implementation that avoids process references
 */
export declare const REQUIRED_ENV_VARS: readonly ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL"];
export declare function validateRequiredEnv(): void;
export declare function validateEnv(): void;
export declare const env: {
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
    isBrowser: boolean;
    isServer: boolean;
};
export interface GetEnvVarOptions {
    required?: boolean;
    defaultValue?: string;
    scope?: "browser" | "server";
}
export declare function getEnvVar(key: string, options?: GetEnvVarOptions): string | undefined;
export declare function setEnvVar(key: string, value: string): void;
export declare function checkIsBrowser(): boolean;
export declare function __setEnvSourceForTests(envSource: Record<string, string>): void;
export declare function getSupabaseConfig(): {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
};
export declare function getGroundtruthConfig(): {
    baseUrl: string;
    apiKey?: string;
    timeout: number;
};
export declare function getLLMCostTrackerConfig(): {
    supabaseUrl: string;
    supabaseKey: string;
    tableName: string;
};
export declare function setEnvVarForTests(envSource: Record<string, string>): void;
//# sourceMappingURL=env.d.ts.map