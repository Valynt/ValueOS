import {
  createServiceRoleSupabaseClient,
  type ServiceRoleSupabaseClient,
} from "@shared/lib/supabase";

import { assertNotTestEnv } from "../../supabase.js";

export type BillingPlatformJustification =
  `service-role:justified billing ${string}`;

export interface BillingPlatformClientOptions {
  justification: BillingPlatformJustification;
}

/**
 * Creates a service-role Supabase client for shared billing platform operations
 * (e.g. loading global meters, price books) that do not have a tenant context
 * but require elevated access to the billing schema.
 */
export function createBillingPlatformSupabaseClient(
  _options: BillingPlatformClientOptions
): ServiceRoleSupabaseClient {
  assertNotTestEnv("createBillingPlatformSupabaseClient");
  return createServiceRoleSupabaseClient();
}
