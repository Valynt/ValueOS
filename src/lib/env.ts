/**
 * Unified environment adapter for both server and browser runtimes.
 * All code should import helpers from this module instead of touching
 * `process.env` or `import.meta.env` directly.
 */

type EnvRecord = Record<string, string | undefined>;

const detectIsBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';
const detectIsServer = (): boolean =>
  typeof window === 'undefined' && typeof document === 'undefined';

const resolveEnvSource = (): EnvRecord => {
  if (detectIsServer() && typeof process !== 'undefined' && process.env) {
    return process.env;
  }

  if (typeof import.meta !== 'undefined') {
    return (import.meta as unknown as { env?: EnvRecord }).env ?? {};
  }

  return {};
};

let envSource: EnvRecord = resolveEnvSource();

type EnvScope = 'server' | 'browser' | 'any';

interface EnvOptions {
  required?: boolean;
  defaultValue?: string;
  scope?: EnvScope;
}

export const env = {
  isBrowser: (): boolean => detectIsBrowser(),
  isServer: (): boolean => detectIsServer(),
  get mode(): string {
    if (typeof import.meta !== 'undefined') {
      const meta = import.meta as unknown as { env?: { MODE?: string } };
      if (meta.env?.MODE) {
        return meta.env.MODE;
      }
    }
    if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
      return process.env.NODE_ENV;
    }
    return 'development';
  },
  get isDevelopment(): boolean {
    return this.mode === 'development';
  },
  get isProduction(): boolean {
    return this.mode === 'production';
  },
};

export const isServer = (): boolean => env.isServer();
export const isBrowser = (): boolean => env.isBrowser();

export function getEnvVar(key: string, options: EnvOptions = {}): string | undefined {
  const value = envSource[key] ?? options.defaultValue;

  if (options.required && (value === undefined || value === '')) {
    const scope = options.scope ?? 'any';
    throw new Error(`Missing required ${scope} environment variable: ${key}`);
  }

  return value;
}

export function getSupabaseConfig(): {
  url?: string;
  anonKey?: string;
  serviceRoleKey?: string;
} {
  return {
    url: getEnvVar('VITE_SUPABASE_URL'),
    anonKey: getEnvVar('VITE_SUPABASE_ANON_KEY'),
    serviceRoleKey:
      getEnvVar('SUPABASE_SERVICE_ROLE_KEY') ||
      getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY'),
  };
}

export function getLLMCostTrackerConfig(): {
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  slackWebhookUrl?: string;
  alertEmail?: string;
} {
  const supabase = getSupabaseConfig();
  return {
    supabaseUrl: supabase.url,
    supabaseServiceRoleKey: supabase.serviceRoleKey,
    slackWebhookUrl: getEnvVar('SLACK_WEBHOOK_URL'),
    alertEmail: getEnvVar('ALERT_EMAIL'),
  };
}

/**
 * Test helper: override the cached env source.
 */
export function __setEnvSourceForTests(source: EnvRecord): void {
  envSource = source;
}
