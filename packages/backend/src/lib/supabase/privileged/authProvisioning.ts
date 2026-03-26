import type { ServiceRoleSupabaseClient } from '@shared/lib/supabase';

import {
  createScopedServiceRoleSupabaseClient,
  type ServiceRoleClientOptions,
} from './policy';

export function createAuthProvisioningSupabaseClient(
  options: ServiceRoleClientOptions
): ServiceRoleSupabaseClient {
  return createScopedServiceRoleSupabaseClient('auth-provisioning', options);
}
