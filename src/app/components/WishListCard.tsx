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
    <Card className="border-white/10 bg-white/5 transition-all">
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
                {targets.length}
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

            {targets.map((target) => {
              const itemKey = target.guid || target.link;
              const addKey = `${itemKey}:add`;
              const rejectKey = `${itemKey}:reject`;
              const seriesTarget = 'seasonNumber' in target ? (target as IndexerSeriesResult) : null;
              const episodeCode =
                seriesTarget?.seasonNumber != null && seriesTarget?.episodeNumber != null
                  ? getEpisodeCode('', seriesTarget.seasonNumber, seriesTarget.episodeNumber)
                  : null;

              return (
                <div
                  key={itemKey}
                  className="rounded border border-white/10 bg-slate-900/60 p-3 space-y-2"
                >
                  <p className="text-sm text-white font-medium break-all">{target.title}</p>
                  {episodeCode ? (
                    <p className="text-xs text-white/50">{episodeCode}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
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
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
