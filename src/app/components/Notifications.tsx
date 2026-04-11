import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { X, Trash2, Check, CheckCircle, Clock, Search } from "lucide-react";
import type { Notification } from "../services/notificationService";
import * as notificationService from "../services/notificationService";
import { useI18n } from "../i18n/LanguageProvider";

function emitUnreadNotificationsUpdated(count: number) {
  window.dispatchEvent(
    new CustomEvent("seedflix:notifications-updated", {
      detail: { count: Math.max(0, Number(count) || 0) },
    })
  );
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user, settings } = useAuth();
  const { t, language } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    let cancelled = false;

    const initializeNotifications = async () => {
      try {
        const data = await notificationService.getNotifications(100);
        if (cancelled) {
          return;
        }

        // Keep the current visual state while viewing the page.
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        emitUnreadNotificationsUpdated(data.unreadCount);

        if (data.unreadCount > 0) {
          await notificationService.markAllAsRead();
          // Update global unread badge immediately, without mutating local cards state.
          emitUnreadNotificationsUpdated(0);
        }
      } catch (error) {
        console.error("Error loading notifications:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void initializeNotifications();

    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  const handleDelete = async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      const deleted = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (deleted && !deleted.isRead) {
        const nextUnreadCount = Math.max(0, unreadCount - 1);
        setUnreadCount(nextUnreadCount);
        emitUnreadNotificationsUpdated(nextUnreadCount);
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const isIndexerSuggestion = (notification: Notification) =>
    String(notification.data?.source || "") === "indexer-rss";

  const spoilerModeEnabled = Boolean(
    (settings?.placeholders?.preferences as Record<string, unknown> | undefined)?.spoilerMode
  );

  const maskEpisodeLabel = (value: string) =>
    value.replace(/(S\d{1,2}E\d{1,2})(?:\s*[-–]\s*[^:\n]+)?/i, "$1");

  const getNotificationMessage = (notification: Notification) => {
    if (!spoilerModeEnabled || String(notification.data?.mediaType || "") !== "episode") {
      return notification.message;
    }

    return maskEpisodeLabel(String(notification.message || ""));
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!isIndexerSuggestion(notification)) {
      return;
    }

    const targetKey = String(notification.data?.targetKey || "").trim();
    if (!targetKey) {
      navigate("/wishlist");
      return;
    }

    const tab = targetKey.startsWith("movie:") ? "movies" : "series";
    const params = new URLSearchParams({ tab, target: targetKey });
    navigate(`/wishlist?${params.toString()}`);
  };

  const handleClearAll = async () => {
    try {
      await notificationService.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      emitUnreadNotificationsUpdated(0);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 border-green-400/30";
      case "error":
        return "bg-red-500/10 border-red-400/30";
      case "warning":
        return "bg-amber-500/10 border-amber-400/30";
      case "search":
        return "bg-cyan-500/10 border-cyan-400/30";
      default:
        return "bg-blue-500/10 border-blue-400/30";
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-500/20 text-green-200 border border-green-400/40";
      case "error":
        return "bg-red-500/20 text-red-200 border border-red-400/40";
      case "warning":
        return "bg-amber-500/20 text-amber-200 border border-amber-400/40";
      case "search":
        return "bg-cyan-500/20 text-cyan-100 border border-cyan-400/40";
      default:
        return "bg-blue-500/20 text-blue-200 border border-blue-400/40";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4" />;
      case "error":
        return <X className="w-4 h-4" />;
      case "warning":
        return <Clock className="w-4 h-4" />;
      case "search":
        return <Search className="w-4 h-4" />;
      default:
        return <Check className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">{t("root.notifications")}</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-white/70 mt-2">
              {t(
                unreadCount > 1
                  ? "notificationsPage.unread_many"
                  : "notificationsPage.unread_one",
                { count: unreadCount }
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {notifications.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("notificationsPage.clearAll")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-white/15 bg-slate-950 text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-red-200">{t("notificationsPage.confirmClearTitle")}</AlertDialogTitle>
                  <AlertDialogDescription className="text-white/70">
                    {t("notificationsPage.confirmClearDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex justify-end gap-3">
                  <AlertDialogCancel className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleClearAll}
                  >
                    {t("common.remove")}
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-white/60">{t("notificationsPage.loading")}</p>
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-8 text-center border-white/10 bg-white/5">
          <p className="text-white/60">{t("notificationsPage.empty")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`p-4 border-l-4 border-white/10 transition-all ${
                getTypeColor(notif.type)
              } ${!notif.isRead ? "ring-1 ring-white/20 shadow-sm" : "border-l-white/20"} ${
                isIndexerSuggestion(notif) ? "cursor-pointer hover:bg-white/5" : ""
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white break-words">
                      {notif.title}
                    </h3>
                    <Badge className={getTypeBadgeColor(notif.type)}>
                      {getTypeIcon(notif.type)}
                      <span className="ml-1 text-xs">
                        {notif.type === "success"
                          ? t("notificationsPage.types.success")
                          : notif.type === "error"
                            ? t("notificationsPage.types.error")
                            : notif.type === "warning"
                              ? t("notificationsPage.types.warning")
                              : notif.type === "search"
                                ? t("notificationsPage.types.search")
                              : t("notificationsPage.types.info")}
                      </span>
                    </Badge>
                    {!notif.isRead && (
                      <Badge className="bg-blue-600 text-white">{t("notificationsPage.new")}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-white/85 mb-2">
                    {getNotificationMessage(notif)}
                  </p>
                  <p className="text-xs text-white/60">
                    {new Date(notif.createdAt).toLocaleString(language === "fr" ? "fr-FR" : "en-US")}
                  </p>
                </div>

                <div className="flex justify-end gap-2 sm:shrink-0">
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(notif.id);
                    }}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-300 hover:text-red-200 hover:bg-red-500/15"
                    title={t("common.remove")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
