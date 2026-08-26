import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FolderArchive,
  Layers,
  Loader2,
  Tv,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { IndexerMovieResult, IndexerSeriesResult } from '../../../common/indexer';
import { useI18n } from '../i18n/LanguageProvider';
import { addTorrentToClient } from '../services/torrentService';
import { Badge } from './ui/badge';
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

import {
  buildSeriesSections,
  getItemEpisode,
  getItemSeason,
  SeriesGroupMode,
  SeriesSectionGroup,
} from '../services/indexerGrouping';

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

  // Grouping mode for series
  const [seriesGroupMode, setSeriesGroupMode] = useState<SeriesGroupMode>('season');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Pagination for movie view
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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

  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const paginatedMovieResults = filteredResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Build sections for series
  const seriesSections = useMemo((): SeriesSectionGroup[] => {
    if (type !== 'series') return [];
    return buildSeriesSections({
      items: filteredResults as IndexerSeriesResult[],
      mode: seriesGroupMode,
      labels,
    });
  }, [type, filteredResults, seriesGroupMode, labels]);

  const renderReleaseItem = (item: IndexerMovieResult | IndexerSeriesResult, index: number) => {
    const torrentLink = item.downloadUrl || item.link;
    const seriesItem = type === 'series' ? (item as IndexerSeriesResult) : null;
    const itemSeason = seriesItem ? getItemSeason(seriesItem) : null;
    const itemEpisode = seriesItem ? getItemEpisode(seriesItem) : null;
    const isPack = seriesItem && itemSeason !== null && itemEpisode === null;

    return (
      <div
        key={item.guid || item.link || `${item.title}_${index}`}
        className="rounded-lg border border-white/10 bg-slate-900/40 p-2.5 sm:p-3 hover:bg-slate-900/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="shrink-0 self-start sm:self-center">
          <Button
            size="sm"
            onClick={async () => await handleAddTorrent(item)}
            disabled={addingTorrentLink === torrentLink}
            className="bg-cyan-600 hover:bg-cyan-700 text-white whitespace-nowrap"
          >
            {addingTorrentLink === torrentLink ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                {labels.adding}
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {labels.addToClient}
              </>
            )}
          </Button>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p
            className="text-white font-medium line-clamp-2 overflow-hidden leading-snug text-sm"
            title={item.title}
          >
            {item.title}
          </p>

          <div className="flex flex-wrap gap-1.5 items-center">
            {/* Series Specific Pack or Episode Tag */}
            {isPack && (
              <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/40 text-[11px] px-2 py-0.5">
                <FolderArchive className="w-3 h-3 mr-1 inline" />
                {labels.packBadge || 'Pack saison'}
              </Badge>
            )}
            {itemEpisode !== null && (
              <Badge className="bg-cyan-600/20 text-cyan-200 border-cyan-500/40 text-[11px] px-2 py-0.5">
                <Tv className="w-3 h-3 mr-1 inline" />
                {itemSeason !== null
                  ? `S${String(itemSeason).padStart(2, '0')}E${String(itemEpisode).padStart(2, '0')}`
                  : labels.episodeBadge
                    ? labels.episodeBadge(itemEpisode)
                    : `Épisode ${itemEpisode}`}
              </Badge>
            )}

            {item.quality ? (
              <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 text-[11px] px-2 py-0.5">
                {labels.qualityBadge(item.quality)}
              </Badge>
            ) : null}

            {item.language ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[11px] px-2 py-0.5">
                {labels.languageBadge(item.language)}
              </Badge>
            ) : null}

            {item.sizeHuman ? (
              <Badge variant="outline" className="border-white/30 text-white/80 text-[11px] px-2 py-0.5">
                {labels.sizeBadge(item.sizeHuman)}
              </Badge>
            ) : null}

            {item.pubDate ? (
              <Badge variant="outline" className="border-blue-500/40 text-blue-300 text-[11px] px-2 py-0.5">
                <Calendar className="w-3 h-3 mr-1 inline" />
                {new Date(item.pubDate).toLocaleDateString(locale)}
              </Badge>
            ) : null}

            {Number.isFinite(item.seeders || Number.NaN) && (item.seeders || 0) >= 0 ? (
              <Badge variant="outline" className="border-lime-500/40 text-lime-300 text-[11px] px-2 py-0.5">
                {labels.seeders(item.seeders || 0)}
              </Badge>
            ) : null}

            {Number.isFinite(item.leechers || Number.NaN) && (item.leechers || 0) >= 0 ? (
              <Badge variant="outline" className="border-orange-500/40 text-orange-300 text-[11px] px-2 py-0.5">
                {labels.peers(item.leechers || 0)}
              </Badge>
            ) : null}
          </div>
        </div>

        
      </div>
    );
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xl font-semibold text-white">{title}</h3>
            {description ? <p className="text-sm text-white/60 mt-1">{description}</p> : null}
          </div>

          {/* Group mode selector for series */}
          {type === 'series' && filteredResults.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-white/70 font-medium">
                {labels.groupBy || 'Affichage :'}
              </span>
              <ToggleGroup
                type="single"
                value={seriesGroupMode}
                onValueChange={(val) => {
                  if (val === 'season' || val === 'episode') {
                    setSeriesGroupMode(val);
                  }
                }}
                className="border border-white/20 rounded-md bg-slate-900/40"
              >
                <ToggleGroupItem
                  value="season"
                  className="text-xs sm:text-sm px-3 py-1.5 data-[state=on]:bg-cyan-600 data-[state=on]:text-white hover:bg-white/10 data-[state=off]:text-white/60 data-[state=off]:hover:text-white/80"
                >
                  <Layers className="w-3.5 h-3.5 mr-1.5 inline" />
                  {labels.groupBySeason || 'Par saison'}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="episode"
                  className="text-xs sm:text-sm px-3 py-1.5 data-[state=on]:bg-cyan-600 data-[state=on]:text-white hover:bg-white/10 data-[state=off]:text-white/60 data-[state=off]:hover:text-white/80"
                >
                  <Tv className="w-3.5 h-3.5 mr-1.5 inline" />
                  {labels.groupByEpisode || 'Par épisode'}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
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

        {/* Series Sectioned Display */}
        {type === 'series' && seriesSections.length > 0 ? (
          <div className="space-y-4 pt-2">
            {seriesSections.map((section) => {
              const isCollapsed = Boolean(collapsedSections[section.id]);
              return (
                <div
                  key={section.id}
                  className="rounded-lg border border-white/15 bg-white/[0.03] overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => toggleSectionCollapse(section.id)}
                    className="w-full flex items-center justify-between p-2.5 sm:p-3 bg-white/5 hover:bg-white/10 text-left transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {section.iconType === 'season' && (
                        <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                      )}
                      {section.iconType === 'episode' && (
                        <Tv className="w-4 h-4 text-cyan-300 shrink-0" />
                      )}
                      {section.iconType === 'pack' && (
                        <FolderArchive className="w-4 h-4 text-purple-400 shrink-0" />
                      )}
                      {section.iconType === 'complete' && (
                        <FolderArchive className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {section.iconType === 'other' && (
                        <Tv className="w-4 h-4 text-white/60 shrink-0" />
                      )}
                      <span className="text-sm font-semibold text-white truncate">
                        {section.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {section.badge && (
                        <Badge
                          variant="outline"
                          className="border-white/20 text-white/80 text-[11px] px-2 py-0.5"
                        >
                          {section.badge}
                        </Badge>
                      )}
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-white/60" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-white/60" />
                      )}
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="p-2.5 sm:p-3 space-y-2 border-t border-white/10 bg-slate-950/20">
                      {section.items.map((item, idx) => renderReleaseItem(item, idx))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Movie Flat Paginated Display */}
        {type === 'movie' && filteredResults.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-3">
              {paginatedMovieResults.map((item, index) => renderReleaseItem(item, index))}
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
              >
                {labels.previous}
              </Button>

              <span className="text-sm text-white/80">
                {labels.current(currentPage, totalPages)}
              </span>

              <select
                value={currentPage}
                onChange={(event) => setCurrentPage(Number(event.target.value))}
                className="bg-slate-900 border border-white/20 text-white rounded-md px-2 py-1 text-sm"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <option key={page} value={page}>
                    {labels.page(page)}
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                {labels.next}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
