import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./env.js";

const MAX_RETRY_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const isServer = !(typeof globalThis !== "undefined" && "window" in globalThis);

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
  if (error instanceof Response && error.status >= 500) return true;
  return false;
}

const fetchWithRetry = async (
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(input, init);
      if (response.status >= 500 && attempt < MAX_RETRY_ATTEMPTS - 1) {
        lastError = response;
        await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt >= MAX_RETRY_ATTEMPTS - 1) throw error;
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
    throw new Error("Supabase URL is required for server-side operations");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Supabase service role key is required for elevated server-side operations");
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
