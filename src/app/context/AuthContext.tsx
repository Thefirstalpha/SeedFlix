import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getCurrentAuth,
  login as loginRequest,
  logout as logoutRequest,
  type AuthResponse,
} from '../services/authService';
import { User } from '../../../common/user';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const auth = await getCurrentAuth();
      if (auth.user) {
        setUser(auth.user);
      } else {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login: async (username: string, password: string) => {
        const response = await loginRequest(username, password);
        setUser(response.user || null);
        return response;
      },
      logout: async () => {
        await logoutRequest();
        setUser(null);
      },
      refresh,
    }),
    [
      user,
      isLoading,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
