import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FolderArchive,
  Layers,
  Loader2,
  Star,
  Tv,
} from 'lucide-react';
import { ReactNode, useMemo, useState } from 'react';
import { IndexerMovieResult, IndexerSeriesResult } from '../../../common/indexer';
import { useI18n } from '../i18n/LanguageProvider';
import {
  buildSeriesSections,
  getItemEpisode,
  getItemSeason,
  SeriesGroupMode,
  SeriesSectionGroup,
} from '../services/indexerGrouping';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

interface WishListCardProps {
  poster: string;
  title: string;
  year: number;
  rating: number;
  genre: string;
  type: 'movie' | 'series';
  targets: (IndexerMovieResult | IndexerSeriesResult)[];
  actionKey: string | null;
  onRejectIndexerResult: (target: IndexerMovieResult | IndexerSeriesResult) => void;
  onRejectAllIndexerResults: (targets: (IndexerMovieResult | IndexerSeriesResult)[]) => void;
  onAddTorrent: (target: IndexerMovieResult | IndexerSeriesResult) => void;
  children?: ReactNode;
}

export const getEpisodeCode = (
  targetKey: string,
  fallbackSeason?: number | null,
  fallbackEpisode?: number | null,
) => {
  const match = new RegExp(/^episode:\d+:(\d+):(\d+)$/i).exec(String(targetKey || ''));
  const season = match?.[1] ? Number(match[1]) : Number(fallbackSeason || 0);
  const episode = match?.[2] ? Number(match[2]) : Number(fallbackEpisode || 0);
  if (!Number.isFinite(season) || !Number.isFinite(episode) || season <= 0 || episode <= 0) {
    return '';
  }
  return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
};

export function WishListCard({
  poster,
  title,
  year,
  rating,
  genre,
  type,
  targets,
  actionKey,
  onRejectIndexerResult,
  onRejectAllIndexerResults,
  onAddTorrent,
  children,
}: Readonly<WishListCardProps>) {
  const { t, language } = useI18n();
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';

  const [seriesGroupMode, setSeriesGroupMode] = useState<SeriesGroupMode>('season');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const groupKey = targets[0]?.tmdbId ?? type;
  const rejectAllKey = `${groupKey}:reject-all`;

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const groupingLabels = useMemo(
    () => ({
      seasonSection: (season: number) =>
        t('wishlistPage.indexerResults.seasonSection', { season }),
      seasonPackSection: t('wishlistPage.indexerResults.seasonPackSection'),
      seasonPackItem: (season: number) =>
        t('wishlistPage.indexerResults.seasonPackItem', { season }),
      episodeSection: (season: number, episode: number) =>
        t('wishlistPage.indexerResults.episodeSection', { season, episode }),
      singleEpisodeSection: (episode: number) =>
        t('wishlistPage.indexerResults.singleEpisodeSection', { episode }),
      completeSeriesSection: t('wishlistPage.indexerResults.completeSeriesSection'),
      unclassifiedSection: t('wishlistPage.indexerResults.unclassifiedSection'),
      resultsCount: (count: number) =>
        count > 1
          ? t('wishlistPage.indexerResults.resultsCountPlural', { count })
          : t('wishlistPage.indexerResults.resultsCount', { count }),
    }),
    [t],
  );

  const seriesSections = useMemo((): SeriesSectionGroup[] => {
    if (type !== 'series') return [];
    return buildSeriesSections({
      items: targets as IndexerSeriesResult[],
      mode: seriesGroupMode,
      labels: groupingLabels,
    });
  }, [type, targets, seriesGroupMode, groupingLabels]);

  const renderTargetItem = (
    target: IndexerMovieResult | IndexerSeriesResult,
    index: number,
  ) => {
    const itemKey = target.guid || target.link || `${target.title}_${index}`;
    const addKey = `${itemKey}:add`;
    const rejectKey = `${itemKey}:reject`;
    const seriesTarget = type === 'series' ? (target as IndexerSeriesResult) : null;
    const itemSeason = seriesTarget ? getItemSeason(seriesTarget) : null;
    const itemEpisode = seriesTarget ? getItemEpisode(seriesTarget) : null;
    const isPack = seriesTarget && itemSeason !== null && itemEpisode === null;

    return (
      <div
        key={itemKey}
        className="rounded-lg border border-white/10 bg-slate-900/60 p-2.5 sm:p-3 hover:bg-slate-900/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
        }}
      ><div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <Button
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onAddTorrent(target);
            }}
            disabled={actionKey === addKey}
            className="bg-cyan-600 hover:bg-cyan-700 text-white whitespace-nowrap"
          >
            {actionKey === addKey ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                {t('wishlistPage.indexerResults.actions.adding')}
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {t('wishlistPage.indexerResults.actions.add')}
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              onRejectIndexerResult(target);
            }}
            disabled={actionKey === rejectKey}
            className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100 whitespace-nowrap"
          >
            {actionKey === rejectKey ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                {t('wishlistPage.indexerResults.actions.rejectingAll')}
              </>
            ) : (
              t('wishlistPage.indexerResults.actions.reject')
            )}
          </Button>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p
            className="text-sm text-white font-medium break-all sm:break-words line-clamp-2 leading-snug"
            title={target.title}
          >
            {target.title}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {isPack && (
              <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/40 text-[11px] px-2 py-0.5">
                <FolderArchive className="w-3 h-3 mr-1 inline" />
                {t('wishlistPage.indexerResults.packBadge')}
              </Badge>
            )}

            {itemEpisode !== null && (
              <Badge className="bg-cyan-600/20 text-cyan-200 border-cyan-500/40 text-[11px] px-2 py-0.5">
                <Tv className="w-3 h-3 mr-1 inline" />
                {itemSeason !== null
                  ? `S${String(itemSeason).padStart(2, '0')}E${String(itemEpisode).padStart(2, '0')}`
                  : t('wishlistPage.indexerResults.episodeBadge', { episode: itemEpisode })}
              </Badge>
            )}

            {target.quality ? (
              <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 text-[11px] px-2 py-0.5">
                {target.quality}
              </Badge>
            ) : null}

            {target.language ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[11px] px-2 py-0.5">
                {target.language}
              </Badge>
            ) : null}

            {target.sizeHuman ? (
              <Badge variant="outline" className="border-white/30 text-white/80 text-[11px] px-2 py-0.5">
                {target.sizeHuman}
              </Badge>
            ) : null}

            {target.pubDate ? (
              <Badge variant="outline" className="border-blue-500/40 text-blue-300 text-[11px] px-2 py-0.5">
                <Calendar className="w-3 h-3 mr-1 inline" />
                {new Date(target.pubDate).toLocaleDateString(locale)}
              </Badge>
            ) : null}

            {Number.isFinite(target.seeders || Number.NaN) && (target.seeders || 0) >= 0 ? (
              <Badge variant="outline" className="border-lime-500/40 text-lime-300 text-[11px] px-2 py-0.5">
                {t('wishlistPage.indexerResults.seeders', { count: target.seeders || 0 })}
              </Badge>
            ) : null}

            {Number.isFinite(target.leechers || Number.NaN) && (target.leechers || 0) >= 0 ? (
              <Badge variant="outline" className="border-orange-500/40 text-orange-300 text-[11px] px-2 py-0.5">
                {t('wishlistPage.indexerResults.peers', { count: target.leechers || 0 })}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="border-white/10 bg-white/5 transition-all" id={`wishlist-target-${groupKey}`}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-4">
          <img src={poster} alt={title} className="w-16 rounded object-cover aspect-[2/3]" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-lg hover:text-cyan-300 transition-colors">
              {title}
            </p>
            <div className="flex items-center gap-3 text-white/60 text-sm mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {year}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                <span className="font-semibold text-white">{rating}</span>
              </span>
            </div>
            <div className="mt-2">
              <Badge
                className={
                  type === 'series'
                    ? 'bg-cyan-600/20 text-cyan-200 border-cyan-500/30'
                    : 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                }
              >
                {genre}
              </Badge>
            </div>
          </div>
        </div>
        {children}

        {targets.length > 0 ? (
          <div
            className="space-y-3 pt-2 border-t border-white/10"
            onClick={(event) => event.stopPropagation()}
            role="presentation"
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation();
              }
            }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="border-cyan-500/40 text-cyan-200 bg-cyan-950/30">
                  {targets.length}{' '}
                  {targets.length > 1
                    ? t('wishlistPage.indexerResults.title')
                    : '1 résultat'}
                </Badge>

                {/* Group mode toggle for series */}
                {type === 'series' && targets.length > 0 && (
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
                      className="text-xs px-2.5 py-1 data-[state=on]:bg-cyan-600 data-[state=on]:text-white hover:bg-white/10 data-[state=off]:text-white/60 data-[state=off]:hover:text-white/80"
                    >
                      <Layers className="w-3 h-3 mr-1 inline" />
                      {t('wishlistPage.indexerResults.groupBySeason')}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="episode"
                      className="text-xs px-2.5 py-1 data-[state=on]:bg-cyan-600 data-[state=on]:text-white hover:bg-white/10 data-[state=off]:text-white/60 data-[state=off]:hover:text-white/80"
                    >
                      <Tv className="w-3 h-3 mr-1 inline" />
                      {t('wishlistPage.indexerResults.groupByEpisode')}
                    </ToggleGroupItem>
                  </ToggleGroup>
                )}
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  onRejectAllIndexerResults(targets);
                }}
                disabled={actionKey === rejectAllKey}
                className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100 text-xs"
              >
                {actionKey === rejectAllKey ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {t('wishlistPage.indexerResults.actions.rejectingAll')}
                  </>
                ) : (
                  t('wishlistPage.indexerResults.actions.rejectAll')
                )}
              </Button>
            </div>

            {/* Render Series Sections or Movie List */}
            {type === 'series' ? (
              <div className="space-y-2.5 pt-1">
                {seriesSections.map((section) => {
                  const isCollapsed = Boolean(collapsedSections[section.id]);
                  return (
                    <div
                      key={section.id}
                      className="rounded-lg border border-white/15 bg-white/[0.02] overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSectionCollapse(section.id);
                        }}
                        className="w-full flex items-center justify-between p-2.5 px-3 bg-white/5 hover:bg-white/10 text-left transition-colors cursor-pointer select-none"
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
                        <div className="p-2.5 space-y-2 border-t border-white/10 bg-slate-950/20">
                          {section.items.map((item, idx) =>
                            renderTargetItem(item, idx),
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {targets.map((target, idx) => renderTargetItem(target, idx))}
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

