import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Download, Heart, LogOut, Settings, User, Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { getWishlistCount } from "../services/wishlistService";
import { getSeriesWishlistCount } from "../services/seriesWishlistService";
import { getTorrentDownloads } from "../services/torrentService";
import * as notificationService from "../services/notificationService";
import { Button } from "./ui/button";
import { useAuth } from "../context/AuthContext";

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const [wishlistCount, setWishlistCount] = useState(0);
  const [downloadsCount, setDownloadsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const wishlistTarget = location.pathname === "/wishlist" ? "/" : "/wishlist";
  const {
    user,
    isAuthenticated,
    logout,
    needsInitialSetup,
    mustChangePassword,
    mustConfigureTmdb,
    mustConfigureTorrent,
    mustConfigureIndexer,
  } = useAuth();
  const isSetupPage = location.pathname === "/setup";
  const hasPendingSetup =
    needsInitialSetup ||
    mustChangePassword ||
    mustConfigureTmdb ||
    mustConfigureTorrent ||
    mustConfigureIndexer;
  const canShowNavigationActions = isAuthenticated && !isSetupPage && !hasPendingSetup;

  useEffect(() => {
    if (!canShowNavigationActions) {
      setWishlistCount(0);
      return;
    }

    const loadCount = async () => {
      const [movieCount, seriesCount] = await Promise.all([
        getWishlistCount(),
        getSeriesWishlistCount(),
      ]);
      setWishlistCount(movieCount + seriesCount);
    };
    void loadCount();
  }, [canShowNavigationActions, location.pathname]);

  useEffect(() => {
    if (!isAuthenticated || isSetupPage || hasPendingSetup) {
      setDownloadsCount(0);
      return;
    }

    const loadDownloadsCount = async () => {
      try {
        const response = await getTorrentDownloads();
        setDownloadsCount(response.activeCount || 0);
      } catch {
        setDownloadsCount(0);
      }
    };

    void loadDownloadsCount();
    const interval = setInterval(() => {
      void loadDownloadsCount();
    }, 7000);

    return () => clearInterval(interval);
  }, [
    isAuthenticated,
    isSetupPage,
    hasPendingSetup,
    location.pathname,
  ]);

  useEffect(() => {
    if (!isAuthenticated || isSetupPage || hasPendingSetup) {
      setUnreadNotificationsCount(0);
      return;
    }

    const loadUnreadCount = async () => {
      try {
        const data = await notificationService.getNotifications(1, true);
        setUnreadNotificationsCount(data.unreadCount);
      } catch {
        setUnreadNotificationsCount(0);
      }
    };

    void loadUnreadCount();
    const interval = setInterval(() => {
      void loadUnreadCount();
    }, 10000);

    return () => clearInterval(interval);
  }, [
    isAuthenticated,
    isSetupPage,
    hasPendingSetup,
    location.pathname,
  ]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isUserMenuOpen]);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  const handleOpenSettings = () => {
    setIsUserMenuOpen(false);
    navigate("/settings");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="border-b border-white/10 backdrop-blur-sm bg-black/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <img
                src="/favicon.svg"
                alt="SeedFlix"
                className="h-11 w-11 rounded-sm"
              />
              <h1 className="text-3xl font-black text-white tracking-tighter">
                SeedFlix
              </h1>
            </Link>

            <div className="flex items-center gap-3">
              {canShowNavigationActions && (
                <Link
                  to="/downloads"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                >
                  <Download className="w-5 h-5 text-cyan-300" />
                  <span className="text-white font-medium">Téléchargements</span>
                  {downloadsCount > 0 && (
                    <span className="bg-cyan-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {downloadsCount}
                    </span>
                  )}
                </Link>
              )}

              {canShowNavigationActions && (
                <Link
                  to="/notifications"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                >
                  <Bell className="w-5 h-5 text-amber-300" />
                  <span className="text-white font-medium">Notifications</span>
                  {unreadNotificationsCount > 0 && (
                    <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </Link>
              )}

              {canShowNavigationActions && (
                <Link
                  to={wishlistTarget}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                >
                  <Heart
                    className={`w-5 h-5 ${wishlistCount > 0 ? "text-purple-400 fill-purple-400" : "text-white"}`}
                  />
                  <span className="text-white font-medium">
                    Ma liste
                  </span>
                  {wishlistCount > 0 && (
                    <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {wishlistCount}
                    </span>
                  )}
                </Link>
              )}

              {isAuthenticated ? (
                <div ref={userMenuRef} className="relative">
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => setIsUserMenuOpen((open) => !open)}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="menu"
                  >
                    <User className="w-4 h-4 mr-2" />
                    {user?.username}
                  </Button>

                  {isUserMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-2 min-w-[12rem] rounded-md border border-white/10 bg-slate-950/95 p-1 text-white shadow-2xl backdrop-blur-md z-[200]"
                      role="menu"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-white transition-colors hover:bg-white/10"
                        onClick={handleOpenSettings}
                        role="menuitem"
                      >
                        <Settings className="w-4 h-4 text-white/70" />
                        Paramètres
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-white transition-colors hover:bg-white/10"
                        onClick={handleLogout}
                        role="menuitem"
                      >
                        <LogOut className="w-4 h-4 text-white/70" />
                        Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-white/10 mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-white/60">
          <p>
            © 2026 SeedFlix - Obtenir un film ne devrait jamais dépasser sa durée.
          </p>
        </div>
      </footer>
    </div>
  );
}