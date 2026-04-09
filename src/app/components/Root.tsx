import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Download, Heart, LogOut, Settings, User, Bell, Menu } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getWishlistCount } from "../services/wishlistService";
import { getSeriesWishlistCount } from "../services/seriesWishlistService";
import { getTorrentDownloads } from "../services/torrentService";
import * as notificationService from "../services/notificationService";
import type { Notification } from "../services/notificationService";
import {
  getOrCreateBrowserDeviceId,
  parseBrowserDevices,
} from "../services/browserNotificationChannel";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { useAuth } from "../context/AuthContext";

type UnreadNotificationsEvent = CustomEvent<{ count: number }>;
const NOTIFICATIONS_POLL_INTERVAL_MS = 5000;

function showNotificationToast(type: Notification["type"], title: string, description: string) {
  switch (type) {
    case "success":
      toast.success(title, { description });
      break;
    case "error":
      toast.error(title, { description });
      break;
    case "warning":
      toast.warning(title, { description });
      break;
    default:
      toast.info(title, { description });
      break;
  }
}

function canUseBrowserNotificationChannel(
  notificationsSettings: unknown,
  browserDeviceId: string
): boolean {
  const settings =
    notificationsSettings && typeof notificationsSettings === "object"
      ? (notificationsSettings as Record<string, unknown>)
      : {};
  const enabledChannels = Array.isArray(settings.enabledChannels)
    ? (settings.enabledChannels as string[])
    : [];

  if (!enabledChannels.includes("browser")) {
    return false;
  }

  const browser = settings.browser;
  const browserDevices =
    browser && typeof browser === "object"
      ? parseBrowserDevices((browser as Record<string, unknown>).devices)
      : [];

  return browserDevices.some((device) => device.id === browserDeviceId);
}

function showBrowserNotification(title: string, message: string) {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  new Notification(title, {
    body: message,
    icon: "/favicon.svg",
  });
}

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const [wishlistCount, setWishlistCount] = useState(0);
  const [downloadsCount, setDownloadsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const hasHydratedUnreadRef = useRef(false);
  const previousUnreadCountRef = useRef(0);
  const [browserDeviceId] = useState(getOrCreateBrowserDeviceId);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const wishlistTarget = location.pathname === "/wishlist" ? "/" : "/wishlist";
  const {
    user,
    settings,
    isAuthenticated,
    logout,
    needsInitialSetup,
    mustChangePassword,
    mustConfigureTmdb,
    mustConfigureTorrent,
    mustConfigureIndexer,
  } = useAuth();
  const isSetupPage = location.pathname === "/setup";
  const isLoginPage = location.pathname === "/login";
  const shouldShowHeader = !isLoginPage && !isSetupPage;
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
        const latestUnread = Array.isArray(data.notifications)
          ? data.notifications[0]
          : undefined;
        const nextUnreadCount = Number(data.unreadCount || 0);
        const previousUnreadCount = previousUnreadCountRef.current;

        if (
          hasHydratedUnreadRef.current &&
          nextUnreadCount > previousUnreadCount &&
          location.pathname !== "/notifications"
        ) {
          const delta = nextUnreadCount - previousUnreadCount;
          if (latestUnread) {
            const toastTitle =
              delta > 1 ? `${delta} nouvelles notifications` : latestUnread.title;
            const toastDescription =
              delta > 1
                ? `${latestUnread.message} (et ${delta - 1} autre${delta - 1 > 1 ? "s" : ""})`
                : latestUnread.message;

            showNotificationToast(latestUnread.type, toastTitle, toastDescription);

            if (
              canUseBrowserNotificationChannel(
                settings?.placeholders?.notifications,
                browserDeviceId
              )
            ) {
              showBrowserNotification(latestUnread.title, latestUnread.message);
            }
          } else {
            toast.info(
              delta > 1 ? `${delta} nouvelles notifications` : "Nouvelle notification",
              {
                description: "Une mise a jour est disponible dans l'onglet Notifications.",
              }
            );
          }
        }

        hasHydratedUnreadRef.current = true;
        previousUnreadCountRef.current = nextUnreadCount;
        setUnreadNotificationsCount(nextUnreadCount);
        window.dispatchEvent(
          new CustomEvent("seedflix:notifications-updated", {
            detail: { count: nextUnreadCount },
          })
        );
      } catch {
        setUnreadNotificationsCount(0);
      }
    };

    void loadUnreadCount();
    const interval = setInterval(() => {
      void loadUnreadCount();
    }, NOTIFICATIONS_POLL_INTERVAL_MS);

    const handleImmediateRefresh = () => {
      void loadUnreadCount();
    };
    window.addEventListener("seedflix:notifications-refresh-request", handleImmediateRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("seedflix:notifications-refresh-request", handleImmediateRefresh);
    };
  }, [
    isAuthenticated,
    isSetupPage,
    hasPendingSetup,
    location.pathname,
    settings,
    browserDeviceId,
  ]);

  useEffect(() => {
    const handleUnreadUpdate = (event: Event) => {
      const typedEvent = event as UnreadNotificationsEvent;
      const nextCount = Number(typedEvent.detail?.count);
      if (Number.isFinite(nextCount) && nextCount >= 0) {
        previousUnreadCountRef.current = nextCount;
        setUnreadNotificationsCount(nextCount);
      }
    };

    window.addEventListener("seedflix:notifications-updated", handleUnreadUpdate);
    return () => {
      window.removeEventListener("seedflix:notifications-updated", handleUnreadUpdate);
    };
  }, []);

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
      {shouldShowHeader && (
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

            <div className="hidden items-center gap-3 md:flex">
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

                <Link
                  to="/notifications"
                  aria-label="Notifications"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                >
                  <Bell className="w-5 h-5 text-amber-300" />
                  {unreadNotificationsCount > 0 && (
                    <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </Link>

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

            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20"
                    aria-label="Ouvrir le menu"
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="border-white/10 bg-slate-950 text-white">
                  <SheetHeader className="pb-2">
                    <SheetTitle className="text-white">Menu</SheetTitle>
                  </SheetHeader>

                  <div className="px-4 pb-4 space-y-2">
                    {canShowNavigationActions && (
                      <>
                        <SheetClose asChild>
                          <Link
                            to="/downloads"
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <span className="flex items-center gap-2">
                              <Download className="w-4 h-4 text-cyan-300" />
                              Téléchargements
                            </span>
                            {downloadsCount > 0 && (
                              <span className="bg-cyan-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {downloadsCount}
                              </span>
                            )}
                          </Link>
                        </SheetClose>

                        <SheetClose asChild>
                          <Link
                            to={wishlistTarget}
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <span className="flex items-center gap-2">
                              <Heart
                                className={`w-4 h-4 ${wishlistCount > 0 ? "text-purple-400 fill-purple-400" : "text-white"}`}
                              />
                              Ma liste
                            </span>
                            {wishlistCount > 0 && (
                              <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {wishlistCount}
                              </span>
                            )}
                          </Link>
                        </SheetClose>

                        <SheetClose asChild>
                          <Link
                            to="/notifications"
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <span className="flex items-center gap-2">
                              <Bell className="w-4 h-4 text-amber-300" />
                              Notifications
                            </span>
                            {unreadNotificationsCount > 0 && (
                              <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {unreadNotificationsCount}
                              </span>
                            )}
                          </Link>
                        </SheetClose>
                      </>
                    )}
                    <SheetClose asChild>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left"
                        onClick={handleOpenSettings}
                      >
                        <Settings className="w-4 h-4 text-white/80" />
                        Paramètres
                      </button>
                    </SheetClose>
                    <SheetClose asChild>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-left text-red-100"
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4" />
                        Déconnexion
                      </button>
                    </SheetClose>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
      )}
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