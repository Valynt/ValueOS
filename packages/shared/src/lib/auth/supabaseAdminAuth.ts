export interface SupabaseAdminUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
}

export interface SupabaseAdminGetUserByEmailResponse {
  data: {
    user: SupabaseAdminUser | null;
  } | null;
  error: {
    message: string;
  } | null;
}

export interface SupabaseAdminAuthApi {
  getUserByEmail(email: string): Promise<SupabaseAdminGetUserByEmailResponse>;
}

export interface SupabaseAdminAuthClient {
  auth: {
    admin: SupabaseAdminAuthApi;
  };
}

export class SupabaseAdminAuthAdapter {
  constructor(private readonly client: SupabaseAdminAuthClient) {}

  async getUserByEmail(email: string): Promise<SupabaseAdminUser | null> {
    const { data, error } = await this.client.auth.admin.getUserByEmail(email);

    if (error) {
      throw new Error(`Supabase admin getUserByEmail failed: ${error.message}`);
    }

    return data?.user ?? null;
  }
}
