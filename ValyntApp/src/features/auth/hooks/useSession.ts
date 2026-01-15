import { useAuth } from "@/app/providers/AuthProvider";
import type { User } from "../types";

export function useSession() {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Cast to extended User type if needed
  const extendedUser = user as (User | null);

  return {
    user: extendedUser,
    isAuthenticated,
    isLoading,
    isAdmin: extendedUser?.role === "admin",
  };
}
