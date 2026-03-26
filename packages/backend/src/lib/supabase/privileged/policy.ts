import { createServiceRoleSupabaseClient, type ServiceRoleSupabaseClient } from '@shared/lib/supabase';

import { assertRealSupabaseAllowed } from '../../test/runtimeGuards';
import { getValidatedSupabaseRuntimeConfig } from '../env';

export type ServiceRoleJustification = `service-role:justified ${string}`;

export type ServiceRoleScope = 'auth-provisioning' | 'cron' | 'platform-admin';

export interface ServiceRoleClientOptions {
  justification: ServiceRoleJustification;
}

export function createScopedServiceRoleSupabaseClient(
  _scope: ServiceRoleScope,
  _options: ServiceRoleClientOptions
): ServiceRoleSupabaseClient {
  if (process.env.VITEST) {
    assertRealSupabaseAllowed('createScopedServiceRoleSupabaseClient');
  }

  getValidatedSupabaseRuntimeConfig();
  return createServiceRoleSupabaseClient();
}
