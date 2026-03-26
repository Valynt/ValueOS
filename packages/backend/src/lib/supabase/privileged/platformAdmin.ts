import type { ServiceRoleSupabaseClient } from '@shared/lib/supabase';

import {
  createScopedServiceRoleSupabaseClient,
  type ServiceRoleClientOptions,
} from './policy';

export function createPlatformAdminSupabaseClient(
  options: ServiceRoleClientOptions
): ServiceRoleSupabaseClient {
  return createScopedServiceRoleSupabaseClient('platform-admin', options);
}
