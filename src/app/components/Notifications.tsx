import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { X, Trash2, Check, CheckCircle, Clock } from "lucide-react";
import type { Notification } from "../services/notificationService";
import * as notificationService from "../services/notificationService";

function emitUnreadNotificationsUpdated(count: number) {
  window.dispatchEvent(
    new CustomEvent("seedflix:notifications-updated", {
      detail: { count: Math.max(0, Number(count) || 0) },
    })
  );
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);

    return () => clearInterval(interval);
  }, [user, navigate]);

  const loadNotifications = async () => {
    try {
      const data = await notificationService.getNotifications(100);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      emitUnreadNotificationsUpdated(data.unreadCount);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      const nextUnreadCount = Math.max(0, unreadCount - 1);
      setUnreadCount(nextUnreadCount);
      emitUnreadNotificationsUpdated(nextUnreadCount);
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      emitUnreadNotificationsUpdated(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

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
      default:
        return <Check className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-white/70 mt-2">
              {unreadCount} notification{unreadCount !== 1 ? "s" : ""} non lue{unreadCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button
              onClick={handleMarkAllAsRead}
              variant="outline"
              className="text-sm border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Marquer tout comme lu
            </Button>
          )}
          {notifications.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Vider tout
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-white/15 bg-slate-950 text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-red-200">Vider toutes les notifications</AlertDialogTitle>
                  <AlertDialogDescription className="text-white/70">
                    Cette action supprimera définitivement toutes vos notifications. Cette action ne peut pas être annulée.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex justify-end gap-3">
                  <AlertDialogCancel className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleClearAll}
                  >
                    Supprimer
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-white/60">Chargement des notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-8 text-center border-white/10 bg-white/5">
          <p className="text-white/60">Aucune notification pour le moment</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`p-4 border-l-4 border-white/10 transition-all ${
                getTypeColor(notif.type)
              } ${!notif.isRead ? "ring-1 ring-white/20 shadow-sm" : "border-l-white/20"}`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">
                      {notif.title}
                    </h3>
                    <Badge className={getTypeBadgeColor(notif.type)}>
                      {getTypeIcon(notif.type)}
                      <span className="ml-1 text-xs">
                        {notif.type === "success"
                          ? "complete"
                          : notif.type === "error"
                            ? "erreur"
                            : notif.type === "warning"
                              ? "attention"
                              : "info"}
                      </span>
                    </Badge>
                    {!notif.isRead && (
                      <Badge className="bg-blue-600 text-white">Nouveau</Badge>
                    )}
                  </div>
                  <p className="text-sm text-white/85 mb-2">
                    {notif.message}
                  </p>
                  <p className="text-xs text-white/60">
                    {new Date(notif.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  {!notif.isRead && (
                    <Button
                      onClick={() => handleMarkAsRead(notif.id)}
                      size="sm"
                      variant="outline"
                      className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10"
                      title="Marquer comme lu"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    onClick={() => handleDelete(notif.id)}
                    size="sm"
                    variant="ghost"
                    className="text-red-300 hover:text-red-200 hover:bg-red-500/15"
                    title="Supprimer"
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
