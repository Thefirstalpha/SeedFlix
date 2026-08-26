import { Star, Calendar, Download } from 'lucide-react';
import { ReactNode } from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { useI18n } from '../i18n/LanguageProvider';
import { IndexerMovieResult, IndexerSeriesResult } from '../../../common/indexer';

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
  const { t } = useI18n();

  const groupKey = targets[0]?.tmdbId ?? type;
  const rejectAllKey = `${groupKey}:reject-all`;

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
            className="space-y-3"
            onClick={(event) => event.stopPropagation()}
            role="presentation"
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation();
              }
            }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Badge variant="outline" className="border-white/20 text-white/70">
                {targets.length} {targets.length > 1 ? t('wishlistPage.indexerResults.title') : '1 résultat'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  onRejectAllIndexerResults(targets);
                }}
                disabled={actionKey === rejectAllKey}
                className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
              >
                {actionKey === rejectAllKey
                  ? t('wishlistPage.indexerResults.actions.rejectingAll')
                  : t('wishlistPage.indexerResults.actions.rejectAll')}
              </Button>
            </div>

            {(() => {
              const renderTargetItem = (target: IndexerMovieResult | IndexerSeriesResult) => {
                const itemKey = target.guid || target.link;
                const addKey = `${itemKey}:add`;
                const rejectKey = `${itemKey}:reject`;
                const seriesTarget = 'seasonNumber' in target ? (target as IndexerSeriesResult) : null;
                const season = seriesTarget?.seasonNumber ?? null;
                const episode = seriesTarget?.episodeNumber ?? null;
                const episodeCode =
                  season != null && episode != null
                    ? getEpisodeCode('', season, episode)
                    : null;
                const isPack = season != null && episode == null;

                return (
                  <div
                    key={itemKey}
                    className="rounded border border-white/10 bg-slate-900/60 p-3 space-y-2 hover:bg-slate-900/80 transition-colors"
                  >
                    <p className="text-sm text-white font-medium break-all">{target.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {episodeCode ? (
                        <Badge className="bg-cyan-600/20 text-cyan-200 border-cyan-500/40 text-xs">
                          {episodeCode}
                        </Badge>
                      ) : isPack ? (
                        <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/40 text-xs">
                          Pack Saison {season}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          onAddTorrent(target);
                        }}
                        disabled={actionKey === addKey}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {actionKey === addKey
                          ? t('wishlistPage.indexerResults.actions.adding')
                          : t('wishlistPage.indexerResults.actions.add')}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRejectIndexerResult(target);
                        }}
                        disabled={actionKey === rejectKey}
                        className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
                      >
                        {t('wishlistPage.indexerResults.actions.reject')}
                      </Button>

                      {target.quality ? (
                        <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                          {target.quality}
                        </Badge>
                      ) : null}

                      {target.language ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                          {target.language}
                        </Badge>
                      ) : null}

                      {target.sizeHuman ? (
                        <Badge variant="outline" className="border-white/30 text-white/80">
                          {target.sizeHuman}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              };

              if (type === 'series') {
                // Group targets by Season
                const seasonsMap = new Map<number, (IndexerMovieResult | IndexerSeriesResult)[]>();
                const otherItems: (IndexerMovieResult | IndexerSeriesResult)[] = [];

                for (const tItem of targets) {
                  const seriesT = 'seasonNumber' in tItem ? (tItem as IndexerSeriesResult) : null;
                  const s = seriesT?.seasonNumber;
                  if (s !== undefined && s !== null && Number.isFinite(s) && s > 0) {
                    if (!seasonsMap.has(s)) seasonsMap.set(s, []);
                    seasonsMap.get(s)!.push(tItem);
                  } else {
                    otherItems.push(tItem);
                  }
                }

                const sortedSeasons = Array.from(seasonsMap.keys()).sort((a, b) => a - b);
                const hasMultipleSections = sortedSeasons.length > 1 || (sortedSeasons.length === 1 && otherItems.length > 0);

                if (!hasMultipleSections && sortedSeasons.length <= 1) {
                  return targets.map(renderTargetItem);
                }

                return (
                  <div className="space-y-4">
                    {sortedSeasons.map((s) => (
                      <div key={`season-group-${s}`} className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                            Saison {s}
                          </span>
                          <span className="text-xs text-white/50">
                            ({seasonsMap.get(s)!.length})
                          </span>
                        </div>
                        <div className="space-y-2">
                          {seasonsMap.get(s)!.map(renderTargetItem)}
                        </div>
                      </div>
                    ))}

                    {otherItems.length > 0 && (
                      <div key="other-group" className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
                            Autres versions
                          </span>
                          <span className="text-xs text-white/50">
                            ({otherItems.length})
                          </span>
                        </div>
                        <div className="space-y-2">
                          {otherItems.map(renderTargetItem)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return targets.map(renderTargetItem);
            })()}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
