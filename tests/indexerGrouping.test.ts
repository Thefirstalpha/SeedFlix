import { describe, expect, it } from 'vitest';
import {
  buildSeriesSections,
  getItemEpisode,
  getItemSeason,
  isCompleteSeriesPack,
} from '../src/app/services/indexerGrouping';
import { IndexerSeriesResult } from '../common/indexer';

describe('indexerGrouping', () => {
  const dummyLabels = {
    seasonSection: (s: number) => `Saison ${s}`,
    seasonPackSection: 'Packs Saison complète',
    seasonPackItem: (s: number) => `Pack Saison ${s}`,
    episodeSection: (s: number, e: number) => `Saison ${s} · Épisode ${e}`,
    singleEpisodeSection: (e: number) => `Épisode ${e}`,
    completeSeriesSection: 'Intégrale / Multi-saisons',
    unclassifiedSection: 'Autres / Non classé',
    resultsCount: (c: number) => `${c} version${c > 1 ? 's' : ''}`,
  };

  const sampleItems: IndexerSeriesResult[] = [
    {
      title: 'Breaking.Bad.S01E01.1080p.mkv',
      link: 'http://test/1',
      guid: 'guid-1',
      seasonNumber: 1,
      episodeNumber: 1,
    },
    {
      title: 'Breaking.Bad.S01E02.1080p.mkv',
      link: 'http://test/2',
      guid: 'guid-2',
      seasonNumber: 1,
      episodeNumber: 2,
    },
    {
      title: 'Breaking.Bad.S01.Complete.1080p',
      link: 'http://test/3',
      guid: 'guid-3',
      seasonNumber: 1,
      episodeNumber: null,
    },
    {
      title: 'Breaking.Bad.S02E01.720p.mkv',
      link: 'http://test/4',
      guid: 'guid-4',
      seasonNumber: 2,
      episodeNumber: 1,
    },
    {
      title: 'Breaking.Bad.Integrale.S01-S05.1080p',
      link: 'http://test/5',
      guid: 'guid-5',
      seasonNumber: null,
      episodeNumber: null,
    },
    {
      title: 'Breaking.Bad.Special.Bonus.Feature',
      link: 'http://test/6',
      guid: 'guid-6',
      seasonNumber: null,
      episodeNumber: null,
    },
  ];

  it('correctly extracts season and episode numbers', () => {
    expect(getItemSeason(sampleItems[0])).toBe(1);
    expect(getItemEpisode(sampleItems[0])).toBe(1);
    expect(getItemSeason(sampleItems[2])).toBe(1);
    expect(getItemEpisode(sampleItems[2])).toBeNull();
    expect(getItemSeason(sampleItems[4])).toBeNull();
    expect(getItemEpisode(sampleItems[4])).toBeNull();
  });

  it('detects complete series titles', () => {
    expect(isCompleteSeriesPack('Breaking.Bad.Integrale.S01-S05')).toBe(true);
    expect(isCompleteSeriesPack('The.Wire.Complete.Series.1080p')).toBe(true);
    expect(isCompleteSeriesPack('Breaking.Bad.S01E01.1080p')).toBe(false);
  });

  it('groups series results by season', () => {
    const sections = buildSeriesSections({
      items: sampleItems,
      mode: 'season',
      labels: dummyLabels,
    });

    expect(sections).toHaveLength(4);
    expect(sections[0].id).toBe('season-1');
    expect(sections[0].title).toBe('Saison 1');
    expect(sections[0].items).toHaveLength(3); // S01E01, S01E02, S01 Complete

    expect(sections[1].id).toBe('season-2');
    expect(sections[1].title).toBe('Saison 2');
    expect(sections[1].items).toHaveLength(1); // S02E01

    expect(sections[2].id).toBe('complete-series');
    expect(sections[2].title).toBe('Intégrale / Multi-saisons');
    expect(sections[2].items).toHaveLength(1);

    expect(sections[3].id).toBe('unclassified');
    expect(sections[3].title).toBe('Autres / Non classé');
    expect(sections[3].items).toHaveLength(1);
  });

  it('groups series results by episode', () => {
    const sections = buildSeriesSections({
      items: sampleItems,
      mode: 'episode',
      labels: dummyLabels,
    });

    // Expected:
    // S01E01, S01E02, S02E01 (3 episodes)
    // S01 Complete (1 pack)
    // Integrale (1 complete series)
    // Special Bonus (1 unclassified)
    expect(sections).toHaveLength(6);
    expect(sections[0].id).toBe('ep-s1-e1');
    expect(sections[0].title).toBe('Saison 1 · Épisode 1');
    expect(sections[1].id).toBe('ep-s1-e2');
    expect(sections[1].title).toBe('Saison 1 · Épisode 2');
    expect(sections[2].id).toBe('ep-s2-e1');
    expect(sections[2].title).toBe('Saison 2 · Épisode 1');
    expect(sections[3].id).toBe('pack-season-1');
    expect(sections[3].title).toBe('Pack Saison 1');
    expect(sections[4].id).toBe('complete-series');
    expect(sections[5].id).toBe('unclassified');
  });

  it('handles invalid, zero and negative season/episode values', () => {
    expect(getItemSeason({ title: 't', link: 'l', seasonNumber: 0 })).toBeNull();
    expect(getItemSeason({ title: 't', link: 'l', seasonNumber: -1 })).toBeNull();
    expect(getItemSeason({ title: 't', link: 'l', seasonNumber: NaN })).toBeNull();
    expect(getItemSeason({ title: 't', link: 'l', seasonNumber: undefined })).toBeNull();
    expect(getItemEpisode({ title: 't', link: 'l', episodeNumber: 0 })).toBeNull();
    expect(getItemEpisode({ title: 't', link: 'l', episodeNumber: -5 })).toBeNull();
    expect(getItemEpisode({ title: 't', link: 'l', episodeNumber: undefined })).toBeNull();
  });

  it('handles default fallback labels when optional labels are omitted', () => {
    const singleItem: IndexerSeriesResult[] = [
      { title: 'Test.S01E02', link: 'l', seasonNumber: 1, episodeNumber: 2 },
      { title: 'Test.Complete.Series', link: 'l', seasonNumber: null, episodeNumber: null },
      { title: 'Unknown', link: 'l', seasonNumber: null, episodeNumber: null },
    ];
    const sectionsSeason = buildSeriesSections({
      items: singleItem,
      mode: 'season',
      labels: {},
    });

    expect(sectionsSeason[0].title).toBe('Saison 1');
    expect(sectionsSeason[0].badge).toBe('1 version');
    expect(sectionsSeason[1].title).toBe('Intégrale / Multi-saisons');
    expect(sectionsSeason[2].title).toBe('Autres / Non classé');

    const singleEpItem: IndexerSeriesResult[] = [
      { title: 'Standalone.E03', link: 'l', seasonNumber: null, episodeNumber: 3 },
      { title: 'Test.S02.Pack', link: 'l', seasonNumber: 2, episodeNumber: null },
    ];
    const sectionsEpisode = buildSeriesSections({
      items: singleEpItem,
      mode: 'episode',
      labels: {},
    });

    expect(sectionsEpisode[0].id).toBe('ep-single-3');
    expect(sectionsEpisode[0].title).toBe('Épisode 3');
    expect(sectionsEpisode[1].id).toBe('pack-season-2');
    expect(sectionsEpisode[1].title).toBe('Pack Saison 2');
  });

  it('returns empty array when items is empty', () => {
    const sections = buildSeriesSections({
      items: [],
      mode: 'season',
      labels: dummyLabels,
    });
    expect(sections).toEqual([]);
  });
});

