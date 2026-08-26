import type { TorrentResultsLabels } from '../components/TorrentResultsPanel';
import type { Translator } from '../i18n/LanguageProvider';


type BuildOptions = {
  sectionKey: 'movieDetails' | 'seriesDetails';
  includeSeason?: boolean;
};

export function buildTorrentResultsLabels(
  t: Translator,
  options: BuildOptions,
): TorrentResultsLabels {
  const baseIndexerKey = `${options.sectionKey}.indexer`;
  const basePaginationKey = `${options.sectionKey}.pagination`;

  return {
    ...(options.includeSeason ? { season: t(`${options.sectionKey}.season`) } : {}),
    quality: t(`${baseIndexerKey}.quality`),
    language: t(`${baseIndexerKey}.language`),
    all: t(`${baseIndexerKey}.all`),
    sort: t(`${baseIndexerKey}.sort`),
    date: t(`${baseIndexerKey}.date`),
    size: t(`${baseIndexerKey}.size`),
    searching: t(`${baseIndexerKey}.searching`),
    empty: t(`${baseIndexerKey}.empty`),
    adding: t(`${baseIndexerKey}.adding`),
    addToClient: t(`${baseIndexerKey}.addToClient`),
    qualityBadge: (value) => t(`${baseIndexerKey}.qualityBadge`, { value }),
    languageBadge: (value) => t(`${baseIndexerKey}.languageBadge`, { value }),
    sizeBadge: (value) => t(`${baseIndexerKey}.sizeBadge`, { value }),
    seeders: (count) => t(`${baseIndexerKey}.seeders`, { count }),
    peers: (count) => t(`${baseIndexerKey}.peers`, { count }),
    categories: (value) => t(`${baseIndexerKey}.categories`, { value }),
    previous: t(`${basePaginationKey}.previous`),
    current: (current, total) => t(`${basePaginationKey}.current`, { current, total }),
    page: (page) => t(`${basePaginationKey}.page`, { page }),
    next: t(`${basePaginationKey}.next`),
    sortByDateAria: 'Sort by date',
    sortBySizeAria: 'Sort by size',
    groupBy: t(`${baseIndexerKey}.groupBy`),
    groupBySeason: t(`${baseIndexerKey}.groupBySeason`),
    groupByEpisode: t(`${baseIndexerKey}.groupByEpisode`),
    seasonSection: (season: number) => t(`${baseIndexerKey}.seasonSection`, { season }),
    seasonPackSection: t(`${baseIndexerKey}.seasonPackSection`),
    seasonPackItem: (season: number) => t(`${baseIndexerKey}.seasonPackItem`, { season }),
    episodeSection: (season: number, episode: number) =>
      t(`${baseIndexerKey}.episodeSection`, { season, episode }),
    singleEpisodeSection: (episode: number) =>
      t(`${baseIndexerKey}.singleEpisodeSection`, { episode }),
    completeSeriesSection: t(`${baseIndexerKey}.completeSeriesSection`),
    unclassifiedSection: t(`${baseIndexerKey}.unclassifiedSection`),
    resultsCount: (count: number) =>
      count > 1
        ? t(`${baseIndexerKey}.resultsCountPlural`, { count })
        : t(`${baseIndexerKey}.resultsCount`, { count }),
    packBadge: t(`${baseIndexerKey}.packBadge`),
    episodeBadge: (episode: number) => t(`${baseIndexerKey}.episodeBadge`, { episode }),
  };
}
