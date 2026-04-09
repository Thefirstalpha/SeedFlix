import { API_BASE_URL } from "../config/tmdb";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "error" | "warning" | "search";
  createdAt: string;
  isRead: boolean;
  data?: Record<string, unknown>;
}

export interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error("Empty response");
  }
  return JSON.parse(text);
}

export async function getNotifications(
  limit = 50,
  unreadOnly = false
): Promise<NotificationResponse> {
  const params = new URLSearchParams();
  params.append("limit", String(limit));
  if (unreadOnly) {
    params.append("unreadOnly", "true");
  }

  const response = await fetch(`${API_BASE_URL}/notifications?${params}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch notifications: ${response.status} ${response.statusText}`
    );
  }

  return parseJson<NotificationResponse>(response);
}

export async function markAsRead(notificationId: string): Promise<Notification> {
  const response = await fetch(
    `${API_BASE_URL}/notifications/${notificationId}/read`,
    {
      method: "POST",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to mark notification as read: ${response.status} ${response.statusText}`
    );
  }

  return parseJson<Notification>(response);
}

export async function markAllAsRead(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to mark all as read: ${response.status} ${response.statusText}`
    );
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/notifications/${notificationId}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to delete notification: ${response.status} ${response.statusText}`
    );
  }
}

export async function clearAllNotifications(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notifications`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to clear notifications: ${response.status} ${response.statusText}`
    );
  }
}

export async function sendTestNotification(): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/notifications/test`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to send test notification: ${response.status} ${response.statusText}`
    );
  }

  return parseJson<{ ok: boolean; message: string }>(response);
}
