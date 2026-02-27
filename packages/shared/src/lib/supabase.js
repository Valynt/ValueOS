"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.getSupabaseClient = getSupabaseClient;
exports.createRequestSupabaseClient = createRequestSupabaseClient;
exports.getRequestSupabaseClient = getRequestSupabaseClient;
exports.createServerSupabaseClient = createServerSupabaseClient;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("./env");
// Simple fetch wrapper with retry for transient network/server errors
const MAX_RETRY_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
function isRetryableError(error) {
    if (error instanceof TypeError)
        return true; // network errors
    if (error instanceof Response && error.status >= 500)
        return true;
    return false;
}
const fetchWithRetry = async (input, init) => {
    let lastError;
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
        try {
            const response = await fetch(input, init);
            if (response.status >= 500 && attempt < MAX_RETRY_ATTEMPTS - 1) {
                lastError = response;
                await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt));
                continue;
            }
            return response;
        }
        catch (error) {
            lastError = error;
            if (!isRetryableError(error) || attempt >= MAX_RETRY_ATTEMPTS - 1)
                throw error;
            await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt));
        }
    }
    throw lastError;
};
// Client-side configuration - only uses anon key
const supabaseConfig = (0, env_1.getSupabaseConfig)();
const supabaseUrl = supabaseConfig.url;
const supabaseAnonKey = supabaseConfig.anonKey;
const supabaseServiceRoleKey = supabaseConfig.serviceRoleKey;
const nodeEnv = (0, env_1.getEnvVar)("NODE_ENV") || (0, env_1.getEnvVar)("VITE_APP_ENV");
const allowInsecureAnonServerClient = (0, env_1.getEnvVar)("ALLOW_INSECURE_ANON_SERVER_CLIENT") === "true";
const isServer = typeof window === "undefined";
const isProduction = nodeEnv === "production";
if (isServer && isProduction && !supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required in production");
}
// Validate required client-side configuration
let supabase = null;
exports.supabase = supabase;
if (supabaseUrl && supabaseAnonKey) {
    const supabaseOptions = {
        db: {
            schema: "public",
        },
        auth: {
            autoRefreshToken: true,
            persistSession: false, // We handle persistence manually via SecureTokenManager for rotation support
            detectSessionInUrl: true,
        },
        global: {
            fetch: fetchWithRetry,
        },
    };
    // Client-side Supabase client - safe for browser
    exports.supabase = supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey, supabaseOptions);
}
else {
    console.warn("Supabase client configuration is missing. Billing features will be disabled.");
}
function getSupabaseClient() {
    if (!supabase) {
        throw new Error("Supabase client not configured. Billing features are disabled.");
    }
    return supabase;
}
function parseBearerToken(header) {
    if (!header)
        return null;
    const headerValue = Array.isArray(header) ? header[0] : header;
    if (!headerValue)
        return null;
    const prefix = "Bearer ";
    if (!headerValue.startsWith(prefix))
        return null;
    const token = headerValue.slice(prefix.length).trim();
    return token.length > 0 ? token : null;
}
function createRequestSupabaseClient(req) {
    if (!isServer) {
        throw new Error("Request-scoped Supabase client can only be used server-side");
    }
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase client not configured for request-scoped access");
    }
    const token = parseBearerToken(req.headers?.authorization);
    if (!token) {
        throw new Error("Authorization bearer token required for request-scoped Supabase client");
    }
    const requestOptions = {
        db: {
            schema: "public",
        },
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
        global: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            fetch: fetchWithRetry,
        },
    };
    const client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey, requestOptions);
    req.supabase = client;
    req.supabaseUser = req.user ?? null;
    return client;
}
function getRequestSupabaseClient(req) {
    return req.supabase ?? createRequestSupabaseClient(req);
}
// Server-side Supabase client - for backend services only
// This should NEVER be used in client-side code
function createServerSupabaseClient(serviceKey) {
    const serverKey = serviceKey || supabaseServiceRoleKey;
    if (!serverKey) {
        if (isProduction || !allowInsecureAnonServerClient) {
            throw new Error("Supabase service role key is required for server-side operations");
        }
        if (!supabaseAnonKey) {
            throw new Error("Supabase anon key missing for insecure server client fallback");
        }
    }
    if (typeof window !== "undefined") {
        throw new Error("Server Supabase client cannot be used in browser environment");
    }
    if (!supabaseUrl) {
        throw new Error("Supabase URL is required for server-side operations");
    }
    const serverOptions = {
        db: {
            schema: "public",
        },
        auth: {
            autoRefreshToken: false, // Server-side doesn't need auto-refresh
        },
        global: {
            fetch: fetchWithRetry,
        },
    };
    const resolvedKey = serverKey ?? supabaseAnonKey;
    return (0, supabase_js_1.createClient)(supabaseUrl, resolvedKey, serverOptions);
}
//# sourceMappingURL=supabase.js.map