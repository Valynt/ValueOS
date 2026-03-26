import type { ServiceRoleSupabaseClient } from '@shared/lib/supabase';

import {
  createScopedServiceRoleSupabaseClient,
  type ServiceRoleClientOptions,
} from './policy';

export function createCronSupabaseClient(
  options: ServiceRoleClientOptions
): ServiceRoleSupabaseClient {
  return createScopedServiceRoleSupabaseClient('cron', options);
}
