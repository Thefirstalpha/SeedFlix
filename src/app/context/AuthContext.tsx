import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getCurrentAuth,
  login as loginRequest,
  logout as logoutRequest,
  type AuthUser,
  type UserSettings,
} from "../services/authService";

interface AuthContextValue {
  user: AuthUser | null;
  settings: UserSettings | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setSettings: (settings: UserSettings) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const auth = await getCurrentAuth();
      if (auth.authenticated && auth.user) {
        setUser(auth.user);
        setSettings(auth.settings || null);
      } else {
        setUser(null);
        setSettings(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    settings,
    isAuthenticated: Boolean(user),
    isLoading,
    login: async (username: string, password: string) => {
      const response = await loginRequest(username, password);
      setUser(response.user);
      setSettings(response.settings);
    },
    logout: async () => {
      await logoutRequest();
      setUser(null);
      setSettings(null);
    },
    refresh,
    setSettings,
  }), [user, settings, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
