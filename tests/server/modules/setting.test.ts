import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initDB, resetDatabase } from '../../../server/modules/db';
import {
  getTmdbApiKey,
  readGlobalConfig,
  updateGlobalConfig,
} from '../../../server/modules/setting';

describe('setting module', () => {
  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
  });

  it('should update and read global config', () => {
    updateGlobalConfig({
      tmdbApiKey: 'test-tmdb-key-123',
      pullAuto: false,
    });

    const config = readGlobalConfig();
    expect(config.tmdbApiKey).toBe('test-tmdb-key-123');
    expect(config.pullAuto).toBe(false);
  });

  it('should return TMDB API key from global config', async () => {
    updateGlobalConfig({ tmdbApiKey: 'my-api-key' });
    const key = await getTmdbApiKey();
    expect(key).toBe('my-api-key');
  });

  it('should return null when TMDB API key is not configured', async () => {
    const key = await getTmdbApiKey();
    expect(key).toBeNull();
  });

  it('should read and preserve webPushVapidKeys in global config', () => {
    updateGlobalConfig({
      webPushVapidKeys: {
        publicKey: 'pub-key-123',
        privateKey: 'priv-key-456',
      },
    });

    const config = readGlobalConfig();
    expect(config.webPushVapidKeys?.publicKey).toBe('pub-key-123');
    expect(config.webPushVapidKeys?.privateKey).toBe('priv-key-456');
  });
});

