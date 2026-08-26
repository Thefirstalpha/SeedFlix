import { useState } from 'react';
import { IndexerMovieResult, IndexerSeriesResult } from '../../../common/indexer';
import { useI18n } from '../i18n/LanguageProvider';
import { SeriesGroupMode } from '../services/indexerGrouping';
import { addTorrentToClient } from '../services/torrentService';
import { IndexerResultsList } from './IndexerResultsList';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

export interface TorrentReleaseItem {
  title: string;
  link: string;
  downloadUrl?: string;
  guid?: string;
  pubDate?: string;
  size?: number | null;
  sizeBytes?: number | null;
  sizeHuman?: string | null;
  seeders?: number | null;
  leechers?: number | null;
  quality?: string | null;
  language?: string | null;
  categories?: string[];
}

export type TorrentResultsLabels = {
  quality: string;
  language: string;
  all: string;
  sort: string;
  date: string;
  size: string;
  season?: string;
  searching: string;
  empty: string;
  adding: string;
  addToClient: string;
  qualityBadge: (value: string) => string;
  languageBadge: (value: string) => string;
  sizeBadge: (value: string) => string;
  seeders: (count: number) => string;
  peers: (count: number) => string;
  categories: (value: string) => string;
  previous: string;
  current: (current: number, total: number) => string;
  page: (page: number) => string;
  next: string;
  sortByDateAria: string;
  sortBySizeAria: string;
  groupBy?: string;
  groupBySeason?: string;
  groupByEpisode?: string;
  seasonSection?: (season: number) => string;
  seasonPackSection?: string;
  seasonPackItem?: (season: number) => string;
  episodeSection?: (season: number, episode: number) => string;
  singleEpisodeSection?: (episode: number) => string;
  completeSeriesSection?: string;
  unclassifiedSection?: string;
  resultsCount?: (count: number) => string;
  packBadge?: string;
  episodeBadge?: (episode: number) => string;
};

export interface FilterOption {
  quality?: string;
  language?: string;
  season?: string;
  sortBy: 'size' | 'date';
  sortOrder: 'asc' | 'desc';
}

export type { SeriesGroupMode };

interface TorrentResultsPanelProps {
  title: string;
  description?: string;
  type: 'movie' | 'series';
  filter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  availableReleaseSeasons?: string[];
  availableReleaseLanguages: string[];
  isReleaseLoading: boolean;
  releaseError: string | null;
  filteredResults: IndexerMovieResult[] | IndexerSeriesResult[];
  locale: string;
  labels: TorrentResultsLabels;
}

const QUALITY_OPTIONS = ['2160p', '1080p', '720p', '480p', 'bluray', 'webdl', 'hdtv'];

export function TorrentResultsPanel({
  title,
  description,
  type,
  filter,
  onFilterChange,
  availableReleaseSeasons,
  availableReleaseLanguages,
  isReleaseLoading,
  releaseError,
  filteredResults,
  locale,
  labels,
}: TorrentResultsPanelProps) {
  const { t } = useI18n();
  const [addingTorrentLink, setAddingTorrentLink] = useState<string | null>(null);
  const [torrentStatus, setTorrentStatus] = useState<string | null>(null);
  const [torrentError, setTorrentError] = useState<string | null>(null);

  const handleAddTorrent = async (target: IndexerSeriesResult | IndexerMovieResult) => {
    setTorrentStatus(null);
    setTorrentError(null);
    const link = target.downloadUrl || target.link || target.guid;
    setAddingTorrentLink(link);

    try {
      const response = await addTorrentToClient(target.guid, type);
      setTorrentStatus(
        response.duplicate
          ? t('seriesDetails.messages.duplicateTorrent')
          : t('seriesDetails.messages.torrentAdded'),
      );
    } catch (error) {
      setTorrentError(
        error instanceof Error ? error.message : t('seriesDetails.errors.addTorrentFailed'),
      );
    } finally {
      setAddingTorrentLink(null);
    }
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          {description ? <p className="text-sm text-white/60 mt-1">{description}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {availableReleaseSeasons ? (
            <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
              <label className="text-sm text-white/70 whitespace-nowrap font-medium">
                {labels.season}
              </label>
              <select
                value={filter.season || 'all'}
                onChange={(event) => onFilterChange({ ...filter, season: event.target.value })}
                className="max-w-full bg-slate-900 border border-white/20 text-white rounded-md px-3 py-2 text-sm"
              >
                <option value="all">{labels.all}</option>
                {availableReleaseSeasons.map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <label className="text-sm text-white/70 font-medium whitespace-nowrap">
              {labels.quality}
            </label>
            <select
              value={filter.quality || 'all'}
              onChange={(event) => onFilterChange({ ...filter, quality: event.target.value })}
              className="max-w-full bg-slate-900 border border-white/20 text-white rounded-md px-3 py-2 text-sm"
            >
              <option value="all">{labels.all}</option>
              {QUALITY_OPTIONS.map((quality) => (
                <option key={quality} value={quality}>
                  {quality === 'bluray'
                    ? 'BluRay'
                    : quality === 'webdl'
                      ? 'WEB-DL'
                      : quality.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <label className="text-sm text-white/70 font-medium whitespace-nowrap">
              {labels.language}
            </label>
            <select
              value={filter.language || 'all'}
              onChange={(event) => onFilterChange({ ...filter, language: event.target.value })}
              className="max-w-full bg-slate-900 border border-white/20 text-white rounded-md px-3 py-2 text-sm"
            >
              <option value="all">{labels.all}</option>
              {availableReleaseLanguages.map((itemLanguage) => (
                <option key={itemLanguage} value={itemLanguage}>
                  {itemLanguage}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <span className="text-sm text-white/70 font-medium">{labels.sort}</span>
            <ToggleGroup
              type="single"
              value={filter.sortBy}
              onValueChange={(value) => {
                if (value) {
                  onFilterChange({ ...filter, sortBy: value as 'size' | 'date' });
                }
              }}
              className="border border-white/20 rounded-md bg-slate-900/30"
            >
              <ToggleGroupItem
                value="date"
                aria-label={labels.sortByDateAria}
                className="text-sm data-[state=on]:bg-cyan-600 data-[state=on]:text-white hover:bg-white/10 data-[state=off]:text-white/60 data-[state=off]:hover:text-white/80"
              >
                {labels.date}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="size"
                aria-label={labels.sortBySizeAria}
                className="text-sm data-[state=on]:bg-cyan-600 data-[state=on]:text-white hover:bg-white/10 data-[state=off]:text-white/60 data-[state=off]:hover:text-white/80"
              >
                {labels.size}
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              size="sm"
              onClick={() =>
                onFilterChange({
                  ...filter,
                  sortOrder: filter.sortOrder === 'desc' ? 'asc' : 'desc',
                })
              }
              className="h-9 px-3 border border-white/20 text-white/80 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all"
            >
              {filter.sortOrder === 'desc' ? '↓' : '↑'}
            </Button>
          </div>
        </div>

        {isReleaseLoading ? <p className="text-sm text-white/60">{labels.searching}</p> : null}
        {releaseError ? <p className="text-sm text-red-300">{releaseError}</p> : null}
        {torrentStatus && !releaseError ? (
          <p className="text-sm text-emerald-300">{torrentStatus}</p>
        ) : null}
        {torrentError ? <p className="text-sm text-red-300">{torrentError}</p> : null}

        {!isReleaseLoading && !releaseError && filteredResults.length === 0 ? (
          <p className="text-sm text-white/60">{labels.empty}</p>
        ) : null}

        {!isReleaseLoading && !releaseError && filteredResults.length > 0 ? (
          <IndexerResultsList
            items={filteredResults}
            type={type}
            locale={locale}
            addingTorrentLink={addingTorrentLink}
            onAddTorrent={handleAddTorrent}
            showPagination={type === 'movie'}
            labels={labels}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
