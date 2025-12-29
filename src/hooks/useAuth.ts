/**
 * Updated useAuth Hook Export
 * Now includes UserClaims with permissions for Zero Trust Security
 */

import { useAuth as useAuthOriginal } from "../contexts/AuthContext";

// Re-export useAuth - now with UserClaims
export const useAuth = () => {
  const context = useAuthOriginal();

  // Map to simplified interface for ProtectedComponent
  return {
    user: context.userClaims,
    isLoading: context.loading,
    isAuthenticated: context.isAuthenticated,
    signOut: context.logout,
  };
};
