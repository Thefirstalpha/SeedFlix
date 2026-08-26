import { IndexerSeriesResult } from '../../../common/indexer';

export type SeriesGroupMode = 'season' | 'episode';

export interface SeriesSectionGroup {
  id: string;
  title: string;
  iconType: 'season' | 'episode' | 'pack' | 'complete' | 'other';
  badge?: string;
  items: IndexerSeriesResult[];
}

export function getItemSeason(item: IndexerSeriesResult): number | null {
  if (
    item.seasonNumber !== undefined &&
    item.seasonNumber !== null &&
    Number.isFinite(item.seasonNumber) &&
    item.seasonNumber > 0
  ) {
    return item.seasonNumber;
function parsePositiveNumber(value: number | null | undefined): number | null {
  if (value !== undefined && value !== null && Number.isFinite(value) && value > 0) {
    return value;
  }
  return null;
}

export function getItemSeason(item: IndexerSeriesResult): number | null {
  return parsePositiveNumber(item.seasonNumber);
}

export function getItemEpisode(item: IndexerSeriesResult): number | null {
  if (
    item.episodeNumber !== undefined &&
    item.episodeNumber !== null &&
    Number.isFinite(item.episodeNumber) &&
    item.episodeNumber > 0
  ) {
    return item.episodeNumber;
  }
  return null;
  return parsePositiveNumber(item.episodeNumber);
}

export function isCompleteSeriesPack(title: string): boolean {
  const norm = String(title || '').toLowerCase();
  return (
    norm.includes('integrale') ||
    norm.includes('intégrale') ||
    norm.includes('complete series') ||
    norm.includes('complete.series') ||
    /s\d{1,2}[\s._-]*to[\s._-]*s\d{1,2}/i.test(norm) ||
    /s\d{1,2}[\s._-]*-[._-]*s\d{1,2}/i.test(norm) ||
    /seasons?\s*\d+\s*-\s*\d+/i.test(norm)
  );
}

export interface GroupLabels {
  seasonSection?: (season: number) => string;
  seasonPackSection?: string;
  seasonPackItem?: (season: number) => string;
  episodeSection?: (season: number, episode: number) => string;
  singleEpisodeSection?: (episode: number) => string;
  completeSeriesSection?: string;
  unclassifiedSection?: string;
  resultsCount?: (count: number) => string;
}

export function buildSeriesSections({
  items,
  mode,
  labels,
}: {
interface EpisodeGroup {
  season: number | null;
  episode: number;
  items: IndexerSeriesResult[];
  mode: SeriesGroupMode;
  labels: GroupLabels;
}): SeriesSectionGroup[] {
  if (items.length === 0) return [];
}

  const formatCount = (count: number) =>
    labels.resultsCount ? labels.resultsCount(count) : `${count} version${count > 1 ? 's' : ''}`;
function createSectionGroup(
  id: string,
  title: string,
  iconType: SeriesSectionGroup['iconType'],
  items: IndexerSeriesResult[],
  formatCount: (count: number) => string,
): SeriesSectionGroup {
  return {
    id,
    title,
    iconType,
    badge: formatCount(items.length),
    items,
  };
}

  if (mode === 'season') {
    const seasonsMap = new Map<number, IndexerSeriesResult[]>();
    const completeSeriesItems: IndexerSeriesResult[] = [];
    const unclassifiedItems: IndexerSeriesResult[] = [];
function classifyFallbackItem(
  item: IndexerSeriesResult,
  completeSeriesItems: IndexerSeriesResult[],
  unclassifiedItems: IndexerSeriesResult[],
): void {
  if (isCompleteSeriesPack(item.title)) {
    completeSeriesItems.push(item);
  } else {
    unclassifiedItems.push(item);
  }
}

    for (const item of items) {
      const s = getItemSeason(item);
      if (s !== null) {
        if (!seasonsMap.has(s)) seasonsMap.set(s, []);
        seasonsMap.get(s)!.push(item);
      } else if (isCompleteSeriesPack(item.title)) {
        completeSeriesItems.push(item);
      } else {
        unclassifiedItems.push(item);
      }
    }
function getTrailingSections(
  completeSeriesItems: IndexerSeriesResult[],
  unclassifiedItems: IndexerSeriesResult[],
  labels: GroupLabels,
  formatCount: (count: number) => string,
): SeriesSectionGroup[] {
  const sections: SeriesSectionGroup[] = [];

    const sections: SeriesSectionGroup[] = [];
    const sortedSeasons = Array.from(seasonsMap.keys()).sort((a, b) => a - b);
    for (const s of sortedSeasons) {
      const seasonItems = seasonsMap.get(s)!;
      const seasonTitle = labels.seasonSection ? labels.seasonSection(s) : `Saison ${s}`;
      sections.push({
        id: `season-${s}`,
        title: seasonTitle,
        iconType: 'season',
        badge: formatCount(seasonItems.length),
        items: seasonItems,
      });
    }
  if (completeSeriesItems.length > 0) {
    sections.push(
      createSectionGroup(
        'complete-series',
        labels.completeSeriesSection || 'Intégrale / Multi-saisons',
        'complete',
        completeSeriesItems,
        formatCount,
      ),
    );
  }

    if (completeSeriesItems.length > 0) {
      sections.push({
        id: 'complete-series',
        title: labels.completeSeriesSection || 'Intégrale / Multi-saisons',
        iconType: 'complete',
        badge: formatCount(completeSeriesItems.length),
        items: completeSeriesItems,
      });
    }
  if (unclassifiedItems.length > 0) {
    sections.push(
      createSectionGroup(
        'unclassified',
        labels.unclassifiedSection || 'Autres / Non classé',
        'other',
        unclassifiedItems,
        formatCount,
      ),
    );
  }

    if (unclassifiedItems.length > 0) {
      sections.push({
        id: 'unclassified',
        title: labels.unclassifiedSection || 'Autres / Non classé',
        iconType: 'other',
        badge: formatCount(unclassifiedItems.length),
        items: unclassifiedItems,
      });
  return sections;
}

function buildSeasonModeSections(
  items: IndexerSeriesResult[],
  labels: GroupLabels,
  formatCount: (count: number) => string,
): SeriesSectionGroup[] {
  const seasonsMap = new Map<number, IndexerSeriesResult[]>();
  const completeSeriesItems: IndexerSeriesResult[] = [];
  const unclassifiedItems: IndexerSeriesResult[] = [];

  for (const item of items) {
    const s = getItemSeason(item);
    if (s !== null) {
      const list = seasonsMap.get(s) ?? [];
      list.push(item);
      seasonsMap.set(s, list);
    } else {
      classifyFallbackItem(item, completeSeriesItems, unclassifiedItems);
    }
  }

    return sections;
  } else {
    // Mode 'episode'
    const episodesMap = new Map<
      string,
      { season: number | null; episode: number; items: IndexerSeriesResult[] }
    >();
    const seasonPacksMap = new Map<number, IndexerSeriesResult[]>();
    const completeSeriesItems: IndexerSeriesResult[] = [];
    const unclassifiedItems: IndexerSeriesResult[] = [];
  const sections: SeriesSectionGroup[] = [];
  const sortedSeasons = Array.from(seasonsMap.keys()).sort((a, b) => a - b);
  for (const s of sortedSeasons) {
    const seasonItems = seasonsMap.get(s)!;
    const seasonTitle = labels.seasonSection ? labels.seasonSection(s) : `Saison ${s}`;
    sections.push(createSectionGroup(`season-${s}`, seasonTitle, 'season', seasonItems, formatCount));
  }

    for (const item of items) {
      const s = getItemSeason(item);
      const e = getItemEpisode(item);
  sections.push(...getTrailingSections(completeSeriesItems, unclassifiedItems, labels, formatCount));
  return sections;
}

      if (e !== null) {
        const key = s !== null ? `s${s}_e${e}` : `single_e${e}`;
        if (!episodesMap.has(key)) {
          episodesMap.set(key, { season: s, episode: e, items: [] });
        }
        episodesMap.get(key)!.items.push(item);
      } else if (s !== null) {
        if (!seasonPacksMap.has(s)) seasonPacksMap.set(s, []);
        seasonPacksMap.get(s)!.push(item);
      } else if (isCompleteSeriesPack(item.title)) {
        completeSeriesItems.push(item);
      } else {
        unclassifiedItems.push(item);
function getEpisodeTitle(ep: EpisodeGroup, labels: GroupLabels): string {
  if (ep.season !== null) {
    return labels.episodeSection
      ? labels.episodeSection(ep.season, ep.episode)
      : `Saison ${ep.season} · Épisode ${ep.episode}`;
  }
  return labels.singleEpisodeSection
    ? labels.singleEpisodeSection(ep.episode)
    : `Épisode ${ep.episode}`;
}

function buildEpisodeModeSections(
  items: IndexerSeriesResult[],
  labels: GroupLabels,
  formatCount: (count: number) => string,
): SeriesSectionGroup[] {
  const episodesMap = new Map<string, EpisodeGroup>();
  const seasonPacksMap = new Map<number, IndexerSeriesResult[]>();
  const completeSeriesItems: IndexerSeriesResult[] = [];
  const unclassifiedItems: IndexerSeriesResult[] = [];

  for (const item of items) {
    const s = getItemSeason(item);
    const e = getItemEpisode(item);

    if (e !== null) {
      const key = s !== null ? `s${s}_e${e}` : `single_e${e}`;
      let epGroup = episodesMap.get(key);
      if (!epGroup) {
        epGroup = { season: s, episode: e, items: [] };
        episodesMap.set(key, epGroup);
      }
      epGroup.items.push(item);
    } else if (s !== null) {
      const list = seasonPacksMap.get(s) ?? [];
      list.push(item);
      seasonPacksMap.set(s, list);
    } else {
      classifyFallbackItem(item, completeSeriesItems, unclassifiedItems);
    }
  }

    const sections: SeriesSectionGroup[] = [];
    const sortedEpisodes = Array.from(episodesMap.values()).sort((a, b) => {
      const sA = a.season ?? 0;
      const sB = b.season ?? 0;
      if (sA !== sB) return sA - sB;
      return a.episode - b.episode;
    });
  const sections: SeriesSectionGroup[] = [];
  const sortedEpisodes = Array.from(episodesMap.values()).sort((a, b) => {
    const sA = a.season ?? 0;
    const sB = b.season ?? 0;
    if (sA !== sB) return sA - sB;
    return a.episode - b.episode;
  });

    for (const ep of sortedEpisodes) {
      const epTitle =
        ep.season !== null
          ? labels.episodeSection
            ? labels.episodeSection(ep.season, ep.episode)
            : `Saison ${ep.season} · Épisode ${ep.episode}`
          : labels.singleEpisodeSection
            ? labels.singleEpisodeSection(ep.episode)
            : `Épisode ${ep.episode}`;
  for (const ep of sortedEpisodes) {
    const id = ep.season !== null ? `ep-s${ep.season}-e${ep.episode}` : `ep-single-${ep.episode}`;
    sections.push(createSectionGroup(id, getEpisodeTitle(ep, labels), 'episode', ep.items, formatCount));
  }

      sections.push({
        id: ep.season !== null ? `ep-s${ep.season}-e${ep.episode}` : `ep-single-${ep.episode}`,
        title: epTitle,
        iconType: 'episode',
        badge: formatCount(ep.items.length),
        items: ep.items,
      });
    }
  const sortedSeasonPacks = Array.from(seasonPacksMap.keys()).sort((a, b) => a - b);
  for (const s of sortedSeasonPacks) {
    const packItems = seasonPacksMap.get(s)!;
    const packTitle = labels.seasonPackItem ? labels.seasonPackItem(s) : `Pack Saison ${s}`;
    sections.push(createSectionGroup(`pack-season-${s}`, packTitle, 'pack', packItems, formatCount));
  }

    const sortedSeasonPacks = Array.from(seasonPacksMap.keys()).sort((a, b) => a - b);
    for (const s of sortedSeasonPacks) {
      const packItems = seasonPacksMap.get(s)!;
      const packTitle = labels.seasonPackItem ? labels.seasonPackItem(s) : `Pack Saison ${s}`;
      sections.push({
        id: `pack-season-${s}`,
        title: packTitle,
        iconType: 'pack',
        badge: formatCount(packItems.length),
        items: packItems,
      });
    }
  sections.push(...getTrailingSections(completeSeriesItems, unclassifiedItems, labels, formatCount));
  return sections;
}

    if (completeSeriesItems.length > 0) {
      sections.push({
        id: 'complete-series',
        title: labels.completeSeriesSection || 'Intégrale / Multi-saisons',
        iconType: 'complete',
        badge: formatCount(completeSeriesItems.length),
        items: completeSeriesItems,
      });
    }
export function buildSeriesSections({
  items,
  mode,
  labels,
}: {
  items: IndexerSeriesResult[];
  mode: SeriesGroupMode;
  labels: GroupLabels;
}): SeriesSectionGroup[] {
  if (items.length === 0) return [];

    if (unclassifiedItems.length > 0) {
      sections.push({
        id: 'unclassified',
        title: labels.unclassifiedSection || 'Autres / Non classé',
        iconType: 'other',
        badge: formatCount(unclassifiedItems.length),
        items: unclassifiedItems,
      });
    }
  const formatCount = (count: number) =>
    labels.resultsCount ? labels.resultsCount(count) : `${count} version${count > 1 ? 's' : ''}`;

    return sections;
  }
  return mode === 'season'
    ? buildSeasonModeSections(items, labels, formatCount)
    : buildEpisodeModeSections(items, labels, formatCount);
}

