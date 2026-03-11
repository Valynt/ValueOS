import { logger } from "../lib/logger.js"
import { createServerSupabaseClient } from "../lib/supabase.js"

export interface AuthUserProfile {
  id: string;
  email: string;
  fullName: string;
  lastLoginAt?: string;
  createdAt: string;
  userMetadata: Record<string, unknown>;
}

const AUTH_LIST_PAGE_SIZE = 200;

/**
 * Guard rail: do not query auth schema tables directly from services.
 * Always use Supabase admin auth APIs via this adapter.
 */
export class AuthDirectoryService {
  private supabase = createServerSupabaseClient();

  async getProfilesByIds(userIds: string[]): Promise<Map<string, AuthUserProfile>> {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueUserIds.length === 0) {
      return new Map();
    }

    const targetIds = new Set(uniqueUserIds);
    const profileMap = new Map<string, AuthUserProfile>();

    let page = 1;
    while (targetIds.size > 0) {
      const { data, error } = await this.supabase.auth.admin.listUsers({
        page,
        perPage: AUTH_LIST_PAGE_SIZE,
      });

      if (error) {
        logger.warn("Failed to list auth users", error, { page });
        break;
      }

      const users = data?.users ?? [];
      if (users.length === 0) {
        break;
      }

      for (const user of users) {
        if (!targetIds.has(user.id)) {
          continue;
        }

        const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
        const fullName =
          (userMetadata.full_name as string | undefined) ??
          (userMetadata.name as string | undefined) ??
          (user.email ? user.email.split("@")[0] : "User");

        profileMap.set(user.id, {
          id: user.id,
          email: user.email ?? "",
          fullName,
          lastLoginAt: user.last_sign_in_at ?? undefined,
          createdAt: user.created_at ?? new Date().toISOString(),
          userMetadata,
        });

        targetIds.delete(user.id);
      }

      page += 1;
    }

    return profileMap;
  }
}

export const authDirectoryService = new AuthDirectoryService();
