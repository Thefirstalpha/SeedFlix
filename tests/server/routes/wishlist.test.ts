import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { db, initDB, resetDatabase } from '../../../server/modules/db';
import * as tmdbModule from '../../../server/modules/tmdb';
import { router as wishlistRouter } from '../../../server/routes/wishlist';
import { createUser } from '../../../server/modules/user';
import { createSessionCookie, createTestApp } from './testApp';

vi.mock('../../../server/modules/tmdb', async (importOriginal) => {
  const actual = await importOriginal<typeof tmdbModule>();
  return {
    ...actual,
    proxyTmdb: vi.fn(),
  };
});

describe('Route: /api/wishlist', () => {
  const app = createTestApp(wishlistRouter);
  const mockedProxyTmdb = vi.mocked(tmdbModule.proxyTmdb);

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
  });

  const sampleMovie = {
    id: 550,
    title: 'Fight Club',
    original_title: 'Fight Club',
    release_date: '1999-10-15',
    genres: [{ id: 18, name: 'Drama' }],
    vote_average: 8.4,
    poster_path: '/poster.jpg',
  };

  it('should get empty wishlist for new user', async () => {
    const { user } = createUser('userWL');
    const cookie = createSessionCookie(user.id);

    const res = await request(app).get('/api/wishlist').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('should add movie to wishlist and retrieve it', async () => {
    mockedProxyTmdb.mockResolvedValueOnce(sampleMovie);
    const { user } = createUser('userWL2');
    const cookie = createSessionCookie(user.id);

    const addRes = await request(app)
      .post('/api/wishlist')
      .set('Cookie', cookie)
      .send({ tmdbId: 550, type: 'movie' });

    expect(addRes.status).toBe(201);
    expect(addRes.body.ok).toBe(true);

    const getRes = await request(app).get('/api/wishlist').set('Cookie', cookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0].title).toBe('Fight Club');
  });

  it('should check if item exists in wishlist by ID', async () => {
    mockedProxyTmdb.mockResolvedValueOnce(sampleMovie);
    const { user } = createUser('userWL3');
    const cookie = createSessionCookie(user.id);

    await request(app)
      .post('/api/wishlist')
      .set('Cookie', cookie)
      .send({ tmdbId: 550, type: 'movie' });

    const res = await request(app).get('/api/wishlist/550').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
    expect(res.body.content.title).toBe('Fight Club');
  });

  it('should delete wishlist item by param id', async () => {
    mockedProxyTmdb.mockResolvedValueOnce(sampleMovie);
    const { user } = createUser('userWL4');
    const cookie = createSessionCookie(user.id);

    await request(app)
      .post('/api/wishlist')
      .set('Cookie', cookie)
      .send({ tmdbId: 550, type: 'movie' });

    const delRes = await request(app).delete('/api/wishlist/550').set('Cookie', cookie);
    expect(delRes.status).toBe(200);

    const checkRes = await request(app).get('/api/wishlist/550').set('Cookie', cookie);
    expect(checkRes.body.exists).toBe(false);
  });

  it('should delete wishlist item with body payload', async () => {
    mockedProxyTmdb.mockResolvedValueOnce(sampleMovie);
    const { user } = createUser('userWL5');
    const cookie = createSessionCookie(user.id);

    await request(app)
      .post('/api/wishlist')
      .set('Cookie', cookie)
      .send({ tmdbId: 550, type: 'movie' });

    const delRes = await request(app)
      .delete('/api/wishlist')
      .set('Cookie', cookie)
      .send({ tmdbId: 550, type: 'movie' });

    expect(delRes.status).toBe(200);

    const listRes = await request(app).get('/api/wishlist').set('Cookie', cookie);
    expect(listRes.body).toHaveLength(0);
  });

  it('should batch delete wishlist items via /api/wishlists', async () => {
    mockedProxyTmdb.mockResolvedValueOnce(sampleMovie);
    const { user } = createUser('userWL6');
    const cookie = createSessionCookie(user.id);

    await request(app)
      .post('/api/wishlist')
      .set('Cookie', cookie)
      .send({ tmdbId: 550, type: 'movie' });

    const delRes = await request(app)
      .delete('/api/wishlists')
      .set('Cookie', cookie)
      .send({ items: [{ tmdbId: 550, type: 'movie' }] });

    expect(delRes.status).toBe(200);

    const listRes = await request(app).get('/api/wishlist').set('Cookie', cookie);
    expect(listRes.body).toHaveLength(0);
  });
});

