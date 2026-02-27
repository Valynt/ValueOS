"use strict";
/**
 * Environment Variable Utilities
 * Browser-safe implementation that avoids process references
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = exports.REQUIRED_ENV_VARS = void 0;
exports.validateRequiredEnv = validateRequiredEnv;
exports.validateEnv = validateEnv;
exports.getEnvVar = getEnvVar;
exports.setEnvVar = setEnvVar;
exports.checkIsBrowser = checkIsBrowser;
exports.__setEnvSourceForTests = __setEnvSourceForTests;
exports.getSupabaseConfig = getSupabaseConfig;
exports.getGroundtruthConfig = getGroundtruthConfig;
exports.getLLMCostTrackerConfig = getLLMCostTrackerConfig;
exports.setEnvVarForTests = setEnvVarForTests;
// Check once at module load time
const _isBrowser = typeof window !== "undefined";
exports.REQUIRED_ENV_VARS = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
];
function validateRequiredEnv() {
    // Skip validation in browser (validation is server-side)
    if (_isBrowser)
        return;
    // Server-side validation (self-contained, no cross-package imports)
    const missing = [];
    for (const key of exports.REQUIRED_ENV_VARS) {
        if (typeof process !== "undefined" && process.env && !process.env[key]) {
            missing.push(key);
        }
    }
    if (missing.length > 0) {
        console.warn(`[env] Missing environment variables: ${missing.join(", ")}`);
    }
}
function validateEnv() {
    validateRequiredEnv();
}
// Helper function to safely access environment variables
function getEnvValue(key) {
    if (_isBrowser) {
        // In browser environments, use import.meta.env if available (Vite)
        return import.meta?.env?.[key];
    }
    else {
        // In Node.js environments, use process.env
        return typeof process !== "undefined" && process.env ? process.env[key] : undefined;
    }
}
exports.env = {
    isDevelopment: _isBrowser ? getEnvValue("DEV") === "true" : false,
    isProduction: _isBrowser ? getEnvValue("PROD") === "true" : false,
    isTest: false,
    isBrowser: _isBrowser,
    isServer: !_isBrowser,
};
function getEnvVar(key, options = {}) {
    const { required = false, defaultValue, scope } = options;
    let value = getEnvValue(key);
    if (!value && defaultValue) {
        value = defaultValue;
    }
    if (!value && required) {
        const errorScope = scope || (_isBrowser ? "browser" : "server");
        throw new Error(`Missing required ${errorScope} environment variable: ${key}`);
    }
    return value;
}
function setEnvVar(key, value) {
    if (_isBrowser) {
        if (import.meta?.env) {
            import.meta.env[key] = value;
        }
    }
    else {
        if (typeof process !== "undefined" && process.env) {
            process.env[key] = value;
        }
    }
}
function checkIsBrowser() {
    return _isBrowser;
}
function __setEnvSourceForTests(envSource) {
    if (_isBrowser) {
        if (import.meta?.env) {
            Object.assign(import.meta.env, envSource);
        }
    }
    else {
        if (typeof process !== "undefined" && process.env) {
            Object.assign(process.env, envSource);
        }
    }
}
function getSupabaseConfig() {
    const serviceRoleKey = getEnvVar("SUPABASE_SERVICE_ROLE_KEY") || getEnvVar("SUPABASE_SERVICE_KEY");
    const config = {
        url: getEnvVar("VITE_SUPABASE_URL") || getEnvVar("SUPABASE_PUBLIC_URL") || getEnvVar("SUPABASE_URL") || getEnvVar("SUPABASE_INTERNAL_URL") || "",
        anonKey: getEnvVar("VITE_SUPABASE_ANON_KEY") || getEnvVar("SUPABASE_ANON_KEY") || "",
    };
    if (serviceRoleKey) {
        config.serviceRoleKey = serviceRoleKey;
    }
    return config;
}
function getGroundtruthConfig() {
    const apiKey = getEnvVar("VITE_GROUNDTRUTH_API_KEY") || getEnvVar("GROUNDTRUTH_API_KEY");
    const config = {
        baseUrl: getEnvVar("VITE_GROUNDTRUTH_URL") ||
            getEnvVar("GROUNDTRUTH_URL") ||
            "https://api.groundtruth.example.com",
        timeout: Number(getEnvVar("GROUNDTRUTH_TIMEOUT") || "30000"),
    };
    if (apiKey) {
        config.apiKey = apiKey;
    }
    return config;
}
function getLLMCostTrackerConfig() {
    return {
        supabaseUrl: getEnvVar("VITE_SUPABASE_URL") || getEnvVar("SUPABASE_PUBLIC_URL") || getEnvVar("SUPABASE_URL") || getEnvVar("SUPABASE_INTERNAL_URL") || "",
        supabaseKey: getEnvVar("VITE_SUPABASE_ANON_KEY") || getEnvVar("SUPABASE_ANON_KEY") || "",
        tableName: getEnvVar("LLM_COST_TABLE_NAME") || "llm_costs",
    };
}
function setEnvVarForTests(envSource) {
    __setEnvSourceForTests(envSource);
}
//# sourceMappingURL=env.js.map