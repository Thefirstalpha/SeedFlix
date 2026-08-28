import {
  ChevronDown,
  ChevronRight,
  FolderArchive,
  Layers,
  Loader2,
  Trash2,
  Tv,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { IndexerMovieResult, IndexerSeriesResult } from '../../../common/indexer';
import { useI18n } from '../i18n/LanguageProvider';
import {
  buildSeriesSections,
  SeriesGroupMode,
  SeriesSectionGroup,
} from '../services/indexerGrouping';
import { IndexerReleaseItem } from './IndexerReleaseItem';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

export interface IndexerResultsLabels {
  addToClient?: string;
  adding?: string;
  reject?: string;
  rejecting?: string;
  rejectAll?: string;
  rejectingAll?: string;
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
  previous?: string;
  next?: string;
  current?: (current: number, total: number) => string;
  page?: (page: number) => string;
  [key: string]: unknown;
}

export interface IndexerResultsListProps {
  items: (IndexerMovieResult | IndexerSeriesResult)[];
  type: 'movie' | 'series';
  locale?: string;
  actionKey?: string | null;
  addingTorrentLink?: string | null;
  onAddTorrent: (item: IndexerMovieResult | IndexerSeriesResult) => void;
  onRejectIndexerResult?: (item: IndexerMovieResult | IndexerSeriesResult) => void;
  onRejectAllIndexerResults?: (items: (IndexerMovieResult | IndexerSeriesResult)[]) => void;
  labels?: IndexerResultsLabels;
  showRejectAll?: boolean;
  showPagination?: boolean;
  itemsPerPage?: number;
  hideGroupModeToggle?: boolean;
}

export function IndexerResultsList({
  items,
  type,
  locale,
  actionKey,
  addingTorrentLink,
  onAddTorrent,
  onRejectIndexerResult,
  onRejectAllIndexerResults,
  labels,
  showRejectAll = false,
  showPagination = false,
  itemsPerPage = 10,
  hideGroupModeToggle = false,
}: Readonly<IndexerResultsListProps>) {
  const { t, language } = useI18n();
  const effectiveLocale = locale || (language === 'fr' ? 'fr-FR' : 'en-US');

  const [seriesGroupMode, setSeriesGroupMode] = useState<SeriesGroupMode>('season');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [items]);

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? true),
    }));
  };

  const groupKey = items[0]?.tmdbId ?? type;
  const rejectAllKey = `${groupKey}:reject-all`;
  const isRejectingAll = actionKey === rejectAllKey;

  const defaultGroupingLabels = useMemo(
    () => ({
      seasonSection:
        labels?.seasonSection ||
        ((season: number) => t('seriesDetails.indexer.seasonSection', { season })),
      seasonPackSection:
        labels?.seasonPackSection || t('seriesDetails.indexer.seasonPackSection'),
      seasonPackItem:
        labels?.seasonPackItem ||
        ((season: number) => t('seriesDetails.indexer.seasonPackItem', { season })),
      episodeSection:
        labels?.episodeSection ||
        ((season: number, episode: number) =>
          t('seriesDetails.indexer.episodeSection', { season, episode })),
      singleEpisodeSection:
        labels?.singleEpisodeSection ||
        ((episode: number) => t('seriesDetails.indexer.singleEpisodeSection', { episode })),
      completeSeriesSection:
        labels?.completeSeriesSection || t('seriesDetails.indexer.completeSeriesSection'),
      unclassifiedSection:
        labels?.unclassifiedSection || t('seriesDetails.indexer.unclassifiedSection'),
      resultsCount:
        labels?.resultsCount ||
        ((count: number) =>
          count > 1
            ? t('seriesDetails.indexer.resultsCountPlural', { count })
            : t('seriesDetails.indexer.resultsCount', { count })),
    }),
    [labels, t],
  );

  const seriesSections = useMemo((): SeriesSectionGroup[] => {
    if (type !== 'series') return [];
    return buildSeriesSections({
      items: items as IndexerSeriesResult[],
      mode: seriesGroupMode,
      labels: defaultGroupingLabels,
    });
  }, [type, items, seriesGroupMode, defaultGroupingLabels]);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginatedItems = showPagination
    ? items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : items;

  const itemLabels = useMemo(
    () => ({
      addToClient: labels?.addToClient || t('seriesDetails.indexer.addToClient'),
      adding: labels?.adding || t('seriesDetails.indexer.adding'),
      reject: labels?.reject || t('wishlistPage.indexerResults.actions.reject'),
      rejecting: labels?.rejecting || t('wishlistPage.indexerResults.actions.rejectingAll'),
      packBadge: labels?.packBadge || t('seriesDetails.indexer.packBadge'),
      episodeBadge: labels?.episodeBadge,
    }),
    [labels, t],
  );

  const renderItem = (item: IndexerMovieResult | IndexerSeriesResult, index: number) => {
    const itemKey = item.guid || item.link || `${item.title}_${index}`;
    const addKey = `${itemKey}:add`;
    const rejectKey = `${itemKey}:reject`;
    const link = item.downloadUrl || item.link || item.guid;

    const isAdding = actionKey ? actionKey === addKey : addingTorrentLink === link;
    const isRejecting = actionKey ? actionKey === rejectKey : false;

    return (
      <IndexerReleaseItem
        key={itemKey}
        item={item}
        type={type}
        locale={effectiveLocale}
        isAdding={isAdding}
        isRejecting={isRejecting}
        onAddTorrent={onAddTorrent}
        onReject={onRejectIndexerResult}
        labels={itemLabels}
      />
    );
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 w-full min-w-0">
      {/* Header bar with count badge, group toggle, and optional Reject All button */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap min-w-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Badge variant="outline" className="border-cyan-500/40 text-cyan-200 bg-cyan-950/30 text-xs px-2 py-0.5 shrink-0">
            {items.length} {items.length > 1 ? t('wishlistPage.indexerResults.title') : '1 résultat'}
          </Badge>

          {type === 'series' && !hideGroupModeToggle && (
            <ToggleGroup
              type="single"
              value={seriesGroupMode}
              onValueChange={(val) => {
                if (val === 'season' || val === 'episode') {
                  setSeriesGroupMode(val);
                }
              }}
              className="border border-white/20 rounded-md bg-slate-900/40 shrink-0"
            >
              <ToggleGroupItem
                value="season"
                className="text-xs px-2 py-1 data-[state=on]:bg-cyan-600 data-[state=on]:text-white hover:bg-white/10 data-[state=off]:text-white/60 data-[state=off]:hover:text-white/80"
              >
                <Layers className="w-3 h-3 mr-1 inline shrink-0" />
                <span className="hidden sm:inline">
                  {labels?.groupBySeason || t('seriesDetails.indexer.groupBySeason')}
                </span>
                <span className="sm:hidden">Saisons</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="episode"
                className="text-xs px-2 py-1 data-[state=on]:bg-cyan-600 data-[state=on]:text-white hover:bg-white/10 data-[state=off]:text-white/60 data-[state=off]:hover:text-white/80"
              >
                <Tv className="w-3 h-3 mr-1 inline shrink-0" />
                <span className="hidden sm:inline">
                  {labels?.groupByEpisode || t('seriesDetails.indexer.groupByEpisode')}
                </span>
                <span className="sm:hidden">Épisodes</span>
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>

        {showRejectAll && onRejectAllIndexerResults && (
          <Button
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              onRejectAllIndexerResults(items);
            }}
            disabled={isRejectingAll}
            className="h-8 px-2 sm:px-3 border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100 text-xs shrink-0"
          >
            {isRejectingAll ? (
              <>
                <Loader2 className="w-3.5 h-3.5 sm:mr-1.5 animate-spin" />
                <span className="hidden sm:inline">
                  {labels?.rejectingAll || t('wishlistPage.indexerResults.actions.rejectingAll')}
                </span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">
                  {labels?.rejectAll || t('wishlistPage.indexerResults.actions.rejectAll')}
                </span>
              </>
            )}
          </Button>
        )}
      </div>

      {/* Series Sectioned Display */}
      {type === 'series' ? (
        <div className="space-y-2 pt-1 w-full min-w-0">
          {seriesSections.map((section) => {
            const isCollapsed = Boolean(collapsedSections[section.id] ?? true);
            return (
              <div
                key={section.id}
                className="rounded-lg border border-white/15 bg-white/[0.02] overflow-hidden transition-all w-full min-w-0"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSectionCollapse(section.id);
                  }}
                  className="w-full flex items-center justify-between p-2 sm:p-2.5 px-3 bg-white/5 hover:bg-white/10 text-left transition-colors cursor-pointer select-none min-w-0 gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
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
                    <span className="text-xs sm:text-sm font-semibold text-white truncate min-w-0 flex-1">
                      {section.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {section.badge && (
                      <Badge
                        variant="outline"
                        className="border-white/20 text-white/80 text-[11px] px-1.5 py-0.5"
                      >
                        {section.badge}
                      </Badge>
                    )}
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-white/60 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-white/60 shrink-0" />
                    )}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="p-2 sm:p-2.5 space-y-1.5 border-t border-white/10 bg-slate-950/20 w-full min-w-0">
                    {section.items.map((item, idx) => renderItem(item, idx))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Movie List / Paginated Display */
        <div className="space-y-2 pt-1 w-full min-w-0">
          <div className="space-y-1.5 w-full min-w-0">
            {paginatedItems.map((item, idx) => renderItem(item, idx))}
          </div>

          {showPagination && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 text-xs"
              >
                {labels?.previous || t('movieDetails.pagination.previous')}
              </Button>

              <span className="text-xs text-white/80">
                {labels?.current
                  ? labels.current(currentPage, totalPages)
                  : `Page ${currentPage} / ${totalPages}`}
              </span>

              <select
                value={currentPage}
                onChange={(event) => setCurrentPage(Number(event.target.value))}
                className="bg-slate-900 border border-white/20 text-white rounded-md px-2 py-1 text-xs"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <option key={page} value={page}>
                    {labels?.page ? labels.page(page) : `Page ${page}`}
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="h-8 text-xs"
              >
                {labels?.next || t('movieDetails.pagination.next')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
