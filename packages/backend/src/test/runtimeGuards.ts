const REAL_INTEGRATION_ENV = 'VALUEOS_TEST_REAL_INTEGRATION';
const ALLOW_NETWORK_ENV = 'VALUEOS_TEST_ALLOW_NETWORK';
const ALLOW_SUPABASE_ENV = 'VALUEOS_TEST_ALLOW_SUPABASE';

function isEnabled(name: string): boolean {
  return process.env[name] === 'true';
}

export function isRealIntegrationTestMode(): boolean {
  return isEnabled(REAL_INTEGRATION_ENV);
}

export function isRealNetworkAllowed(): boolean {
  return isRealIntegrationTestMode() || isEnabled(ALLOW_NETWORK_ENV);
}

export function isRealSupabaseAllowed(): boolean {
  return isRealIntegrationTestMode() || isEnabled(ALLOW_SUPABASE_ENV);
}

export function assertRealNetworkAllowed(target: string): void {
  if (isRealNetworkAllowed()) {
    return;
  }

  throw new Error(
    `Unexpected outbound fetch during tests (${target}). Mock global fetch or set ${REAL_INTEGRATION_ENV}=true for an explicit integration run.`,
  );
}

export function assertRealSupabaseAllowed(caller: string): void {
  if (isRealSupabaseAllowed()) {
    return;
  }

  throw new Error(
    `Unexpected Supabase client creation during tests (${caller}). Mock src/lib/supabase.ts or set ${REAL_INTEGRATION_ENV}=true for an explicit integration run.`,
  );
}

export function describeIntegrationMode(): string {
  return isRealIntegrationTestMode() ? 'real-integration' : 'deterministic-test-double';
}
