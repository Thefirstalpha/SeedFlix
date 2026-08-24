import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  checkTorznabConnection,
  rssTorznab,
  searchTorznab,
} from '../../../server/modules/torznab';
import { IndexerSettings } from '../../../common/settings';

describe('torznab module', () => {
  const sampleSettings: IndexerSettings = {
    url: 'https://indexer.example.com/api',
    token: 'test-api-token',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:torznab="http://torznab.com/schemas/2015/feed">
  <channel>
    <title>Indexer Results</title>
    <item>
      <title>Test.Movie.2024.1080p.WEB-DL</title>
      <link>https://indexer.example.com/download/123</link>
      <guid>guid-123</guid>
      <size>1048576000</size>
      <pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate>
      <torznab:attr name="seeders" value="50"/>
      <torznab:attr name="peers" value="10"/>
    </item>
    <item>
      <title>Test.Movie.2.2024.1080p.WEB-DL</title>
      <link>https://indexer.example.com/download/124</link>
      <guid>guid-124</guid>
    </item>
  </channel>
</rss>`;

  const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Incorrect user credentials"/>`;

  it('should search Torznab and parse XML response to JSON', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => validXml,
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await searchTorznab(sampleSettings, 'Test Movie', 550, 10, 0);

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.rss.channel.item).toHaveLength(2);
    expect(result.rss.channel.item[0].title).toBe('Test.Movie.2024.1080p.WEB-DL');
  });

  it('should check Torznab connection using caps query', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => validXml,
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await checkTorznabConnection(sampleSettings);
    expect(result.rss.channel.title).toBe('Indexer Results');
  });

  it('should fetch RSS feed from Torznab', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => validXml,
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await rssTorznab(sampleSettings, 'movie', 10, 0);
    expect(result.rss.channel.item).toHaveLength(2);
  });

  it('should throw ErrorCode when Torznab returns XML error tag', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => errorXml,
    });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(searchTorznab(sampleSettings, 'Test', 1, 10, 0)).rejects.toThrow(
      'Incorrect user credentials',
    );
  });

  it('should throw ErrorCode on HTTP error', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server error',
    });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(searchTorznab(sampleSettings, 'Test', 1, 10, 0)).rejects.toThrow(
      'Torznab request failed',
    );
  });
});

