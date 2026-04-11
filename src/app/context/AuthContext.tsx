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
  type AuthResponse,
  type AuthUser,
  type UserSettings,
} from "../services/authService";

interface AuthContextValue {
  user: AuthUser | null;
  settings: UserSettings | null;
  mustChangePassword: boolean;
  mustConfigureTmdb: boolean;
  mustConfigureTorrent: boolean;
  mustConfigureIndexer: boolean;
  shouldChangePassword: boolean;
  legalAccepted: boolean;
  needsInitialSetup: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setSettings: (settings: UserSettings) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [mustConfigureTmdb, setMustConfigureTmdb] = useState(false);
  const [mustConfigureTorrent, setMustConfigureTorrent] = useState(false);
  const [mustConfigureIndexer, setMustConfigureIndexer] = useState(false);
  const [shouldChangePassword, setShouldChangePassword] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [needsInitialSetup, setNeedsInitialSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const auth = await getCurrentAuth();
      if (auth.authenticated && auth.user) {
        setUser(auth.user);
        setSettings(auth.settings || null);
        setMustChangePassword(auth.mustChangePassword);
        setMustConfigureTmdb(auth.mustConfigureTmdb);
        setMustConfigureTorrent(auth.mustConfigureTorrent);
        setMustConfigureIndexer(auth.mustConfigureIndexer);
        setShouldChangePassword(auth.shouldChangePassword);
        setLegalAccepted(auth.legalAccepted);
        setNeedsInitialSetup(auth.needsInitialSetup);
      } else {
        setUser(null);
        setSettings(null);
        setMustChangePassword(false);
        setMustConfigureTmdb(false);
        setMustConfigureTorrent(false);
        setMustConfigureIndexer(false);
        setShouldChangePassword(false);
        setLegalAccepted(false);
        setNeedsInitialSetup(false);
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
    mustChangePassword,
    mustConfigureTmdb,
    mustConfigureTorrent,
    mustConfigureIndexer,
    shouldChangePassword,
    legalAccepted,
    needsInitialSetup,
    isAuthenticated: Boolean(user),
    isLoading,
    login: async (username: string, password: string) => {
      const response = await loginRequest(username, password);
      setUser(response.user || null);
      setSettings(response.settings || null);
      setMustChangePassword(response.mustChangePassword);
      setMustConfigureTmdb(response.mustConfigureTmdb);
      setMustConfigureTorrent(response.mustConfigureTorrent);
      setMustConfigureIndexer(response.mustConfigureIndexer);
      setShouldChangePassword(response.shouldChangePassword);
      setLegalAccepted(Boolean(response.legalAccepted));
      setNeedsInitialSetup(response.needsInitialSetup);
      return response;
    },
    logout: async () => {
      await logoutRequest();
      setUser(null);
      setSettings(null);
      setMustChangePassword(false);
      setMustConfigureTmdb(false);
      setMustConfigureTorrent(false);
      setMustConfigureIndexer(false);
      setShouldChangePassword(false);
      setLegalAccepted(false);
      setNeedsInitialSetup(false);
    },
    refresh,
    setSettings,
  }), [
    user,
    settings,
    mustChangePassword,
    mustConfigureTmdb,
    mustConfigureTorrent,
    mustConfigureIndexer,
    shouldChangePassword,
    legalAccepted,
    needsInitialSetup,
    isLoading,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
