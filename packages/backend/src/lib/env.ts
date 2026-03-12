/**
 * Environment Configuration
 *
 * Re-exports shared environment utilities and centralizes
 * backend runtime configuration validation.
 */

export {
  getEnvVar,
  setEnvVar,
  getSupabaseConfig,
  getGroundtruthConfig,
  getLLMCostTrackerConfig,
  __setEnvSourceForTests,
  checkIsBrowser as isBrowser,
} from '@shared/lib/env';

export interface RuntimeSupabaseConfig {
  url: string;
  serviceRoleKey: string;
  /** Anon key — safe for user-scoped clients; RLS is enforced when used with a user JWT. */
  anonKey: string;
}

const SUPABASE_URL_VARS = ['SUPABASE_URL', 'VITE_SUPABASE_URL'] as const;
const SUPABASE_SERVICE_KEY_VARS = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY'] as const;
const SUPABASE_ANON_KEY_VARS = ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'] as const;

function getFirstSetEnvVar(candidates: readonly string[]): string | undefined {
  for (const key of candidates) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function formatMissingMessage(candidates: readonly string[]): string {
  return candidates.join(' or ');
}

export function getValidatedSupabaseRuntimeConfig(): RuntimeSupabaseConfig {
  const url = getFirstSetEnvVar(SUPABASE_URL_VARS);
  const serviceRoleKey = getFirstSetEnvVar(SUPABASE_SERVICE_KEY_VARS);
  const anonKey = getFirstSetEnvVar(SUPABASE_ANON_KEY_VARS);
  const missing: string[] = [];

  if (!url) {
    missing.push(formatMissingMessage(SUPABASE_URL_VARS));
  }

  if (!serviceRoleKey) {
    missing.push(formatMissingMessage(SUPABASE_SERVICE_KEY_VARS));
  }

  if (!anonKey) {
    missing.push(formatMissingMessage(SUPABASE_ANON_KEY_VARS));
  }

  if (missing.length > 0) {
    const environment = process.env.NODE_ENV || 'development';
    // In test environments the Supabase client is always mocked at the module
    // level. Return stub values so constructors that call createServerSupabaseClient()
    // can complete without throwing — actual network calls will never be made.
    // VITEST is always set by the vitest runner; NODE_ENV may remain 'development'
    // depending on the shell. Never stub in production regardless of VITEST.
    if (environment !== 'production' && (environment === 'test' || process.env.VITEST)) {
      return {
        url: 'http://localhost:54321',
        serviceRoleKey: 'test-service-role-key',
        anonKey: 'test-anon-key',
      };
    }
    throw new Error(
      `[config] Missing required Supabase runtime configuration: ${missing.join(', ')}. ` +
        `Refusing to boot in ${environment} mode without explicit runtime values.`,
    );
  }

  try {
    new URL(url!);
  } catch {
    throw new Error(`[config] Invalid Supabase runtime configuration: ${SUPABASE_URL_VARS.join(' or ')} must be a valid URL.`);
  }

  return {
    url: url!,
    serviceRoleKey: serviceRoleKey!,
    anonKey: anonKey!,
  };
}
