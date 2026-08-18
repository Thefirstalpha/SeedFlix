
import { Notification } from '../../common/notification';
import { db } from './db';

// ─── Lecture ─────────────────────────────────────────────────────────────────

function rowToNotification(row: any): Notification {
    return {
        id: String(row.id),
        title: row.title,
        message: row.message,
        isRead: Boolean(row.read),
        createdAt: row.created_at,
        type: row.type,
        data: row.data ? JSON.parse(row.data) : undefined,
    };
}

export function getNotifications(
    userId: number,
    options: { limit?: number; unreadOnly?: boolean } = {},
): { notifications: Notification[]; unreadCount: number } {
    const unreadCount = Number(
        (db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0').get(userId) as any)?.c ?? 0,
    );

    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params: any[] = [userId];

    if (options.unreadOnly) {
        query += ' AND read = 0';
    }
    query += ' ORDER BY created_at DESC';
    if (options.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
    }

    const rows = db.prepare(query).all(...params);
    return { notifications: rows.map(rowToNotification), unreadCount };
}

export function getUnreadCount(userId: number): number {
    return Number(
        (db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0').get(userId) as any)?.c ?? 0,
    );
}

// ─── Ajout ────────────────────────────────────────────────────────────────────

export function addNotification(userId: number, notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) {
    db.prepare(
        'INSERT INTO notifications (user_id, title, message, type, read, data) VALUES (?, ?, ?, ?, 0, ?)',
    ).run(userId, notification.title, notification.message, notification.type, notification.data ? JSON.stringify(notification.data) : null);
}

// ─── Marquer comme lu ─────────────────────────────────────────────────────────

export function markAsRead(userId: number, notificationId: string): boolean {
    const result = db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?').run(userId, Number(notificationId));
    return (result as any).changes > 0;
}

export function markAllAsRead(userId: number): void {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
}

// ─── Suppression ──────────────────────────────────────────────────────────────

export function deleteNotification(userId: number, notificationId: string): boolean {
    const result = db.prepare('DELETE FROM notifications WHERE user_id = ? AND id = ?').run(userId, Number(notificationId));
    return (result as any).changes > 0;
}

export function clearNotifications(userId: number): void {
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
}
