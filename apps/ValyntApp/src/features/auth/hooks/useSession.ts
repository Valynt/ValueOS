import type { User } from "../types";

import { useAuth } from "@/contexts/AuthContext";

export function useSession() {
  const { user: supabaseUser, isAuthenticated, loading } = useAuth();

  // Map Supabase user to the features/auth User type
  const extendedUser: User | null = supabaseUser
    ? {
        id: supabaseUser.id,
        email: supabaseUser.email ?? "",
        fullName: supabaseUser.user_metadata?.full_name as string | undefined,
        avatarUrl: supabaseUser.user_metadata?.avatar_url as string | undefined,
        role: (supabaseUser.user_metadata?.role as User["role"]) ?? "member",
        createdAt: supabaseUser.created_at,
        updatedAt: supabaseUser.updated_at ?? supabaseUser.created_at,
      }
    : null;

  return {
    user: extendedUser,
    isAuthenticated,
    isLoading: loading,
    isAdmin: extendedUser?.role === "admin",
  };
}
