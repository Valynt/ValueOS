import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./env.js";

const MAX_RETRY_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const AUTHORIZATION_PREFIX = "Bearer ";
const isServerRuntime = !(typeof globalThis !== "undefined" && "window" in globalThis);

function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof Response && error.status >= 500) return true;
  return false;
}

const fetchWithRetry = async (
  input: string | URL | Request,
  init?: RequestInit,
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
      if (!isRetryableError(error) || attempt >= MAX_RETRY_ATTEMPTS - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt));
    }
  }

  throw lastError;
};

function getClientOptions(options?: {
  authorization?: string;
  autoRefreshToken?: boolean;
  detectSessionInUrl?: boolean;
}): SupabaseClientOptions<"public"> {
  const authorization = options?.authorization;

  return {
    db: { schema: "public" },
    auth: {
      autoRefreshToken: options?.autoRefreshToken ?? false,
      persistSession: false,
      detectSessionInUrl: options?.detectSessionInUrl ?? false,
    },
    global: {
      fetch: fetchWithRetry,
      headers: authorization ? { Authorization: authorization } : undefined,
    },
  };
}

function requireSupabaseUrl(): string {
  const { url } = getSupabaseConfig();
  if (!url) {
    throw new Error("Supabase URL is required");
  }
  return url;
}

function requireAnonKey(): string {
  const { anonKey } = getSupabaseConfig();
  if (!anonKey) {
    throw new Error("Supabase anon key is required");
  }
  return anonKey;
}

function requireServiceRoleKey(): string {
  const { serviceRoleKey } = getSupabaseConfig();
  if (!serviceRoleKey) {
    throw new Error("Supabase service role key is required for elevated server-side operations");
  }
  return serviceRoleKey;
}

function parseBearerToken(header?: string | string[]): string | null {
  if (!header) return null;

  const headerValue = Array.isArray(header) ? header[0] : header;
  if (!headerValue?.startsWith(AUTHORIZATION_PREFIX)) {
    return null;
  }

  const token = headerValue.slice(AUTHORIZATION_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

export interface SupabaseRequestLike {
  headers?: { authorization?: string | string[] };
  session?: Record<string, unknown> | null;
  supabase?: SupabaseClient;
  supabaseUser?: unknown;
  user?: unknown;
}

export type BrowserAnonSupabaseClientFactory = typeof createBrowserAnonSupabaseClient;
export type RequestRlsSupabaseClientFactory = typeof createRequestRlsSupabaseClient;
export type ServiceRoleSupabaseClientFactory = typeof createServiceRoleSupabaseClient;

let browserAnonSupabaseClient: SupabaseClient | null = null;

export function createBrowserAnonSupabaseClient(): SupabaseClient {
  if (isServerRuntime) {
    throw new Error("createBrowserAnonSupabaseClient can only be used in the browser runtime");
  }

  if (!browserAnonSupabaseClient) {
    browserAnonSupabaseClient = createClient(
      requireSupabaseUrl(),
      requireAnonKey(),
      getClientOptions({ autoRefreshToken: true, detectSessionInUrl: true }),
    );
  }

  return browserAnonSupabaseClient;
}

function resolveRequestAccessToken(input: SupabaseRequestLike | string): string {
  if (typeof input === "string") {
    const token = input.trim();
    if (!token) {
      throw new Error("Supabase RLS client requires a non-empty bearer access token");
    }
    return token;
  }

  const bearerToken = parseBearerToken(input.headers?.authorization);
  if (bearerToken) {
    return bearerToken;
  }

  const sessionToken = input.session?.access_token;
  if (typeof sessionToken === "string" && sessionToken.trim().length > 0) {
    return sessionToken;
  }

  throw new Error(
    "Supabase RLS client requires an authenticated user bearer token and will not fall back to anon or service-role credentials",
  );
}

export function createRequestRlsSupabaseClient(input: SupabaseRequestLike | string): SupabaseClient {
  if (!isServerRuntime) {
    throw new Error("createRequestRlsSupabaseClient can only be used server-side");
  }

  if (typeof input !== "string" && input.supabase) {
    return input.supabase;
  }

  const client = createClient(
    requireSupabaseUrl(),
    requireAnonKey(),
    getClientOptions({ authorization: `${AUTHORIZATION_PREFIX}${resolveRequestAccessToken(input)}` }),
  );

  if (typeof input !== "string") {
    input.supabase = client;
    input.supabaseUser = input.user ?? null;
  }

  return client;
}

export function createServiceRoleSupabaseClient(serviceRoleKey?: string): SupabaseClient {
  if (!isServerRuntime) {
    throw new Error("createServiceRoleSupabaseClient cannot be used in the browser runtime");
  }

  const resolvedServiceRoleKey = serviceRoleKey?.trim() || requireServiceRoleKey();
  return createClient(requireSupabaseUrl(), resolvedServiceRoleKey, getClientOptions());
}

export const supabase = isServerRuntime ? null : createBrowserAnonSupabaseClient();

/**
 * @deprecated Use createBrowserAnonSupabaseClient() in the browser runtime.
 */
export function getSupabaseClient(): SupabaseClient {
  return createBrowserAnonSupabaseClient();
}

/**
 * @deprecated Use createRequestRlsSupabaseClient().
 */
export function createRequestSupabaseClient(input: SupabaseRequestLike | string): SupabaseClient {
  return createRequestRlsSupabaseClient(input);
}

/**
 * @deprecated Use createRequestRlsSupabaseClient().
 */
export function getRequestSupabaseClient(input: SupabaseRequestLike | string): SupabaseClient {
  return createRequestRlsSupabaseClient(input);
}

/**
 * @deprecated Use createServiceRoleSupabaseClient().
 */
export function createServerSupabaseClient(serviceRoleKey?: string): SupabaseClient {
  return createServiceRoleSupabaseClient(serviceRoleKey);
}
