import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./env.js";

const MAX_RETRY_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const isServer = !(typeof globalThis !== "undefined" && "window" in globalThis);

// ---------------------------------------------------------------------------
// Query instrumentation hook
//
// The shared package has no dependency on prom-client or the backend logger.
// Callers (e.g. the backend server startup) register a hook via
// setQueryInstrumentationHook() to receive per-query telemetry events.
// ---------------------------------------------------------------------------

export interface QueryInstrumentationEvent {
  /** Logical table or RPC name extracted from the Supabase REST URL path. */
  table: string;
  /** HTTP method mapped to a Supabase operation type. */
  operation: "select" | "insert" | "update" | "delete" | "upsert" | "rpc" | "unknown";
  /** Wall-clock duration of the fetch call in milliseconds. */
  duration_ms: number;
  /** Whether the response was a success (2xx) or error. */
  status: "ok" | "error";
  /** HTTP status code from the response, if available. */
  http_status?: number;
}

export type QueryInstrumentationHook = (event: QueryInstrumentationEvent) => void;

let _instrumentationHook: QueryInstrumentationHook | null = null;

/**
 * Register a hook that is called after every Supabase fetch completes.
 * Intended to be called once at server startup by the backend metrics layer.
 * Passing null removes the hook.
 */
export function setQueryInstrumentationHook(hook: QueryInstrumentationHook | null): void {
  _instrumentationHook = hook;
}

/**
 * Extract the value of the `Prefer` header from a fetch RequestInit.
 * Supabase sends `Prefer: resolution=merge-duplicates` for upserts as an HTTP
 * header, not a query parameter.
 */
function getPreferHeader(init: RequestInit | undefined): string {
  if (!init?.headers) return "";
  const h = init.headers;
  if (typeof (h as Headers).get === "function") {
    return (h as Headers).get("Prefer") ?? (h as Headers).get("prefer") ?? "";
  }
  if (Array.isArray(h)) {
    const entry = (h as string[][]).find(
      (item) => item.length > 0 && item[0] !== undefined && item[0].toLowerCase() === "prefer",
    );
    return entry?.[1] ?? "";
  }
  const record = h as Record<string, string>;
  return record["Prefer"] ?? record["prefer"] ?? "";
}

/**
 * Parse a Supabase REST URL to extract the logical table/resource name and
 * map the HTTP method to a Supabase operation type.
 *
 * Supabase REST paths follow the pattern:
 *   /rest/v1/<table>?...          — table operations
 *   /rest/v1/rpc/<function>?...   — RPC calls
 */
function parseSupabaseRequest(
  input: string | URL | Request,
  method: string | undefined,
  init: RequestInit | undefined,
): Pick<QueryInstrumentationEvent, "table" | "operation"> {
  try {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    // segments: ["rest", "v1", "<table>"] or ["rest", "v1", "rpc", "<fn>"]
    const restIdx = segments.indexOf("v1");
    if (restIdx === -1) return { table: "unknown", operation: "unknown" };

    const afterV1 = segments.slice(restIdx + 1);
    const isRpc = afterV1[0] === "rpc";
    const table = isRpc ? (afterV1[1] ?? "unknown") : (afterV1[0] ?? "unknown");

    if (isRpc) return { table, operation: "rpc" };

    // Read Prefer from the request header (not query params — Supabase sends it as a header).
    const prefer = getPreferHeader(init);
    const httpMethod = (method ?? "GET").toUpperCase();

    let operation: QueryInstrumentationEvent["operation"];
    if (httpMethod === "GET" || httpMethod === "HEAD") {
      operation = "select";
    } else if (httpMethod === "POST") {
      // Supabase uses POST for insert; upsert is POST with Prefer: resolution=merge-duplicates
      operation = prefer.includes("resolution=merge-duplicates") ? "upsert" : "insert";
    } else if (httpMethod === "PATCH") {
      operation = "update";
    } else if (httpMethod === "DELETE") {
      operation = "delete";
    } else {
      operation = "unknown";
    }

    return { table, operation };
  } catch {
    return { table: "unknown", operation: "unknown" };
  }
}

export type BrowserSafeAnonSupabaseClient = SupabaseClient;
export type RequestScopedRlsSupabaseClient = SupabaseClient;
export type ServiceRoleSupabaseClient = SupabaseClient;

export interface SupabaseRequestLike {
  headers?: { authorization?: string | string[] };
  session?: { access_token?: unknown; [key: string]: unknown };
  supabase?: RequestScopedRlsSupabaseClient;
  supabaseUser?: unknown;
  user?: unknown;
}

export interface RequestScopedSupabaseClientOptions {
  accessToken: string;
  request?: SupabaseRequestLike;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  // Response may not be defined in Node.js environments without a fetch polyfill.
  if (typeof Response !== "undefined" && error instanceof Response && error.status >= 500) return true;
  return false;
}

const fetchWithRetry = async (
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> => {
  const start = Date.now();
  // Request is not a global in Node 20 — guard before instanceof to avoid ReferenceError.
  const method =
    init?.method ??
    (typeof Request !== "undefined" && input instanceof Request ? input.method : undefined);
  const { table, operation } = parseSupabaseRequest(input, method, init);

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(input, init);
      if (response.status >= 500 && attempt < MAX_RETRY_ATTEMPTS - 1) {
        lastError = response;
        await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt));
        continue;
      }

      // Emit instrumentation on final response (success or non-retryable error)
      if (_instrumentationHook) {
        const duration_ms = Date.now() - start;
        const isError = response.status >= 400;
        _instrumentationHook({
          table,
          operation,
          duration_ms,
          status: isError ? "error" : "ok",
          http_status: response.status,
        });
      }

      return response;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt >= MAX_RETRY_ATTEMPTS - 1) {
        if (_instrumentationHook) {
          _instrumentationHook({
            table,
            operation,
            duration_ms: Date.now() - start,
            status: "error",
          });
        }
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt));
    }
  }
  throw lastError;
};

const supabaseConfig = getSupabaseConfig();
const supabaseUrl = supabaseConfig.url;
const supabaseAnonKey = supabaseConfig.anonKey;
const supabaseServiceRoleKey = supabaseConfig.serviceRoleKey;


let browserSupabaseClient: BrowserSafeAnonSupabaseClient | null = null;
let serviceRoleSupabaseClient: ServiceRoleSupabaseClient | null = null;

function getBaseSupabaseOptions(): SupabaseClientOptions<"public"> {
  return {
    db: {
      schema: "public",
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: fetchWithRetry,
    },
  };
}

function parseBearerToken(header?: string | string[]): string | null {
  if (!header) return null;
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (!headerValue) return null;
  const prefix = "Bearer ";
  if (!headerValue.startsWith(prefix)) return null;
  const token = headerValue.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

function parseSessionAccessToken(session?: { access_token?: unknown }): string | null {
  return typeof session?.access_token === "string" && session.access_token.trim().length > 0
    ? session.access_token.trim()
    : null;
}

function resolveRequestAccessToken(req: SupabaseRequestLike): string | null {
  return parseBearerToken(req.headers?.authorization) ?? parseSessionAccessToken(req.session);
}

function createRequestScopedClient(accessToken: string): RequestScopedRlsSupabaseClient {
  if (!isServer) {
    throw new Error("Request-scoped Supabase client can only be used server-side");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase client not configured for request-scoped access");
  }

  const requestOptions = getBaseSupabaseOptions();
  requestOptions.global = {
    ...requestOptions.global,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  return createClient(supabaseUrl, supabaseAnonKey, requestOptions);
}

export function createBrowserSupabaseClient(): BrowserSafeAnonSupabaseClient {
  if (isServer) {
    throw new Error("Browser-safe Supabase client cannot be created server-side");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase anon client not configured");
  }

  if (!browserSupabaseClient) {
    const browserOptions = getBaseSupabaseOptions();
    browserOptions.auth = {
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: true,
    };
    browserSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, browserOptions);
  }

  return browserSupabaseClient;
}

export function createRequestSupabaseClient(
  input: SupabaseRequestLike | RequestScopedSupabaseClientOptions
): RequestScopedRlsSupabaseClient {
  const accessToken = "accessToken" in input ? input.accessToken : resolveRequestAccessToken(input);

  if (!accessToken) {
    throw new Error(
      "Authorization bearer token or session access token required for request-scoped Supabase client"
    );
  }

  const request = "accessToken" in input ? input.request : input;
  const client = createRequestScopedClient(accessToken);

  if (request) {
    request.supabase = client;
    request.supabaseUser = request.user ?? null;
  }

  return client;
}

export function getRequestSupabaseClient(req: SupabaseRequestLike): RequestScopedRlsSupabaseClient {
  return req.supabase ?? createRequestSupabaseClient(req);
}

/**
 * Creates a request-scoped RLS client from a headers object.
 * Throws if no valid bearer token is present — will not fall back to anon or
 * service-role credentials.
 */
export function createRequestRlsSupabaseClient(
  input: { headers: { authorization?: string } }
): RequestScopedRlsSupabaseClient {
  const token = parseBearerToken(input.headers?.authorization);
  if (!token) {
    throw new Error(
      "createRequestRlsSupabaseClient: will not fall back to anon or service-role credentials — a valid bearer token is required"
    );
  }
  return createRequestScopedClient(token);
}

export function createServiceRoleSupabaseClient(): ServiceRoleSupabaseClient {
  if (!isServer) {
    throw new Error("Service-role Supabase client cannot be used in browser environment");
  }

  if (!supabaseUrl) {
    throw new Error(
      "Missing required Supabase runtime configuration: SUPABASE_URL or VITE_SUPABASE_URL"
    );
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(
      "Missing required Supabase runtime configuration: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY"
    );
  }

  if (!serviceRoleSupabaseClient) {
    serviceRoleSupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, getBaseSupabaseOptions());
  }

  return serviceRoleSupabaseClient;
}


/**
 * @deprecated Prefer createServiceRoleSupabaseClient() so elevated access is explicit.
 */
export const createServerSupabaseClient = (): ServiceRoleSupabaseClient => createServiceRoleSupabaseClient();
/**
 * @deprecated Prefer createServiceRoleSupabaseClient() so elevated access is explicit.
 */
export function getSupabaseClient(): ServiceRoleSupabaseClient {
  return createServiceRoleSupabaseClient();
}

/**
 * @deprecated Prefer createServiceRoleSupabaseClient() in server-side jobs/services.
 */
export const supabase = new Proxy({} as ServiceRoleSupabaseClient, {
  get(_target, property, receiver) {
    return Reflect.get(createServiceRoleSupabaseClient(), property, receiver);
  },
});
