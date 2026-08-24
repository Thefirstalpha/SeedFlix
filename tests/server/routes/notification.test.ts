import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { initDB, resetDatabase } from '../../../server/modules/db';
import { router as notificationRouter } from '../../../server/routes/notification';
import { addNotification, getNotifications } from '../../../server/modules/notification';
import { createUser } from '../../../server/modules/user';
import { createSessionCookie, createTestApp } from './testApp';

describe('Route: /api/notifications', () => {
  const app = createTestApp(notificationRouter);

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
  });

  it('should get notifications list with pagination', async () => {
    const { user } = createUser('notifRouteUser1');
    const cookie = createSessionCookie(user.id);
    addNotification(user.id, { title: 'N1', message: 'M1', type: 'info' });
    addNotification(user.id, { title: 'N2', message: 'M2', type: 'info' });

    const res = await request(app).get('/api/notifications?limit=10').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body.unreadCount).toBe(2);
  });

  it('should mark notification as read via POST /api/notifications/:id/read', async () => {
    const { user } = createUser('notifRouteUser2');
    const cookie = createSessionCookie(user.id);
    addNotification(user.id, { title: 'ToRead', message: 'Msg', type: 'info' });
    const notifId = getNotifications(user.id).notifications[0].id;

    const res = await request(app)
      .post(`/api/notifications/${notifId}/read`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const check = getNotifications(user.id);
    expect(check.unreadCount).toBe(0);
  });

  it('should return 404 when marking non-existing notification as read', async () => {
    const { user } = createUser('notifRouteUser3');
    const cookie = createSessionCookie(user.id);

    const res = await request(app)
      .post('/api/notifications/99999/read')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('should mark all notifications as read via POST /api/notifications/read-all', async () => {
    const { user } = createUser('notifRouteUser4');
    const cookie = createSessionCookie(user.id);
    addNotification(user.id, { title: 'N1', message: 'M1', type: 'info' });
    addNotification(user.id, { title: 'N2', message: 'M2', type: 'info' });

    const res = await request(app).post('/api/notifications/read-all').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(getNotifications(user.id).unreadCount).toBe(0);
  });

  it('should delete notification by id via DELETE /api/notifications/:id', async () => {
    const { user } = createUser('notifRouteUser5');
    const cookie = createSessionCookie(user.id);
    addNotification(user.id, { title: 'DeleteMe', message: 'Msg', type: 'info' });
    const notifId = getNotifications(user.id).notifications[0].id;

    const res = await request(app)
      .delete(`/api/notifications/${notifId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(getNotifications(user.id).notifications).toHaveLength(0);
  });

  it('should clear all notifications via DELETE /api/notifications', async () => {
    const { user } = createUser('notifRouteUser6');
    const cookie = createSessionCookie(user.id);
    addNotification(user.id, { title: 'N1', message: 'M1', type: 'info' });
    addNotification(user.id, { title: 'N2', message: 'M2', type: 'info' });

    const res = await request(app).delete('/api/notifications').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(getNotifications(user.id).notifications).toHaveLength(0);
  });

  it('should create test notification via POST /api/notifications/test', async () => {
    const { user } = createUser('notifRouteUser7');
    const cookie = createSessionCookie(user.id);

    const res = await request(app).post('/api/notifications/test').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(getNotifications(user.id).notifications).toHaveLength(1);
  });
});

