import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface User {
  id: string;
  email: string;
  fullName?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // TODO: Implement actual session check with Supabase
        setIsLoading(false);
      } catch (error) {
        console.error("Auth check failed:", error);
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    // TODO: Implement actual sign in with Supabase
    console.log("Sign in:", email, password);
    setUser({ id: "1", email, fullName: "Test User" });
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    // TODO: Implement actual sign up with Supabase
    console.log("Sign up:", email, password, fullName);
    setUser({ id: "1", email, fullName });
  };

  const signOut = async () => {
    // TODO: Implement actual sign out with Supabase
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    // TODO: Implement actual password reset with Supabase
    console.log("Reset password:", email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
