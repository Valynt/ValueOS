import { trpc } from "@/lib/trpc";

export type AuthUser = {
  id: string;
  name?: string;
  email?: string;
  maturityLevel?: number;
  vosRole?: string;
  role?: string;
  openId: string;
};

export function useAuth() {
  const { data: user, isLoading, refetch } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
      // Refetch to update auth state
      await refetch();
      // Redirect to home
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return {
    user: user as AuthUser | null,
    isLoading,
    loading: isLoading, // Alias for compatibility
    isAuthenticated: !!user,
    logout,
  };
}

export default useAuth;