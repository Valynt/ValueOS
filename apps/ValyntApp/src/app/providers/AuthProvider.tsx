import { createContext, useContext, ReactNode } from "react";
import { useAuth0, Auth0Provider } from "@auth0/auth0-react";


interface User {
  id: string;
  email: string;
  fullName?: string;
  avatar_url?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | undefined>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthInternalProvider({ children }: { children: ReactNode }) {
  const {
    user: auth0User,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const signIn = async () => {
    await loginWithRedirect();
  };

  const signOut = async () => {
    await logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const getAccessToken = async () => {
    try {
      return await getAccessTokenSilently();
    } catch (error) {
      console.error("Error getting access token", error);
      return undefined;
    }
  };

  const user: User | null = auth0User
    ? {
        id: auth0User.sub || "",
        email: auth0User.email || "",
        fullName: auth0User.name,
        avatar_url: auth0User.picture,
        role: (auth0User as any)["https://valueos.app/roles"]?.[0] || "member",
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        signIn,
        signOut,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  if (!domain || !clientId) {
    return (
      <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded">
        Auth0 configuration missing. Please check VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience,
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      <AuthInternalProvider>{children}</AuthInternalProvider>
    </Auth0Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
